"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const taskService_1 = require("../services/taskService");
const router = (0, express_1.Router)();
router.get('/', async (_req, res, next) => {
    try {
        const tasks = await (0, taskService_1.getActiveTasks)();
        res.json(tasks);
    }
    catch (error) {
        next(error);
    }
});
router.get('/timeline', async (req, res, next) => {
    try {
        const limitParam = req.query.limit;
        const limit = typeof limitParam === 'string' ? Number.parseInt(limitParam, 10) : 100;
        const safeLimit = Number.isNaN(limit) ? 100 : Math.min(Math.max(limit, 1), 500);
        const timeline = await (0, taskService_1.getTaskTimeline)(safeLimit);
        res.json(timeline);
    }
    catch (error) {
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
        const task = await (0, taskService_1.getTaskDetail)(taskId);
        if (!task) {
            res.status(404).json({ error: 'Task not found' });
            return;
        }
        res.json(task);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
