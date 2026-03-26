#!/usr/bin/env python3
"""
bridge.py  - Redis -> WebSocket bridge for IoV Digital Twin dashboard

This adapter is aligned with the current IoV-Digital-Twin-TaskOffloading
simulation contract:

    - vehicle:<id>:state      (hash)
    - rsu:<id>:resources      (hash)
    - task:<id>:state         (hash)
    - task:<id>:request       (hash, optional enrich)
    - service_vehicles:available (zset, optional for kind=sv)

It polls Redis DBs (default: 0,1,2) and emits New-dashboard message types:
    - positions
    - resources
    - task_event
"""

import asyncio
import json
import logging
import os
from typing import Any

import redis.asyncio as aioredis
import websockets
from websockets.server import WebSocketServerProtocol

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("bridge")

REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DBS  = [int(v.strip()) for v in os.getenv("REDIS_DBS", "0,1,2").split(",") if v.strip()]
WS_HOST    = "0.0.0.0"
WS_PORT    = 8765

# All connected browser clients
clients: set[WebSocketServerProtocol] = set()
task_cache: dict[str, str] = {}
task_phase_cache: dict[str, int] = {}
task_stream_last_id: dict[int, str] = {}


async def broadcast(msg: dict) -> None:
    if not clients:
        return
    data = json.dumps(msg)
    await asyncio.gather(*[c.send(data) for c in clients], return_exceptions=True)


def parse_middle_id(key: str, prefix: str, suffix: str) -> str | None:
    token = f"{prefix}:"
    if not key.startswith(token) or not key.endswith(suffix):
        return None
    return key[len(token): -len(suffix)]


def to_float(data: dict[str, str], key: str, default: float = 0.0) -> float:
    val = data.get(key)
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        return default


def normalize_percent(value: float) -> float:
    if value <= 0:
        return 0.0
    if value <= 1.0:
        return min(100.0, value * 100.0)
    return min(100.0, value)


def map_task_state(status: str, decision_type: str) -> str:
    s = (status or "").upper()
    d = (decision_type or "").upper()

    if s in {"PENDING", "NEW", "CREATED"}:
        if d == "LOCAL":
            return "local_queued"
        if d:
            return "decision_returned"
        return "generated"

    if s in {"OFFLOADED", "ASSIGNED", "ACCEPTED"}:
        return "task_data_sent" if d and d != "LOCAL" else "local_queued"

    if s in {"EXECUTING", "PROCESSING", "RUNNING"}:
        return "remote_processing" if d and d != "LOCAL" else "local_processing"

    if s.startswith("COMPLETED"):
        return "complete" if d and d != "LOCAL" else "local_complete"

    if s in {"FAILED", "REJECTED", "EXPIRED"}:
        return "failed"

    return "generated"


def is_remote(decision_type: str) -> bool:
    d = (decision_type or "").upper()
    return d not in {"", "LOCAL"}


def phase_from_state(status: str, decision_type: str) -> int:
    """
    Canonical phases for remote flow:
      0 generated
      1 metadata_sent
      2 decision_returned
      3 task_data_sent
      4 remote_processing
      5 result_returning
      6 complete
    Local flow:
      10 local_queued
      11 local_processing
      12 local_complete
    """
    s = (status or "").upper()
    remote = is_remote(decision_type)

    if not remote:
        if s in {"PENDING", "NEW", "CREATED"}:
            return 10
        if s in {"EXECUTING", "PROCESSING", "RUNNING"}:
            return 11
        if s.startswith("COMPLETED"):
            return 12
        if s in {"FAILED", "REJECTED", "EXPIRED"}:
            return 12
        return 10

    if s in {"PENDING", "NEW", "CREATED"}:
        return 2  # decision may already be present in same hash update
    if s in {"OFFLOADED", "ASSIGNED", "ACCEPTED"}:
        return 3
    if s in {"EXECUTING", "PROCESSING", "RUNNING"}:
        return 4
    if s.startswith("COMPLETED"):
        return 6
    if s in {"FAILED", "REJECTED", "EXPIRED"}:
        return 6
    return 0


