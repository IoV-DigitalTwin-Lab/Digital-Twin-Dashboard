"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const vehicles_1 = __importDefault(require("./vehicles"));
const rsus_1 = __importDefault(require("./rsus"));
const tasks_1 = __importDefault(require("./tasks"));
const metrics_1 = __importDefault(require("./metrics"));
const router = (0, express_1.Router)();
router.use('/vehicles', vehicles_1.default);
router.use('/rsus', rsus_1.default);
router.use('/tasks', tasks_1.default);
router.use('/metrics', metrics_1.default);
router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
exports.default = router;
