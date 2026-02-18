import { Router } from 'express';
import { getRsusFromRedis } from '../services/redisService';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const rsus = await getRsusFromRedis();
    res.json(rsus);
  } catch (error) {
    next(error);
  }
});

router.get('/:rsuId', async (req, res, next) => {
  try {
    const rsuId = Number.parseInt(req.params.rsuId, 10);
    if (Number.isNaN(rsuId)) {
      res.status(400).json({ error: 'rsuId must be a number' });
      return;
    }
    const rsus = await getRsusFromRedis();
    const rsu = rsus.find(r => r.rsuId === rsuId);
    if (!rsu) {
      res.status(404).json({ error: 'RSU not found' });
      return;
    }
    res.json(rsu);
  } catch (error) {
    next(error);
  }
});

export default router;
