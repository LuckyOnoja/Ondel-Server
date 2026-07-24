import { Redis as UpstashRedis } from '@upstash/redis';
import Redis from 'ioredis';
import { env } from './env.js';

// Upstash REST Client (for HTTP API compatibility)
export const upstashRedis = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
  ? new UpstashRedis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// ioredis client (for TCP TLS connection)
let ioRedisClient: Redis | null = null;

if (env.REDIS_URL) {
  try {
    ioRedisClient = new Redis(env.REDIS_URL, {
      tls: env.REDIS_URL.includes('rediss://') || env.REDIS_URL.includes('upstash.io') ? {} : undefined,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 100, 2000);
      },
    });

    ioRedisClient.on('error', (err) => {
      console.warn('⚠️ [Redis TCP] Connection warning/error:', err.message);
    });

    ioRedisClient.on('connect', () => {
      console.log('✅ [Redis TCP] Connected successfully to Upstash Redis');
    });
  } catch (err) {
    console.warn('⚠️ [Redis TCP] Setup error:', err);
  }
}

/**
 * Unified Redis helper that works across HTTP (Upstash REST) or TCP (ioredis).
 * Ensures your caching, rate-limiting, and OTP storage are zero-downtime!
 */
export const redisCache = {
  async get(key: string): Promise<string | null> {
    try {
      if (upstashRedis) {
        const val = await upstashRedis.get<string | object>(key);
        if (val === null || val === undefined) return null;
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      }
      if (ioRedisClient) {
        return await ioRedisClient.get(key);
      }
    } catch (err) {
      console.error(`[Redis GET error] for key ${key}:`, err);
    }
    return null;
  },

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (upstashRedis) {
        if (ttlSeconds) {
          await upstashRedis.set(key, value, { ex: ttlSeconds });
        } else {
          await upstashRedis.set(key, value);
        }
        return true;
      }
      if (ioRedisClient) {
        if (ttlSeconds) {
          await ioRedisClient.set(key, value, 'EX', ttlSeconds);
        } else {
          await ioRedisClient.set(key, value);
        }
        return true;
      }
    } catch (err) {
      console.error(`[Redis SET error] for key ${key}:`, err);
    }
    return false;
  },

  async del(key: string): Promise<boolean> {
    try {
      if (upstashRedis) {
        await upstashRedis.del(key);
        return true;
      }
      if (ioRedisClient) {
        await ioRedisClient.del(key);
        return true;
      }
    } catch (err) {
      console.error(`[Redis DEL error] for key ${key}:`, err);
    }
    return false;
  },

  async incr(key: string): Promise<number> {
    try {
      if (upstashRedis) {
        return await upstashRedis.incr(key);
      }
      if (ioRedisClient) {
        return await ioRedisClient.incr(key);
      }
    } catch (err) {
      console.error(`[Redis INCR error] for key ${key}:`, err);
    }
    return 1;
  },

  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      if (upstashRedis) {
        await upstashRedis.expire(key, ttlSeconds);
        return true;
      }
      if (ioRedisClient) {
        await ioRedisClient.expire(key, ttlSeconds);
        return true;
      }
    } catch (err) {
      console.error(`[Redis EXPIRE error] for key ${key}:`, err);
    }
    return false;
  },
};
