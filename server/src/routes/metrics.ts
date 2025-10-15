import { Router } from 'express';
import { getDashboardMetrics } from '../services/metricsService';

const router = Router();

router.get('/dashboard', async (_req, res, next) => {
  try {
    const metrics = await getDashboardMetrics();
    res.json(metrics);
  } catch (error) {
    next(error);
  }
});

export default router;
