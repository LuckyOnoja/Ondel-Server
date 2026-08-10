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
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:19006',
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
    SMTP_HOST: process.env.SMTP_HOST || 'smtppro.zoho.com',
    SMTP_PORT: Number(process.env.SMTP_PORT || 465),
    SMTP_USER: process.env.SMTP_USER || '',
    SMTP_PASS: process.env.SMTP_PASS || '',
    SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'Ondel Music',
    IMAP_HOST: process.env.IMAP_HOST || 'imap.zoho.com',
    IMAP_PORT: Number(process.env.IMAP_PORT || 993),
    IMAP_USER: process.env.IMAP_USER || process.env.SMTP_USER || '',
    IMAP_PASS: process.env.IMAP_PASS || process.env.SMTP_PASS || '',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
    IMAP_POLL_INTERVAL_MINUTES: Number(process.env.IMAP_POLL_INTERVAL_MINUTES || 5),
    SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
    SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
};
