# IoV Digital Twin Dashboard — Setup Guide

## Files
```
convert_map.py   — one-time: converts erlangen.net.xml → map.geojson
bridge.py        — runs alongside simulation: Redis → WebSocket
dashboard_api.py — serves the HTML dashboard and the task injection API
index.html       — the dashboard (open in browser)
```

## Step 1 — Convert the map (run once)

```bash
pip install sumolib

python convert_map.py \
  --net  /path/to/veins/subprojects/veins/examples/veins/erlangen.net.xml \
  --poly /path/to/veins/subprojects/veins/examples/veins/erlangen.poly.xml \
  --out  map.geojson
```

Copy the output `map.geojson` into the same folder as `index.html`.

## Step 2 — Redis key conventions (current simulation)

This dashboard bridge is now aligned with the current
`IoV-Digital-Twin-TaskOffloading` Redis schema.

### Vehicle and RSU hashes written by simulation
```
HSET vehicle:<vehicle_id>:state \
  pos_x <x> pos_y <y> speed <mps> heading <deg> \
  cpu_available <v> cpu_utilization <v> \
  mem_available <v> mem_utilization <v> \
  queue_length <n> processing_count <n> last_update <sim_time>

HSET rsu:<rsu_id>:resources \
  cpu_available <v> memory_available <v> \
  queue_length <n> processing_count <n> update_time <sim_time> \
  pos_x <x> pos_y <y>
```

### Task hashes written by simulation
```
HSET task:<task_id>:state \
  vehicle_id <vehicle_id> status <status> \
  decision_type <LOCAL|RSU|SERVICE_VEHICLE> target_id <id>

HSET task:<task_id>:request \
  task_id <id> vehicle_id <id> rsu_id <id> ...
```

### Important behavior
- No `PUBLISH task:events` is required.
- `bridge.py` polls task hashes and emits synthetic WebSocket `task_event` updates.
- By default, the bridge connects to `localhost:6379` and reads Redis DBs `0,1,2`.
- Override endpoint/DBs when needed:
  `REDIS_HOST=localhost REDIS_PORT=16379 REDIS_DBS=0,1,2 python bridge.py`

## Step 3 — Start the WebSocket bridge

```bash
pip install redis websockets
# Optional override if your run uses different Redis DBs
# REDIS_DBS=0,1,2 python bridge.py
python bridge.py
```

## Step 4 — Start the dashboard API server

```bash
pip install redis
python dashboard_api.py
```

This server listens on `http://localhost:8090` by default and exposes:

- `GET /api/active-vehicles`
- `GET /api/task-types`
- `POST /api/inject-task`

The API gathers live vehicles from the configured Redis DB list, so the
injection dropdown will include vehicles stored across DBs `0,1,2` by
default.
- `GET /api/task-results/<task_id>`

## Step 5 — Open the dashboard

Open `http://localhost:8090` in a browser.

Keep the dashboard API and `bridge.py` running alongside the simulator.

## Notes

- The dashboard auto-reconnects to the WebSocket if the bridge restarts.
- Comm lines on the map appear/disappear automatically based on task state.
- The new task injection panel keeps the vehicle dropdown live by polling the dashboard API.
- The algorithm summary shows DDQN result card for the selected injected task.
- Clicking any vehicle/RSU marker on the map or any task in the sidebar
  updates the resource panel on the right.
- The SUMO coordinate → lat/lon conversion in index.html uses the offset
  exported by convert_map.py. If positions look wrong, check that
  sumo_offset in map.geojson is correct for your network.
- For offline demo: replace the OSM tile URL in index.html with a local
  tile server, or remove the tile layer entirely — the GeoJSON road
  network renders without tiles.

## Implementation Plan — Redis-driven task pipeline

This dashboard should no longer inject tasks directly from `index.html`.
Task creation happens in OMNeT++ Qtenv, and the dashboard becomes a live
observer of the full task lifecycle through Redis and the WebSocket bridge.

### Target flow

