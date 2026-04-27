#!/usr/bin/env python3
"""Dashboard API and static file server for the New-dashboard demo.

The server exposes a small REST surface that matches the Redis schema used by
the simulator and the dashboard bridge:

  GET  /api/active-vehicles
  GET  /api/task-types
  POST /api/inject-task
  GET  /api/task-results/<task_id>

It also serves the dashboard HTML, the WebSocket bridge page, and local assets
from the New-dashboard directory.
"""

from __future__ import annotations

import json
import mimetypes
import os
import secrets
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

try:
    import redis
except ImportError:  # pragma: no cover - optional fallback for demo-only runs
    redis = None


ROOT = Path(__file__).resolve().parent
DEFAULT_RSU_ID = os.getenv("DASHBOARD_DEFAULT_RSU_ID", "RSU_0")
DEFAULT_PORT = int(os.getenv("DASHBOARD_PORT", "8090"))
DEFAULT_HOST = os.getenv("DASHBOARD_HOST", "0.0.0.0")
REDIS_URL = os.getenv("REDIS_URL")
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

ALGORITHMS = [
    {"key": "random", "label": "Random"},
    {"key": "greedy_distance", "label": "Greedy Distance"},
    {"key": "greedy_compute", "label": "Greedy Compute"},
    {"key": "ddqn", "label": "DDQN"},
]

TASK_TYPES = [
    {"id": "video_processing", "name": "Video Processing", "cpu_cycles": 4000000, "input_size_bytes": 1500000, "output_size_bytes": 220000, "deadline_seconds": 5.0, "qos_value": 0.82, "priority_level": 2, "is_offloadable": True, "is_safety_critical": False},
    {"id": "traffic_analytics", "name": "Traffic Analytics", "cpu_cycles": 2800000, "input_size_bytes": 800000, "output_size_bytes": 120000, "deadline_seconds": 4.0, "qos_value": 0.86, "priority_level": 2, "is_offloadable": True, "is_safety_critical": False},
    {"id": "sensor_fusion", "name": "Sensor Fusion", "cpu_cycles": 3200000, "input_size_bytes": 1100000, "output_size_bytes": 180000, "deadline_seconds": 4.5, "qos_value": 0.84, "priority_level": 2, "is_offloadable": True, "is_safety_critical": False},
    {"id": "route_prediction", "name": "Route Prediction", "cpu_cycles": 2400000, "input_size_bytes": 650000, "output_size_bytes": 120000, "deadline_seconds": 6.0, "qos_value": 0.79, "priority_level": 2, "is_offloadable": True, "is_safety_critical": False},
    {"id": "cooperative_awareness", "name": "Cooperative Awareness", "cpu_cycles": 1900000, "input_size_bytes": 420000, "output_size_bytes": 90000, "deadline_seconds": 3.5, "qos_value": 0.91, "priority_level": 1, "is_offloadable": True, "is_safety_critical": True},
]

ALGORITHM_ALIASES = {
    "random": ["random"],
    "greedy_distance": ["greedy_distance", "greedy_dist", "greedy_distance_only"],
    "greedy_compute": ["greedy_compute", "greedy_comp", "greedy_cpu"],
    "ddqn": ["ddqn", "dqn"],
}


def make_redis_client():
    if redis is None:
        return None
    if REDIS_URL:
        return redis.Redis.from_url(REDIS_URL, decode_responses=True)
    return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, decode_responses=True)


def json_response(handler: SimpleHTTPRequestHandler, payload: Any, status: int = 200) -> None:
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def parse_task_type(task_type_id: str | None) -> dict[str, Any] | None:
    if not task_type_id:
        return None
    candidate = str(task_type_id).strip()
    for task_type in TASK_TYPES:
        if task_type["id"] == candidate or task_type["name"] == candidate:
            return task_type
    return None


