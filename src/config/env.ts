import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const env = {
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
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.zoho.com',
  SMTP_PORT: Number(process.env.SMTP_PORT || 465),
  SMTP_USER: process.env.SMTP_USER || process.env.EMAIL_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || '',
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'Ondel Music Promotion',
  IMAP_HOST: process.env.IMAP_HOST || 'imap.zoho.com',
  IMAP_PORT: Number(process.env.IMAP_PORT || 993),
  IMAP_USER: process.env.IMAP_USER || process.env.EMAIL_USER || '',
  IMAP_PASS: process.env.IMAP_PASS || process.env.EMAIL_PASSWORD || '',
  IMAP_POLL_INTERVAL_MINUTES: Number(process.env.IMAP_POLL_INTERVAL_MINUTES || 5),
};
