"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginRateLimiter = exports.otpRateLimiter = void 0;
exports.createRateLimiter = createRateLimiter;
const redis_js_1 = require("../config/redis.js");
/**
 * Custom Redis-backed rate limiter middleware.
 * Prevents brute-force attacks, spam OTPs, and rapid duplicate logins.
 */
function createRateLimiter(options) {
    const { windowSeconds, maxRequests, keyPrefix = 'rl' } = options;
    return async (req, res, next) => {
        try {
            const clientIp = (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].trim();
            const identifier = req.body?.email ? `${clientIp}:${req.body.email.toLowerCase().trim()}` : clientIp;
            const redisKey = `${keyPrefix}:${identifier}`;
            // Increment count in Redis
            const currentCount = await redis_js_1.redisCache.incr(redisKey);
            // If it's the first request in the window, set expiry
            if (currentCount === 1) {
                await redis_js_1.redisCache.expire(redisKey, windowSeconds);
            }
            // Check limit
            if (currentCount > maxRequests) {
                res.status(429).json({
                    success: false,
                    error: 'TOO_MANY_REQUESTS',
                    message: `Too many requests from this IP/account. Please wait ${Math.ceil(windowSeconds / 60)} minutes before trying again.`,
                });
                return;
            }
            // Pass headers
            res.setHeader('X-RateLimit-Limit', maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - currentCount));
            next();
        }
        catch (err) {
            console.warn('⚠️ [RateLimiter warning]:', err);
            // Fallback: allow request if Redis fails temporarily
            next();
        }
    };
}
// Preset Rate Limiters for Ondel Auth
exports.otpRateLimiter = createRateLimiter({
    windowSeconds: 15 * 60, // 15 minutes
    maxRequests: 5, // Max 5 OTPs per 15 minutes
    keyPrefix: 'rl:otp',
});
exports.loginRateLimiter = createRateLimiter({
    windowSeconds: 15 * 60, // 15 minutes
    maxRequests: 10, // Max 10 login attempts per 15 minutes
    keyPrefix: 'rl:login',
});
