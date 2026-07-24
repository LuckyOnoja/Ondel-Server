"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisCache = exports.upstashRedis = void 0;
const redis_1 = require("@upstash/redis");
const ioredis_1 = __importDefault(require("ioredis"));
const env_js_1 = require("./env.js");
// Upstash REST Client (for HTTP API compatibility)
exports.upstashRedis = env_js_1.env.UPSTASH_REDIS_REST_URL && env_js_1.env.UPSTASH_REDIS_REST_TOKEN
    ? new redis_1.Redis({
        url: env_js_1.env.UPSTASH_REDIS_REST_URL,
        token: env_js_1.env.UPSTASH_REDIS_REST_TOKEN,
    })
    : null;
// ioredis client (for TCP TLS connection)
let ioRedisClient = null;
if (env_js_1.env.REDIS_URL) {
    try {
        ioRedisClient = new ioredis_1.default(env_js_1.env.REDIS_URL, {
            tls: env_js_1.env.REDIS_URL.includes('rediss://') || env_js_1.env.REDIS_URL.includes('upstash.io') ? {} : undefined,
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 5)
                    return null;
                return Math.min(times * 100, 2000);
            },
        });
        ioRedisClient.on('error', (err) => {
            console.warn('⚠️ [Redis TCP] Connection warning/error:', err.message);
        });
        ioRedisClient.on('connect', () => {
            console.log('✅ [Redis TCP] Connected successfully to Upstash Redis');
        });
    }
    catch (err) {
        console.warn('⚠️ [Redis TCP] Setup error:', err);
    }
}
/**
 * Unified Redis helper that works across HTTP (Upstash REST) or TCP (ioredis).
 * Ensures your caching, rate-limiting, and OTP storage are zero-downtime!
 */
exports.redisCache = {
    async get(key) {
        try {
            if (exports.upstashRedis) {
                const val = await exports.upstashRedis.get(key);
                if (val === null || val === undefined)
                    return null;
                return typeof val === 'object' ? JSON.stringify(val) : String(val);
            }
            if (ioRedisClient) {
                return await ioRedisClient.get(key);
            }
        }
        catch (err) {
            console.error(`[Redis GET error] for key ${key}:`, err);
        }
        return null;
    },
    async set(key, value, ttlSeconds) {
        try {
            if (exports.upstashRedis) {
                if (ttlSeconds) {
                    await exports.upstashRedis.set(key, value, { ex: ttlSeconds });
                }
                else {
                    await exports.upstashRedis.set(key, value);
                }
                return true;
            }
            if (ioRedisClient) {
                if (ttlSeconds) {
                    await ioRedisClient.set(key, value, 'EX', ttlSeconds);
                }
                else {
                    await ioRedisClient.set(key, value);
                }
                return true;
            }
        }
        catch (err) {
            console.error(`[Redis SET error] for key ${key}:`, err);
        }
        return false;
    },
    async del(key) {
        try {
            if (exports.upstashRedis) {
                await exports.upstashRedis.del(key);
                return true;
            }
            if (ioRedisClient) {
                await ioRedisClient.del(key);
                return true;
            }
        }
        catch (err) {
            console.error(`[Redis DEL error] for key ${key}:`, err);
        }
        return false;
    },
    async incr(key) {
        try {
            if (exports.upstashRedis) {
                return await exports.upstashRedis.incr(key);
            }
            if (ioRedisClient) {
                return await ioRedisClient.incr(key);
            }
        }
        catch (err) {
            console.error(`[Redis INCR error] for key ${key}:`, err);
        }
        return 1;
    },
    async expire(key, ttlSeconds) {
        try {
            if (exports.upstashRedis) {
                await exports.upstashRedis.expire(key, ttlSeconds);
                return true;
            }
            if (ioRedisClient) {
                await ioRedisClient.expire(key, ttlSeconds);
                return true;
            }
        }
        catch (err) {
            console.error(`[Redis EXPIRE error] for key ${key}:`, err);
        }
        return false;
    },
};