1. A user manually triggers a task in Qtenv on the simulation side.
2. The vehicle application emits a manual task log and creates the task.
3. The vehicle sends task metadata to the RSU.
4. The RSU stores state in Redis and forwards the task into the offloading pipeline.
5. The DRL/offloading decision logic reads the Redis state and selects either an RSU or a service vehicle.
6. Task data is forwarded to the selected processing node.
7. Results are returned to the origin vehicle.
8. The RSU and vehicle state are updated in Redis at each transition.
9. The dashboard consumes those Redis changes through `bridge.py` and renders them in real time.

### Manual-task assurance

For manually generated tasks, the dashboard should not assume success just
because the task was triggered. It should confirm each transition from the
simulation-side logs and Redis state so the full lifecycle is observable even
when a message is delayed or fails.

- The first proof point is the manual-task log emitted by the vehicle app.
- The next proof point is the task metadata write reaching the RSU.
- The next proof point is the Redis state for the task moving through each
  offloading stage.
- The final proof point is the result status and completion update returning
  to the origin vehicle.

If any transition is missing, the dashboard should show the task as pending or
failed instead of assuming the transfer happened.

### Dashboard responsibilities

- Remove any task-injection controls from `index.html`.
- Keep the dashboard read-only for simulation control.
- Visualize task metadata, task-data transfer, result return, and completion.
- Render the offloading decision in the right-side panel:
  - decision target: RSU ID or service vehicle ID
  - task latency
  - energy usage
  - status: success / failure
  - current processing state
- Show communication legs on the map as animated paths:
  - vehicle → RSU for metadata
  - RSU → vehicle for decision return
  - vehicle → target node for task data
  - target node → vehicle for result return

### Packet-transfer visualization

Task-related packet transfers should stand out visually from the rest of the
network traffic. Use a separate, high-contrast line style for the manual-task
pipeline so the user can see the exact path of the task lifecycle in real time.

- Metadata transfer lines: red or another warning color.
- Task-data transfer lines: a second distinct color with the same high-contrast
  treatment.
- Result-return lines: a third distinct color so completion is easy to spot.
- Non-task background traffic should remain visually subdued.

The key requirement is that the dashboard clearly differentiates the manual-task
packet path from normal mobility or background traffic.

### Redis data requirements

The bridge should observe these state transitions from Redis instead of
inventing task state locally.

- Task submission and metadata write
- Offloading decision write
- Task processing start / completion write
- Result return write
- RSU resource update write
- Vehicle resource update write

If a piece of state is missing, the bridge should treat it as an error or
pending state rather than silently assuming success.

### WebSocket / bridge behavior

- Extend `bridge.py` so each Redis change is converted into a structured
  `task_event` message.
- Preserve ordering of task events so the dashboard can animate the full
  chain in the correct sequence.
- Include enough identifiers for the UI to correlate events:
  - `task_id`
  - `vehicle_id`
  - `rsu_id`
  - `decision_type`
  - `target_id`
  - `status`
  - `latency`
  - `energy`
- Keep the WebSocket feed focused on state changes, not simulation control.

### Expected UI output

- Markers on the map update in real time as vehicles move.
- Communication lines appear when task metadata, task data, and result
  messages are in flight.
- The sidebar task list shows current state per task.
- The selected-entity panel shows:
  - current offloading decision
  - target node type and ID
  - latency
  - energy
  - status
  - queue / processing indicators
  - whether each task-transfer leg has succeeded or failed

### Acceptance criteria

- The dashboard does not generate tasks itself.
- A manually triggered task in Qtenv appears in the dashboard without
  requiring a dashboard-side button.
- The full metadata → decision → task-data → result flow is visible.
- The selected task/entity panel reflects Redis-backed values in real time.
- Success and failure are both visible in the UI and traceable in logs.

### Out of scope for this change

- No new dashboard-side task creation UI.
- No changes to the simulation logic in this README phase.
- No new Redis schema definition here; this document assumes the existing
  simulation-side keys will be extended or reused consistently.
