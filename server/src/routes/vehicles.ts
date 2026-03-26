import { Router } from 'express';
import { getVehicleState, getVehicleStates } from '../services/vehicleService';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const vehicles = await getVehicleStates();
    res.json(vehicles);
  } catch (error) {
    next(error);
  }
});

router.get('/:vehId', async (req, res, next) => {
  try {
    const vehId = Number.parseInt(req.params.vehId, 10);
    if (Number.isNaN(vehId)) {
      res.status(400).json({ error: 'vehId must be a number' });
      return;
    }
    const vehicle = await getVehicleState(vehId);
    if (!vehicle) {
      res.status(404).json({ error: 'Vehicle not found' });
      return;
    }
    res.json(vehicle);
  } catch (error) {
    next(error);
  }
});

export default router;
