"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnv = loadEnv;
const dotenv_1 = require("dotenv");
let loaded = false;
function loadEnv() {
    if (loaded) {
        return;
    }
    const result = (0, dotenv_1.config)();
    if (result.error) {
        console.warn('Warning: unable to load .env file:', result.error);
    }
    loaded = true;
}