def phase_state_name(phase: int, remote: bool) -> str:
    if not remote:
        if phase <= 10:
            return "local_queued"
        if phase == 11:
            return "local_processing"
        return "local_complete"

    return {
        0: "generated",
        1: "metadata_sent",
        2: "decision_returned",
        3: "task_data_sent",
        4: "remote_processing",
        5: "result_returning",
        6: "complete",
    }.get(phase, "generated")


def build_phase_sequence(prev_phase: int | None, next_phase: int, remote: bool) -> list[int]:
    if prev_phase is None:
        return [next_phase]

    if not remote:
        if next_phase <= prev_phase:
            return [next_phase]
        return list(range(prev_phase + 1, next_phase + 1))

    if next_phase <= prev_phase:
        return [next_phase]

    seq = list(range(prev_phase + 1, next_phase + 1))
    # Ensure metadata leg exists for remote flow once.
    if prev_phase < 1 and next_phase >= 2 and 1 not in seq:
        seq.insert(0, 1)
    # Ensure result_returning appears before completion.
    if next_phase >= 6 and 5 not in seq:
        seq.insert(max(0, len(seq) - 1), 5)
    return seq


def map_lifecycle_event_to_state(event_type: str) -> str | None:
    et = (event_type or "").upper()

    if et == "METADATA_SENT":
        return "metadata_sent"
    if et in {"DECISION_RECEIVED", "DECISION_OFFLOAD"}:
        return "decision_returned"
    if et == "TASK_OFFLOADING":
        return "task_data_sent"
    if et in {"SV_RESULT_SENT"}:
        return "result_returning"
    if et in {"PROCESSING_STARTED"}:
        return "remote_processing"
    if et in {"PROCESSING_COMPLETED"}:
        return "result_returning"
    if et in {"COMPLETED", "COMPLETED_ON_TIME", "COMPLETED_LATE"}:
        return "complete"
    if et in {"FAILED", "OFFLOAD_TIMEOUT_FAIL", "SV_DEADLINE_MISSED", "REJECTED"}:
        return "failed"
    return None


async def resolve_task_context(r: aioredis.Redis, task_id: str) -> tuple[str, str, str, str]:
    state = await r.hgetall(f"task:{task_id}:state")
    req = await r.hgetall(f"task:{task_id}:request")
    vehicle_id = state.get("vehicle_id") or req.get("vehicle_id") or ""
    rsu_id = req.get("rsu_id") or ""
    decision_type = state.get("decision_type") or ""
    target_id = state.get("target_id") or state.get("processor_id") or rsu_id
    return vehicle_id, rsu_id, decision_type, target_id


async def init_task_stream_offsets(redis_sources: list[aioredis.Redis]) -> None:
    for idx, r in enumerate(redis_sources):
        latest = await r.xrevrange("task_lifecycle_events", max="+", min="-", count=1)
        task_stream_last_id[idx] = latest[0][0] if latest else "0-0"


async def task_lifecycle_stream_poller(redis_sources: list[aioredis.Redis]) -> None:
    """Read explicit lifecycle events stream from Redis and emit canonical task_event updates."""
    global task_stream_last_id

    if not task_stream_last_id:
        await init_task_stream_offsets(redis_sources)

    while True:
        for idx, r in enumerate(redis_sources):
            last_id = task_stream_last_id.get(idx, "0-0")
            rows = await r.xrange("task_lifecycle_events", min=f"({last_id}", max="+", count=200)
            if not rows:
                continue

            for stream_id, fields in rows:
                task_stream_last_id[idx] = stream_id
                task_id = fields.get("task_id", "")
                event_type = fields.get("event_type", "")
                mapped_state = map_lifecycle_event_to_state(event_type)
                if not task_id or not mapped_state:
                    continue

                vehicle_id, rsu_id, decision_type, target_id = await resolve_task_context(r, task_id)

                event: dict[str, Any] = {
                    "task_id": task_id,
                    "vehicle": vehicle_id,
                    "rsu": rsu_id,
                    "state": mapped_state,
                    "event_type": event_type,
                }

                # For decision leg, show RSU->vehicle by setting target to RSU.
                if mapped_state == "decision_returned":
                    event["current_target"] = rsu_id or target_id
                else:
                    if target_id:
                        event["current_target"] = target_id

                if mapped_state == "remote_processing":
                    event["progress"] = 50
                elif mapped_state in {"result_returning", "complete", "local_complete"}:
                    event["progress"] = 100

                await broadcast({"type": "task_event", "data": event})

        await asyncio.sleep(0.15)


