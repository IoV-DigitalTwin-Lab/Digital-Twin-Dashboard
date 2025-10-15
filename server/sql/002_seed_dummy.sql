-- Dummy data set for local development --------------------------------------

-- Vehicles ------------------------------------------------------------------
INSERT INTO vehicles (veh_id, label, vehicle_type, cpu_capacity_mips, memory_mb,
                      battery_capacity_wh, max_parallel_tasks, communication_profile,
                      meta)
VALUES
    (101, 'Sedan-Red', 'sedan', 4500, 8192, 80.0, 2, '5G_NR', '{"vendor":"ACME","model":"XR-1"}'),
    (102, 'SUV-Blue', 'suv', 5200, 12288, 95.0, 3, '5G_NR', '{"vendor":"ACME","model":"XR-2"}'),
    (103, 'EV-Green', 'electric', 6000, 16384, 110.0, 4, 'DSRC', '{"vendor":"BetaMobility","model":"E-Prime"}')
ON CONFLICT (veh_id) DO UPDATE
SET label = EXCLUDED.label,
    vehicle_type = EXCLUDED.vehicle_type,
    cpu_capacity_mips = EXCLUDED.cpu_capacity_mips,
    memory_mb = EXCLUDED.memory_mb,
    battery_capacity_wh = EXCLUDED.battery_capacity_wh,
    max_parallel_tasks = EXCLUDED.max_parallel_tasks,
    communication_profile = EXCLUDED.communication_profile,
    meta = EXCLUDED.meta;

-- RSUs ----------------------------------------------------------------------
INSERT INTO rsus (rsu_id, label, latitude, longitude, pos_x, pos_y,
                  coverage_radius_m, cpu_capacity_mips, memory_mb, storage_gb,
                  backhaul_mbps, deployment_height_m, meta)
VALUES
    (201, 'RSU-North', 6.8001, 79.9002, -50.0, 90.0, 250.0, 12000, 32768, 256.0, 1000.0, 12.0, '{"zone":"north"}'),
    (202, 'RSU-Central', 6.7990, 79.9015, 0.0, 0.0, 300.0, 16000, 65536, 512.0, 1500.0, 15.0, '{"zone":"central"}'),
    (203, 'RSU-South', 6.7975, 79.9028, 50.0, -110.0, 200.0, 10000, 24576, 128.0, 800.0, 10.0, '{"zone":"south"}')
ON CONFLICT (rsu_id) DO UPDATE
SET label = EXCLUDED.label,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    pos_x = EXCLUDED.pos_x,
    pos_y = EXCLUDED.pos_y,
    coverage_radius_m = EXCLUDED.coverage_radius_m,
    cpu_capacity_mips = EXCLUDED.cpu_capacity_mips,
    memory_mb = EXCLUDED.memory_mb,
    storage_gb = EXCLUDED.storage_gb,
    backhaul_mbps = EXCLUDED.backhaul_mbps,
    deployment_height_m = EXCLUDED.deployment_height_m,
    meta = EXCLUDED.meta;

-- Vehicle telemetry ---------------------------------------------------------
INSERT INTO vehicle_telemetry (id, veh_id, sim_time, floc_hz, tx_power_mw, speed,
                               pos_x, pos_y, heading, acceleration, mac, payload,
                               received_at)
VALUES
    (1001, 101, 125.4, 5.0, 120.5, 14.2, -40.5, 82.1, 45.0, 0.4, 'AA:BB:CC:DD:EE:01', '{"lane":"N1"}', now() - interval '5 seconds'),
    (1002, 102, 125.4, 5.1, 118.0, 12.8, 2.0, 5.5, 90.0, 0.1, 'AA:BB:CC:DD:EE:02', '{"lane":"C3"}', now() - interval '7 seconds'),
    (1003, 103, 125.4, 4.8, 121.7, 10.5, 61.5, -95.0, 180.0, -0.2, 'AA:BB:CC:DD:EE:03', '{"lane":"S2"}', now() - interval '9 seconds')
ON CONFLICT (id) DO UPDATE
SET sim_time = EXCLUDED.sim_time,
    floc_hz = EXCLUDED.floc_hz,
    tx_power_mw = EXCLUDED.tx_power_mw,
    speed = EXCLUDED.speed,
    pos_x = EXCLUDED.pos_x,
    pos_y = EXCLUDED.pos_y,
    heading = EXCLUDED.heading,
    acceleration = EXCLUDED.acceleration,
    mac = EXCLUDED.mac,
    payload = EXCLUDED.payload,
    received_at = EXCLUDED.received_at;

-- RSU metrics ---------------------------------------------------------------
INSERT INTO rsu_metrics (id, rsu_id, sim_time, cpu_utilization, available_cpu_cycles,
                         memory_utilization, queue_length, connected_vehicle_count,
                         uplink_load_mbps, downlink_load_mbps, temperature_c, payload,
                         recorded_at)
VALUES
    (2001, 201, 125.4, 0.35, 7800, 0.40, 3, 4, 85.0, 60.0, 42.0, '{"notes":"nominal"}', now() - interval '8 seconds'),
    (2002, 202, 125.4, 0.55, 6200, 0.65, 7, 8, 140.0, 120.0, 44.0, '{"notes":"peak"}', now() - interval '5 seconds'),
    (2003, 203, 125.4, 0.25, 9000, 0.30, 2, 3, 60.0, 55.0, 41.0, '{"notes":"idle"}', now() - interval '6 seconds')
