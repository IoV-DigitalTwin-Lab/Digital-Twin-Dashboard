"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPool = void 0;
exports.query = query;
const pool_1 = require("./pool");
async function query(text, params = []) {
    const pool = (0, pool_1.getPool)();
    return pool.query(text, params);
}
var pool_2 = require("./pool");
Object.defineProperty(exports, "getPool", { enumerable: true, get: function () { return pool_2.getPool; } });
