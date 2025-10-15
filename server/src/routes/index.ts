import { Router } from 'express';
import vehicleRouter from './vehicles';
import rsuRouter from './rsus';
import tasksRouter from './tasks'
import metricsRouter from './metrics';

const router = Router();

router.use('/vehicles', vehicleRouter);
router.use('/rsus', rsuRouter);
router.use('/tasks', tasksRouter);
router.use('/metrics', metricsRouter);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;
