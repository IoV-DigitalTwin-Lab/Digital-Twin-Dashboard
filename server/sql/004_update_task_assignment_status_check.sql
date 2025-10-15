ALTER TABLE task_assignments
    DROP CONSTRAINT IF EXISTS task_assignments_status_check;

ALTER TABLE task_assignments
    ADD CONSTRAINT task_assignments_status_check
    CHECK (status IN ('pending','assigned','accepted','executing','completed','failed','expired','rejected'));
