"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const metricsService_1 = require("../services/metricsService");
const router = (0, express_1.Router)();
router.get('/dashboard', async (_req, res, next) => {
    try {
        const metrics = await (0, metricsService_1.getDashboardMetrics)();
        res.json(metrics);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
