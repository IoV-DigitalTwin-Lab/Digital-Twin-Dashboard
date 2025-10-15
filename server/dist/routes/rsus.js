"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rsuService_1 = require("../services/rsuService");
const router = (0, express_1.Router)();
router.get('/', async (_req, res, next) => {
    try {
        const rsus = await (0, rsuService_1.getRsus)();
        res.json(rsus);
    }
    catch (error) {
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
        const rsu = await (0, rsuService_1.getRsu)(rsuId);
        if (!rsu) {
            res.status(404).json({ error: 'RSU not found' });
            return;
        }
        res.json(rsu);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
