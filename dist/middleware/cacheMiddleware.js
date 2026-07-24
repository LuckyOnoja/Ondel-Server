"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheResponse = cacheResponse;
const redis_js_1 = require("../config/redis.js");
/**
 * Express middleware to cache GET responses in Upstash Redis.
 * @param ttlSeconds Cache expiration time in seconds (default: 60s)
 */
function cacheResponse(ttlSeconds = 60) {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            next();
            return;
        }
        const cacheKey = `cache:${req.originalUrl || req.url}`;
        try {
            const cachedData = await redis_js_1.redisCache.get(cacheKey);
            if (cachedData) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Content-Type', 'application/json');
                res.send(cachedData);
                return;
            }
            res.setHeader('X-Cache', 'MISS');
            const originalJson = res.json.bind(res);
            res.json = (body) => {
                // Cache successful responses asynchronously
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    redis_js_1.redisCache.set(cacheKey, JSON.stringify(body), ttlSeconds).catch((err) => {
                        console.warn('[CacheMiddleware warning] Failed to set cache:', err);
                    });
                }
                return originalJson(body);
            };
            next();
        }
        catch (err) {
            console.warn('[CacheMiddleware error]:', err);
            next();
        }
    };
}