async def scan_keys(r: aioredis.Redis, pattern: str, count: int = 300) -> list[str]:
    cursor = 0
    keys: list[str] = []
    while True:
        cursor, batch = await r.scan(cursor=cursor, match=pattern, count=count)
        if batch:
            keys.extend(batch)
        if cursor == 0:
            break
    return keys


async def position_poller(redis_sources: list[aioredis.Redis]) -> None:
    """Poll merged vehicle/RSU positions across configured Redis DBs."""
    while True:
        snapshot: dict[str, dict[str, Any]] = {}
        freshness: dict[str, float] = {}
        service_vehicle_ids: set[str] = set()

        for r in redis_sources:
            for sv_id in await r.zrevrange("service_vehicles:available", 0, -1):
                service_vehicle_ids.add(sv_id)

            vehicle_keys = await scan_keys(r, "vehicle:*:state")
            for key in vehicle_keys:
                eid = parse_middle_id(key, "vehicle", ":state")
                if not eid:
                    continue
                data = await r.hgetall(key)
                if not data:
                    continue

                ts = to_float(data, "last_update", 0.0)
                if eid in freshness and freshness[eid] > ts:
                    continue
                freshness[eid] = ts
                snapshot[eid] = {
                    "kind": "sv" if eid in service_vehicle_ids else "vehicle",
                    "id": eid,
                    "x": to_float(data, "pos_x", 0.0),
                    "y": to_float(data, "pos_y", 0.0),
                    "speed": to_float(data, "speed", 0.0),
                    # No battery field in current sim contract; keep stable placeholder.
                    "energy": 100.0,
                }

            rsu_keys = await scan_keys(r, "rsu:*:resources")
            for key in rsu_keys:
                eid = parse_middle_id(key, "rsu", ":resources")
                if not eid:
                    continue
                data = await r.hgetall(key)
                if not data:
                    continue

                ts = to_float(data, "update_time", 0.0)
                if eid in freshness and freshness[eid] > ts:
                    continue
                freshness[eid] = ts
                snapshot[eid] = {
                    "kind": "rsu",
                    "id": eid,
                    "x": to_float(data, "pos_x", 0.0),
                    "y": to_float(data, "pos_y", 0.0),
                    "speed": 0.0,
                    "energy": 100.0,
                }

        if snapshot:
            await broadcast({"type": "positions", "data": snapshot})
        await asyncio.sleep(0.1)


async def resource_poller(redis_sources: list[aioredis.Redis]) -> None:
    """Poll merged CPU/memory/energy/queue every 500 ms."""
    while True:
        resources: dict[str, dict[str, float | int]] = {}
        freshness: dict[str, float] = {}

        for r in redis_sources:
            vehicle_keys = await scan_keys(r, "vehicle:*:state")
            for key in vehicle_keys:
                eid = parse_middle_id(key, "vehicle", ":state")
                if not eid:
                    continue
                data = await r.hgetall(key)
                if not data:
                    continue
                ts = to_float(data, "last_update", 0.0)
                if eid in freshness and freshness[eid] > ts:
                    continue
                freshness[eid] = ts
                resources[eid] = {
                    "cpu": normalize_percent(to_float(data, "cpu_utilization", 0.0)),
                    "mem": normalize_percent(to_float(data, "mem_utilization", 0.0)),
                    "energy": 100.0,
                    "queue": int(to_float(data, "queue_length", 0.0)),
                    "processing": int(to_float(data, "processing_count", 0.0)),
                    "sim_time": to_float(data, "last_update", 0.0),
                }

            rsu_keys = await scan_keys(r, "rsu:*:resources")
            for key in rsu_keys:
                eid = parse_middle_id(key, "rsu", ":resources")
                if not eid:
                    continue
                data = await r.hgetall(key)
                if not data:
                    continue
                ts = to_float(data, "update_time", 0.0)
                if eid in freshness and freshness[eid] > ts:
                    continue
                freshness[eid] = ts
                resources[eid] = {
                    # RSU percent utilization is not in contract; expose available values as coarse bars.
                    "cpu": normalize_percent(to_float(data, "cpu_available", 0.0)),
                    "mem": normalize_percent(to_float(data, "memory_available", 0.0)),
                    "energy": 100.0,
                    "queue": int(to_float(data, "queue_length", 0.0)),
                    "processing": int(to_float(data, "processing_count", 0.0)),
                    "sim_time": to_float(data, "update_time", 0.0),
                }

        if resources:
            await broadcast({"type": "resources", "data": resources})
        await asyncio.sleep(0.5)


