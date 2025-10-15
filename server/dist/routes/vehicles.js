"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vehicleService_1 = require("../services/vehicleService");
const router = (0, express_1.Router)();
router.get('/', async (_req, res, next) => {
    try {
        const vehicles = await (0, vehicleService_1.getVehicleStates)();
        res.json(vehicles);
    }
    catch (error) {
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
        const vehicle = await (0, vehicleService_1.getVehicleState)(vehId);
        if (!vehicle) {
            res.status(404).json({ error: 'Vehicle not found' });
            return;
        }
        res.json(vehicle);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
