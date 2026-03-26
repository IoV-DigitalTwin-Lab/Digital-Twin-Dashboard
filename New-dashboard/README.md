# IoV Digital Twin Dashboard — Setup Guide

## Files
```
convert_map.py   — one-time: converts erlangen.net.xml → map.geojson
bridge.py        — runs alongside simulation: Redis → WebSocket
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
- By default, the bridge reads Redis DBs `0,1,2` (matching RSU redisDb split).
- Override DB list when needed:
  `REDIS_DBS=0,1,2 python bridge.py`

## Step 3 — Start the WebSocket bridge

```bash
pip install redis websockets
# Optional override if your run uses different Redis DBs
# REDIS_DBS=0,1,2 python bridge.py
python bridge.py
```

## Step 4 — Serve and open the dashboard

```bash
# Serve from the directory containing index.html and map.geojson
cd /path/to/dashboard
python -m http.server 8080
```

Open http://localhost:8080 in a browser alongside QtEnv.

## Notes

- The dashboard auto-reconnects to the WebSocket if the bridge restarts.
- Comm lines on the map appear/disappear automatically based on task state.
- Clicking any vehicle/RSU marker on the map or any task in the sidebar
  updates the resource panel on the right.
- The SUMO coordinate → lat/lon conversion in index.html uses the offset
  exported by convert_map.py. If positions look wrong, check that
  sumo_offset in map.geojson is correct for your network.
- For offline demo: replace the OSM tile URL in index.html with a local
  tile server, or remove the tile layer entirely — the GeoJSON road
  network renders without tiles.
