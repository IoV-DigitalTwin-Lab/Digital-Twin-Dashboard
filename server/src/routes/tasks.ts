import { Router } from 'express';
import { getActiveTasks, getTaskDetail, getTaskTimeline } from '../services/taskService';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const tasks = await getActiveTasks();
    res.json(tasks);
  } catch (error) {
    next(error);
  }
});

router.get('/timeline', async (req, res, next) => {
  try {
    const limitParam = req.query.limit;
    const limit = typeof limitParam === 'string' ? Number.parseInt(limitParam, 10) : 100;
    const safeLimit = Number.isNaN(limit) ? 100 : Math.min(Math.max(limit, 1), 500);
    const timeline = await getTaskTimeline(safeLimit);
    res.json(timeline);
  } catch (error) {
    next(error);
  }
});

router.get('/:taskId', async (req, res, next) => {
  try {
    const taskId = Number.parseInt(req.params.taskId, 10);
    if (Number.isNaN(taskId)) {
      res.status(400).json({ error: 'taskId must be a number' });
      return;
    }
    const task = await getTaskDetail(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(task);
  } catch (error) {
    next(error);
  }
});

export default router;
