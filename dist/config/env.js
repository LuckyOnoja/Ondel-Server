"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(process.cwd(), '.env') });
exports.env = {
    PORT: process.env.PORT || '8000',
    NODE_ENV: process.env.NODE_ENV || 'development',
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || '',
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    JWT_SECRET: process.env.JWT_SECRET || 'fallback-secret-key-ondel-2026',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    EMAIL_USER: process.env.EMAIL_USER || '',
    EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || '',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:19006',
};
