export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'rejected';

export interface TaskSummary {
  taskId: number;
  taskCode: string | null;
  status: TaskStatus;
  deadlineSeconds: number | null;
  cpuCyclesRequired: number;
  assignedVehicleId: number | null;
  assignedRsuId: number | null;
  latencyMs: number | null;
  offloaded: boolean;
  offloadTarget: string | null;
  createdSimTime: number | null;
  assignedSimTime: number | null;
  startedSimTime: number | null;
  completedSimTime: number | null;
}

export interface TaskDetail extends TaskSummary {
  originVehicleId: number | null;
  originRsuId: number | null;
  dataSizeMb: number | null;
  earliestStartS: number | null;
  qosRequirement: string | null;
  createdAt: string;
  payload: Record<string, unknown> | null;
}
