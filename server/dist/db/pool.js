"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = getPool;
const pg_1 = require("pg");
let pool;
function getPool() {
    if (!pool) {
        pool = new pg_1.Pool({
            connectionString: process.env.DATABASE_URL,
            host: process.env.PGHOST,
            port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
            database: process.env.PGDATABASE,
            user: process.env.PGUSER,
            password: process.env.PGPASSWORD,
            max: process.env.PGPOOL_MAX ? Number(process.env.PGPOOL_MAX) : 10,
            idleTimeoutMillis: 30000,
            application_name: 'dt-realtime-server',
        });
    }
    return pool;
}
