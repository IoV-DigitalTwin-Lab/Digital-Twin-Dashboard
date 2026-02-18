"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisClient = getRedisClient;
exports.closeRedis = closeRedis;
const ioredis_1 = __importDefault(require("ioredis"));
let redisClient = null;
function getRedisClient() {
    if (!redisClient) {
        const redisHost = process.env.REDIS_HOST || '127.0.0.1';
        const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
        redisClient = new ioredis_1.default({
            host: redisHost,
            port: redisPort,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
        });
        redisClient.on('connect', () => {
            console.log(`Redis connected to ${redisHost}:${redisPort}`);
        });
        redisClient.on('error', (err) => {
            console.error('Redis client error:', err);
        });
        redisClient.on('close', () => {
            console.log('Redis connection closed');
        });
    }
    return redisClient;
}
async function closeRedis() {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}