async def task_state_poller(redis_sources: list[aioredis.Redis]) -> None:
    """Poll task state hashes and emit synthetic task_event updates on change."""
    global task_cache, task_phase_cache

    while True:
        next_cache: dict[str, str] = {}

        for r in redis_sources:
            task_keys = await scan_keys(r, "task:*:state")
            for key in task_keys:
                task_id = parse_middle_id(key, "task", ":state")
                if not task_id:
                    continue

                state = await r.hgetall(key)
                if not state:
                    continue

                request = await r.hgetall(f"task:{task_id}:request")

                vehicle_id = state.get("vehicle_id") or request.get("vehicle_id") or ""
                rsu_id = request.get("rsu_id") or ""
                decision_type = state.get("decision_type", "")
                target_id = state.get("target_id") or state.get("processor_id") or rsu_id
                raw_status = state.get("status", "PENDING")

                remote = is_remote(decision_type)
                next_phase = phase_from_state(raw_status, decision_type)
                signature = "|".join([
                    raw_status,
                    decision_type,
                    target_id,
                    vehicle_id,
                    rsu_id,
                    state.get("completion_time", ""),
                ])
                next_cache[task_id] = signature

                if task_cache.get(task_id) == signature:
                    continue

                prev_phase = task_phase_cache.get(task_id)
                phases_to_emit = build_phase_sequence(prev_phase, next_phase, remote)

                for ph in phases_to_emit:
                    mapped_state = phase_state_name(ph, remote)

                    # Communication legs are emitted from explicit lifecycle stream.
                    if mapped_state in {"metadata_sent", "decision_returned", "task_data_sent", "result_returning"}:
                        continue

                    event: dict[str, Any] = {
                        "task_id": task_id,
                        "vehicle": vehicle_id,
                        "rsu": rsu_id,
                        "state": mapped_state,
                    }

                    if target_id:
                        event["current_target"] = target_id

                    if mapped_state == "remote_processing":
                        event["progress"] = 50
                    elif mapped_state in {"result_returning", "complete", "local_complete"}:
                        event["progress"] = 100

                    await broadcast({"type": "task_event", "data": event})

                    # Small gap so UI can render each communication leg transition.
                    if len(phases_to_emit) > 1:
                        await asyncio.sleep(0.08)

                task_phase_cache[task_id] = next_phase

        task_cache = next_cache
        await asyncio.sleep(0.25)


async def ws_handler(ws: WebSocketServerProtocol) -> None:
    clients.add(ws)
    log.info(f"Client connected: {ws.remote_address}  total={len(clients)}")
    try:
        async for _ in ws:
            pass   # browser doesn't send anything currently
    except websockets.ConnectionClosed:
        pass
    finally:
        clients.discard(ws)
        log.info(f"Client disconnected  total={len(clients)}")


async def main() -> None:
    redis_sources = [
        aioredis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=db, decode_responses=True)
        for db in REDIS_DBS
    ]
    log.info(f"Connected to Redis at {REDIS_HOST}:{REDIS_PORT}, dbs={REDIS_DBS}")

    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        log.info(f"WebSocket server on ws://{WS_HOST}:{WS_PORT}")
        await asyncio.gather(
            position_poller(redis_sources),
            resource_poller(redis_sources),
            task_lifecycle_stream_poller(redis_sources),
            task_state_poller(redis_sources),
        )

if __name__ == "__main__":
    asyncio.run(main())
