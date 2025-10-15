"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_path_1 = __importDefault(require("node:path"));
const promises_1 = require("node:fs/promises");
const env_1 = require("../config/env");
const db_1 = require("../db");
async function runMigrations() {
    (0, env_1.loadEnv)();
    const pool = (0, db_1.getPool)();
    const sqlDir = node_path_1.default.resolve(__dirname, '..', '..', 'sql');
    const files = (await (0, promises_1.readdir)(sqlDir))
        .filter((file) => file.endsWith('.sql'))
        .sort();
    console.log(`Applying ${files.length} migration(s)...`);
    for (const file of files) {
        const fullPath = node_path_1.default.join(sqlDir, file);
        const sql = await (0, promises_1.readFile)(fullPath, 'utf-8');
        console.log(`\n>>> ${file}`);
        await pool.query(sql);
    }
    await pool.end();
    console.log('\nMigrations completed.');
}
runMigrations().catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
});
