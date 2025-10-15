-- Base entities ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vehicles (
    veh_id INTEGER PRIMARY KEY,
    label TEXT,
    vehicle_type TEXT,
    cpu_capacity_mips DOUBLE PRECISION,
    memory_mb INTEGER,
    battery_capacity_wh DOUBLE PRECISION,
    max_parallel_tasks INTEGER,
    communication_profile TEXT, --------------
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    meta JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS rsus (
    rsu_id SERIAL PRIMARY KEY,
    label TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    pos_x DOUBLE PRECISION,
    pos_y DOUBLE PRECISION,
    coverage_radius_m DOUBLE PRECISION,
    cpu_capacity_mips DOUBLE PRECISION,
    memory_mb INTEGER,
    storage_gb DOUBLE PRECISION,
    backhaul_mbps DOUBLE PRECISION,
    deployment_height_m DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    meta JSONB DEFAULT '{}'::jsonb
);

-- Time-series telemetry ----------------------------------------------------

CREATE TABLE IF NOT EXISTS vehicle_telemetry (
    id BIGSERIAL PRIMARY KEY,
    veh_id INTEGER REFERENCES vehicles (veh_id),
    sim_time DOUBLE PRECISION, --------------
    floc_hz DOUBLE PRECISION, ------------
    tx_power_mw DOUBLE PRECISION, ------------
    speed DOUBLE PRECISION,
    pos_x DOUBLE PRECISION,
    pos_y DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    acceleration DOUBLE PRECISION, ------------
    mac TEXT,  ------------
    payload JSONB DEFAULT '{}'::jsonb,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_telemetry_veh_time ON vehicle_telemetry (veh_id, sim_time DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_telemetry_mac_time ON vehicle_telemetry (mac, sim_time DESC);

CREATE TABLE IF NOT EXISTS rsu_metrics (
    id BIGSERIAL PRIMARY KEY,
    rsu_id INTEGER REFERENCES rsus (rsu_id) ON DELETE CASCADE,
    sim_time DOUBLE PRECISION,
    cpu_utilization DOUBLE PRECISION,
    available_cpu_cycles DOUBLE PRECISION,
    memory_utilization DOUBLE PRECISION,
    queue_length INTEGER,
    connected_vehicle_count INTEGER,
    uplink_load_mbps DOUBLE PRECISION,
    downlink_load_mbps DOUBLE PRECISION,
    temperature_c DOUBLE PRECISION,
    payload JSONB DEFAULT '{}'::jsonb,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rsu_metrics_time ON rsu_metrics (rsu_id, sim_time DESC);

-- Task model ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS edge_tasks (
    task_id BIGSERIAL PRIMARY KEY,
    task_code TEXT,  -----------
    origin_vehicle_id INTEGER REFERENCES vehicles (veh_id),
    origin_rsu_id INTEGER REFERENCES rsus (rsu_id), ---------
    cpu_cycles_required BIGINT NOT NULL,
    data_size_mb DOUBLE PRECISION,
    deadline_s DOUBLE PRECISION,
    earliest_start_s DOUBLE PRECISION, -------------
    qos_requirement TEXT, ---------
    created_sim_time DOUBLE PRECISION, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','assigned','executing','completed','failed','expired')),
    payload JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_edge_tasks_status_deadline ON edge_tasks (status, deadline_s);


-----this is just to visualize-------
CREATE TABLE IF NOT EXISTS task_assignments (
    assignment_id BIGSERIAL PRIMARY KEY,
    task_id BIGINT REFERENCES edge_tasks (task_id) ON DELETE CASCADE,
    assigned_vehicle_id INTEGER REFERENCES vehicles (veh_id),
    assigned_rsu_id INTEGER REFERENCES rsus (rsu_id),
    assigned_sim_time DOUBLE PRECISION,
    accepted_sim_time DOUBLE PRECISION,
    started_sim_time DOUBLE PRECISION,
    completed_sim_time DOUBLE PRECISION,
    offloaded BOOLEAN DEFAULT FALSE,
    offload_target TEXT,
    energy_cost_j DOUBLE PRECISION,
    latency_ms DOUBLE PRECISION,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','executing','completed','failed','expired','rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
---------------------------------------

CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments (task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_vehicle ON task_assignments (assigned_vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_task_assignments_rsu ON task_assignments (assigned_rsu_id, status);

-- Alerting -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS system_alerts (
    alert_id BIGSERIAL PRIMARY KEY,
    severity TEXT CHECK (severity IN ('info','warning','critical')),
    category TEXT,
    message TEXT NOT NULL,
    detail JSONB DEFAULT '{}'::jsonb,
    veh_id INTEGER REFERENCES vehicles (veh_id),
    rsu_id INTEGER REFERENCES rsus (rsu_id),
    triggered_sim_time DOUBLE PRECISION,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_system_alerts_active ON system_alerts (acknowledged, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_vehicle ON system_alerts (veh_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_alerts_rsu ON system_alerts (rsu_id, triggered_at DESC);

-- Notification plumbing ----------------------------------------------------

CREATE OR REPLACE FUNCTION notify_channel(channel TEXT, payload JSONB)
RETURNS VOID AS $$
BEGIN
    PERFORM pg_notify(channel, payload::text);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION emit_row_change()
RETURNS TRIGGER AS $$
DECLARE
    channel_name TEXT := TG_ARGV[0];
    body JSONB;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        body := row_to_json(OLD);
    ELSE
        body := row_to_json(NEW);
    END IF;
    PERFORM notify_channel(channel_name, jsonb_build_object('op', TG_OP, 'table', TG_TABLE_NAME, 'data', body));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vehicle_telemetry_notify ON vehicle_telemetry;
CREATE TRIGGER trg_vehicle_telemetry_notify
AFTER INSERT ON vehicle_telemetry
FOR EACH ROW
EXECUTE FUNCTION emit_row_change('vehicle_telemetry_events');

DROP TRIGGER IF EXISTS trg_rsu_metrics_notify ON rsu_metrics;
CREATE TRIGGER trg_rsu_metrics_notify
AFTER INSERT ON rsu_metrics
FOR EACH ROW
EXECUTE FUNCTION emit_row_change('rsu_metrics_events');

DROP TRIGGER IF EXISTS trg_edge_tasks_notify ON edge_tasks;
CREATE TRIGGER trg_edge_tasks_notify
AFTER INSERT OR UPDATE ON edge_tasks
FOR EACH ROW
EXECUTE FUNCTION emit_row_change('edge_task_events');

DROP TRIGGER IF EXISTS trg_task_assignments_notify ON task_assignments;
CREATE TRIGGER trg_task_assignments_notify
AFTER INSERT OR UPDATE ON task_assignments
FOR EACH ROW
EXECUTE FUNCTION emit_row_change('task_assignment_events');

DROP TRIGGER IF EXISTS trg_alerts_notify ON system_alerts;
CREATE TRIGGER trg_alerts_notify
AFTER INSERT ON system_alerts
FOR EACH ROW
EXECUTE FUNCTION emit_row_change('system_alert_events');