def normalize_float(value: Any, default: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return default
    return result if result == result else default


def normalize_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def fetch_active_vehicles(r: Any) -> list[dict[str, Any]]:
    if r is None:
        return [
            {"id": "V1", "kind": "vehicle", "speed": 12.0, "pos_x": 0.0, "pos_y": 0.0, "last_update": 0.0, "ttl": 0, "active": True},
            {"id": "V2", "kind": "vehicle", "speed": 10.0, "pos_x": 25.0, "pos_y": 10.0, "last_update": 0.0, "ttl": 0, "active": True},
        ]

    service_vehicle_ids = set()
    try:
        service_vehicle_ids = {str(value) for value in r.zrevrange("service_vehicles:available", 0, -1)}
    except Exception:
        service_vehicle_ids = set()

    vehicles: list[dict[str, Any]] = []
    for key in r.scan_iter(match="vehicle:*:state"):
        vehicle_id = key[len("vehicle:") : -len(":state")]
        state = r.hgetall(key)
        if not state:
            continue
        ttl = normalize_int(r.ttl(key), -1)
        vehicles.append(
            {
                "id": vehicle_id,
                "kind": "sv" if vehicle_id in service_vehicle_ids else "vehicle",
                "speed": normalize_float(state.get("speed")),
                "pos_x": normalize_float(state.get("pos_x")),
                "pos_y": normalize_float(state.get("pos_y")),
                "heading": normalize_float(state.get("heading")),
                "cpu_available": normalize_float(state.get("cpu_available")),
                "cpu_utilization": normalize_float(state.get("cpu_utilization")),
                "mem_available": normalize_float(state.get("mem_available")),
                "mem_utilization": normalize_float(state.get("mem_utilization")),
                "queue_length": normalize_int(state.get("queue_length")),
                "processing_count": normalize_int(state.get("processing_count")),
                "last_update": normalize_float(state.get("last_update")),
                "ttl": ttl,
                "active": ttl != 0,
            }
        )

    vehicles.sort(key=lambda item: (item["ttl"] == 0, item["last_update"], item["id"]), reverse=True)
    return vehicles


def read_task_results(r: Any, task_id: str) -> dict[str, Any]:
    summary: dict[str, Any] = {"task_id": task_id, "task": {}, "algorithms": []}

    if r is None:
        summary["algorithms"] = [
            {"key": algo["key"], "label": algo["label"], "status": "PENDING", "latency_ms": None, "energy_j": None, "reason": "simulation not connected"}
            for algo in ALGORITHMS
        ]
        return summary

    request = r.hgetall(f"task:{task_id}:request") or {}
    state = r.hgetall(f"task:{task_id}:state") or {}
    result_hash = r.hgetall(f"task:{task_id}:results") or {}
    single_result = r.hgetall(f"task:{task_id}:result") or {}
    local_result = r.hgetall(f"task:{task_id}:local_result") or {}

    summary["task"] = {
        "vehicle_id": request.get("vehicle_id") or state.get("vehicle_id") or "",
        "task_type": request.get("task_type") or state.get("task_type") or "",
        "status": state.get("status") or request.get("status") or "PENDING",
        "created_time": normalize_float(state.get("created_time") or request.get("request_time")),
        "deadline_seconds": normalize_float(request.get("deadline_seconds") or state.get("deadline")),
        "qos_value": normalize_float(request.get("qos_value")),
        "rsu_id": request.get("rsu_id") or DEFAULT_RSU_ID,
    }

    def find_field(prefixes: list[str], field: str) -> Any:
        for prefix in prefixes:
            value = result_hash.get(f"{prefix}_{field}")
            if value not in (None, ""):
                return value
        for prefix in prefixes:
            nested = r.hgetall(f"task:{task_id}:results:{prefix}") or {}
            if field in nested and nested[field] != "":
                return nested[field]
        if field in single_result and single_result[field] != "":
            return single_result[field]
        if field in local_result and local_result[field] != "":
            return local_result[field]
        return None

    for algo in ALGORITHMS:
        prefixes = ALGORITHM_ALIASES.get(algo["key"], [algo["key"]])
        status_value = find_field(prefixes, "status")
        latency_value = find_field(prefixes, "latency")
        energy_value = find_field(prefixes, "energy")
        reason_value = find_field(prefixes, "reason")

        status = str(status_value) if status_value is not None else "PENDING"
        latency_ms = normalize_float(latency_value, default=None) if latency_value is not None else None
        energy_j = normalize_float(energy_value, default=None) if energy_value is not None else None
        reason = str(reason_value) if reason_value is not None else "waiting for simulation"

        if latency_ms is not None and latency_ms < 1000:
            latency_ms = round(latency_ms * 1000.0, 3)
        elif latency_ms is not None:
            latency_ms = round(latency_ms, 3)

        if energy_j is not None:
            energy_j = round(energy_j, 6)

        status_upper = status.upper()
        if status_upper.startswith("COMPLETED") or status_upper in {"SUCCESS", "SUCCEEDED"}:
            status_badge = "SUCCESS"
        elif status_upper in {"FAILED", "FAIL", "REJECTED"}:
            status_badge = "FAILED"
        elif status_upper in {"RUNNING", "PROCESSING", "EXECUTING"}:
            status_badge = "RUNNING"
        else:
            status_badge = "PENDING"

        summary["algorithms"].append(
            {
                "key": algo["key"],
                "label": algo["label"],
                "status": status_badge,
                "raw_status": status,
                "latency_ms": latency_ms,
                "energy_j": energy_j,
                "reason": reason,
            }
        )

    return summary


def create_demo_task_payload(task_id: str, vehicle_id: str, task_type: dict[str, Any]) -> dict[str, Any]:
    return {
        "task_id": task_id,
        "vehicle_id": vehicle_id,
        "rsu_id": DEFAULT_RSU_ID,
        "task_type": task_type["name"],
        "task_type_id": task_type["id"],
        "deadline_seconds": task_type["deadline_seconds"],
        "qos_value": task_type["qos_value"],
        "cpu_cycles": task_type["cpu_cycles"],
        "input_size_bytes": task_type["input_size_bytes"],
        "output_size_bytes": task_type["output_size_bytes"],
        "priority_level": task_type["priority_level"],
        "is_offloadable": task_type["is_offloadable"],
        "is_safety_critical": task_type["is_safety_critical"],
        "request_time": time.time(),
    }


def write_task_demo_state(r: Any, payload: dict[str, Any]) -> None:
    task_id = payload["task_id"]
    request_key = f"task:{task_id}:request"
    state_key = f"task:{task_id}:state"
    results_key = f"task:{task_id}:results"

    request_fields = {
        "task_id": task_id,
        "vehicle_id": payload["vehicle_id"],
        "rsu_id": payload["rsu_id"],
        "mem_footprint_bytes": payload["input_size_bytes"],
        "cpu_cycles": payload["cpu_cycles"],
        "deadline_seconds": payload["deadline_seconds"],
        "qos_value": payload["qos_value"],
        "request_time": payload["request_time"],
        "task_type": payload["task_type"],
        "input_size_bytes": payload["input_size_bytes"],
        "output_size_bytes": payload["output_size_bytes"],
        "is_offloadable": int(payload["is_offloadable"]),
        "is_safety_critical": int(payload["is_safety_critical"]),
        "priority_level": payload["priority_level"],
    }

    state_fields = {
        "vehicle_id": payload["vehicle_id"],
        "status": "PENDING",
        "decision_type": "DEMO_MULTI_ALGO",
        "target_id": payload["rsu_id"],
        "task_type": payload["task_type"],
        "deadline": payload["deadline_seconds"],
        "created_time": payload["request_time"],
    }

    demo_result_fields: dict[str, Any] = {}
    for algo in ALGORITHMS:
        demo_result_fields[f"{algo['key']}_status"] = "PENDING"
        demo_result_fields[f"{algo['key']}_latency"] = 0.0
        demo_result_fields[f"{algo['key']}_energy"] = 0.0
        demo_result_fields[f"{algo['key']}_reason"] = "WAITING_FOR_SIMULATION"

    pipe = r.pipeline()
    pipe.hset(request_key, mapping=request_fields)
    pipe.expire(request_key, 300)
    pipe.hset(state_key, mapping=state_fields)
    pipe.expire(state_key, 300)
    pipe.hset(results_key, mapping=demo_result_fields)
    pipe.expire(results_key, 300)
    pipe.rpush("offloading_requests:queue", task_id)
    pipe.xadd(
        "task_lifecycle_events",
        {
            "task_id": task_id,
            "event_type": "METADATA_SENT",
            "event_time": f"{payload['request_time']:.6f}",
            "source_entity": payload["vehicle_id"],
            "target_entity": payload["rsu_id"],
            "details": payload["task_type"],
        },
        maxlen=5000,
        approximate=True,
    )
    pipe.execute()


class DashboardRequestHandler(SimpleHTTPRequestHandler):
    server_version = "NewDashboardAPI/1.0"

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _redis(self) -> Any:
        return self.server.redis_client  # type: ignore[attr-defined]

    def _read_json_body(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0:
            return {}
        payload = self.rfile.read(content_length).decode("utf-8")
        if not payload.strip():
            return {}
        return json.loads(payload)

    def _serve_static_file(self, relative_path: str) -> None:
        relative_path = relative_path.lstrip("/")
        if not relative_path or relative_path == "/":
            relative_path = "index.html"

        file_path = (ROOT / relative_path).resolve()
        if ROOT not in file_path.parents and file_path != ROOT:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        if not file_path.exists() or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        content_type, _ = mimetypes.guess_type(str(file_path))
        content_type = content_type or "application/octet-stream"
        data = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/task-types":
            json_response(self, {"task_types": TASK_TYPES})
            return
        if path == "/api/active-vehicles":
            vehicles = fetch_active_vehicles(self._redis())
            json_response(self, {"vehicles": vehicles, "count": len(vehicles), "timestamp": time.time()})
            return
        if path.startswith("/api/task-results/"):
            task_id = path.rsplit("/", 1)[-1]
            if not task_id:
                self.send_error(HTTPStatus.BAD_REQUEST, "task_id is required")
                return
            json_response(self, read_task_results(self._redis(), task_id))
            return
        if path in {"/", "/index.html", "/secondary.html", "/map.geojson", "/bridge.py", "/convert_map.py", "/README.md"} or path.endswith((".html", ".geojson", ".py", ".md", ".js", ".css")):
            self._serve_static_file(path)
            return
        self._serve_static_file("index.html")

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path != "/api/inject-task":
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")
            return

        try:
            body = self._read_json_body()
        except json.JSONDecodeError as exc:
            self.send_error(HTTPStatus.BAD_REQUEST, f"Invalid JSON: {exc}")
            return

        vehicle_id = str(body.get("vehicle_id") or body.get("vehicleId") or "").strip()
        task_type_id = str(body.get("task_type") or body.get("taskType") or "").strip()
        task_type = parse_task_type(task_type_id)

        if not vehicle_id:
            json_response(self, {"error": "vehicle_id is required"}, status=HTTPStatus.BAD_REQUEST)
            return
        if task_type is None:
            json_response(self, {"error": "task_type is invalid or unsupported"}, status=HTTPStatus.BAD_REQUEST)
            return

        task_id = str(body.get("task_id") or body.get("taskId") or f"task-{int(time.time() * 1000)}-{secrets.token_hex(3)}")
        payload = create_demo_task_payload(task_id, vehicle_id, task_type)

        redis_client = self._redis()
        if redis_client is not None:
            try:
                write_task_demo_state(redis_client, payload)
            except Exception as exc:  # pragma: no cover - operational error path
                json_response(self, {"error": f"Failed to write Redis state: {exc}"}, status=HTTPStatus.BAD_GATEWAY)
                return

        json_response(
            self,
            {
                "success": True,
                "task_id": task_id,
                "vehicle_id": vehicle_id,
                "task_type": task_type,
                "algorithms": ALGORITHMS,
                "results_url": f"/api/task-results/{task_id}",
            },
            status=HTTPStatus.CREATED,
        )


class DashboardServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int], RequestHandlerClass):
        super().__init__(server_address, RequestHandlerClass)
        self.redis_client = None


def main() -> None:
    redis_client = make_redis_client()
    server = DashboardServer((DEFAULT_HOST, DEFAULT_PORT), DashboardRequestHandler)
    server.redis_client = redis_client
    print(f"New-dashboard API listening on http://{DEFAULT_HOST}:{DEFAULT_PORT}")
    if redis_client is None:
        print("Redis client unavailable; serving demo-only fallback data.")
    else:
        try:
            pong = redis_client.ping()
            print(f"Redis connection: {'ok' if pong else 'unavailable'}")
        except Exception as exc:
            print(f"Redis connection failed: {exc}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Shutting down dashboard API.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()