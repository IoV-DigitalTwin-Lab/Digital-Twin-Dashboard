ALTER TABLE edge_tasks
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

CREATE OR REPLACE FUNCTION set_edge_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_edge_tasks_updated_at ON edge_tasks;
CREATE TRIGGER trg_edge_tasks_updated_at
BEFORE UPDATE ON edge_tasks
FOR EACH ROW
EXECUTE FUNCTION set_edge_tasks_updated_at();
