import { Request, Response, NextFunction } from 'express';
import { redisCache } from '../config/redis.js';

interface RateLimitOptions {
  windowSeconds: number; // e.g. 900 seconds = 15 mins
  maxRequests: number;  // e.g. 5 requests
  keyPrefix?: string;   // prefix for Redis key
}

/**
 * Custom Redis-backed rate limiter middleware.
 * Prevents brute-force attacks, spam OTPs, and rapid duplicate logins.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowSeconds, maxRequests, keyPrefix = 'rl' } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string || req.ip || '127.0.0.1').split(',')[0].trim();
      const identifier = req.body?.email ? `${clientIp}:${req.body.email.toLowerCase().trim()}` : clientIp;
      
      const redisKey = `${keyPrefix}:${identifier}`;

      // Increment count in Redis
      const currentCount = await redisCache.incr(redisKey);

      // If it's the first request in the window, set expiry
      if (currentCount === 1) {
        await redisCache.expire(redisKey, windowSeconds);
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
    } catch (err) {
      console.warn('⚠️ [RateLimiter warning]:', err);
      // Fallback: allow request if Redis fails temporarily
      next();
    }
  };
}

// Preset Rate Limiters for Ondel Auth
export const otpRateLimiter = createRateLimiter({
  windowSeconds: 15 * 60, // 15 minutes
  maxRequests: 5,         // Max 5 OTPs per 15 minutes
  keyPrefix: 'rl:otp',
});

export const loginRateLimiter = createRateLimiter({
  windowSeconds: 15 * 60, // 15 minutes
  maxRequests: 10,        // Max 10 login attempts per 15 minutes
  keyPrefix: 'rl:login',
});
