import { Router } from 'express';
import { getRsu, getRsus } from '../services/rsuService';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const rsus = await getRsus();
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
    const rsu = await getRsu(rsuId);
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