ON CONFLICT (id) DO UPDATE
SET sim_time = EXCLUDED.sim_time,
    cpu_utilization = EXCLUDED.cpu_utilization,
    available_cpu_cycles = EXCLUDED.available_cpu_cycles,
    memory_utilization = EXCLUDED.memory_utilization,
    queue_length = EXCLUDED.queue_length,
    connected_vehicle_count = EXCLUDED.connected_vehicle_count,
    uplink_load_mbps = EXCLUDED.uplink_load_mbps,
    downlink_load_mbps = EXCLUDED.downlink_load_mbps,
    temperature_c = EXCLUDED.temperature_c,
    payload = EXCLUDED.payload,
    recorded_at = EXCLUDED.recorded_at;

-- Edge tasks ----------------------------------------------------------------
INSERT INTO edge_tasks (task_id, task_code, origin_vehicle_id, origin_rsu_id,
                        cpu_cycles_required, data_size_mb, deadline_s,
                        earliest_start_s, qos_requirement, created_sim_time,
                        created_at, status, payload)
VALUES
    (3001, 'IMG-PROC', 101, 201, 1500000000, 45.0, 160.0, 125.0, 'latency<100ms', 124.8, now() - interval '3 minutes', 'assigned', '{"type":"image"}'),
    (3002, 'PRED-ETA', 102, 202, 750000000, 20.0, 135.0, 125.3, 'latency<80ms', 125.1, now() - interval '2 minutes', 'executing', '{"type":"prediction"}'),
    (3003, 'MAP-UPDATE', 103, 203, 500000000, 15.0, 200.0, 125.2, 'reliability>99%', 125.0, now() - interval '90 seconds', 'pending', '{"type":"map"}')
ON CONFLICT (task_id) DO UPDATE
SET task_code = EXCLUDED.task_code,
    origin_vehicle_id = EXCLUDED.origin_vehicle_id,
    origin_rsu_id = EXCLUDED.origin_rsu_id,
    cpu_cycles_required = EXCLUDED.cpu_cycles_required,
    data_size_mb = EXCLUDED.data_size_mb,
    deadline_s = EXCLUDED.deadline_s,
    earliest_start_s = EXCLUDED.earliest_start_s,
    qos_requirement = EXCLUDED.qos_requirement,
    created_sim_time = EXCLUDED.created_sim_time,
    created_at = EXCLUDED.created_at,
    status = EXCLUDED.status,
    payload = EXCLUDED.payload;

-- Task assignments ----------------------------------------------------------
INSERT INTO task_assignments (assignment_id, task_id, assigned_vehicle_id,
                              assigned_rsu_id, assigned_sim_time, accepted_sim_time,
                              started_sim_time, completed_sim_time, offloaded,
                              offload_target, energy_cost_j, latency_ms, status,
                              created_at, updated_at)
VALUES
    (4001, 3001, 101, 201, 125.0, 125.05, NULL, NULL, FALSE, NULL, 25.0, 95.0, 'accepted', now() - interval '3 minutes', now() - interval '90 seconds'),
    (4002, 3002, 102, 202, 125.2, 125.25, 125.3, NULL, TRUE, 'RSU-Edge-02', 32.5, 70.0, 'executing', now() - interval '2 minutes', now() - interval '45 seconds'),
    (4003, 3003, 103, 203, 125.22, NULL, NULL, NULL, FALSE, NULL, 12.0, NULL, 'pending', now() - interval '90 seconds', now() - interval '30 seconds')
ON CONFLICT (assignment_id) DO UPDATE
SET assigned_vehicle_id = EXCLUDED.assigned_vehicle_id,
    assigned_rsu_id = EXCLUDED.assigned_rsu_id,
    assigned_sim_time = EXCLUDED.assigned_sim_time,
    accepted_sim_time = EXCLUDED.accepted_sim_time,
    started_sim_time = EXCLUDED.started_sim_time,
    completed_sim_time = EXCLUDED.completed_sim_time,
    offloaded = EXCLUDED.offloaded,
    offload_target = EXCLUDED.offload_target,
    energy_cost_j = EXCLUDED.energy_cost_j,
    latency_ms = EXCLUDED.latency_ms,
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;

-- Alerts --------------------------------------------------------------------
INSERT INTO system_alerts (alert_id, severity, category, message, detail,
                           veh_id, rsu_id, triggered_sim_time, triggered_at,
                           acknowledged)
VALUES
    (5001, 'warning', 'deadline', 'Task IMG-PROC nearing deadline', '{"task_id":3001}', 101, 201, 155.0, now() - interval '45 seconds', FALSE),
    (5002, 'critical', 'resource', 'RSU Central CPU > 80%', '{"cpu_utilization":0.82}', NULL, 202, 126.0, now() - interval '30 seconds', FALSE),
    (5003, 'info', 'handover', 'Vehicle SUV-Blue entering Central zone', '{"veh_id":102}', 102, 202, 125.2, now() - interval '70 seconds', TRUE)
ON CONFLICT (alert_id) DO UPDATE
SET severity = EXCLUDED.severity,
    category = EXCLUDED.category,
    message = EXCLUDED.message,
    detail = EXCLUDED.detail,
    veh_id = EXCLUDED.veh_id,
    rsu_id = EXCLUDED.rsu_id,
    triggered_sim_time = EXCLUDED.triggered_sim_time,
    triggered_at = EXCLUDED.triggered_at,
    acknowledged = EXCLUDED.acknowledged;
