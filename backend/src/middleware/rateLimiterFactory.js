/**
 * Resilient Rate Limiter Factory
 * Provides distributed Redis-backed rate limiting with seamless in-memory fallback.
 * Guarantees zero unhandled errors and zero server downtime if Redis is unavailable.
 */

const { rateLimit, MemoryStore, ipKeyGenerator } = require('express-rate-limit');
const { redisClient, isReady } = require('../config/redisClient');

let RedisStore = null;
try {
  const rlr = require('rate-limit-redis');
  RedisStore = rlr.RedisStore || rlr.default || rlr;
} catch (e) {
  // rate-limit-redis not installed or failed to load
}

/**
 * Resilient Store that wraps RedisStore with automatic MemoryStore fallback
 */
class ResilientRateLimitStore {
  constructor() {
    this.memoryStore = new MemoryStore();
    this.redisStore = null;
    this.initialized = false;
  }

  init(options) {
    this.options = options;
    if (this.memoryStore && typeof this.memoryStore.init === 'function') {
      this.memoryStore.init(options);
    }
    this._tryInitRedisStore();
  }

  _tryInitRedisStore() {
    if (!this.redisStore && RedisStore && isReady() && redisClient) {
      try {
        this.redisStore = new RedisStore({
          sendCommand: (...args) => {
            if (!isReady()) {
              return Promise.reject(new Error('Redis not ready'));
            }
            return redisClient.call(...args);
          }
        });
        if (typeof this.redisStore.init === 'function' && this.options) {
          this.redisStore.init(this.options);
        }
      } catch (err) {
        this.redisStore = null;
      }
    }
  }

  async increment(key) {
    this._tryInitRedisStore();
    if (this.redisStore && isReady()) {
      try {
        return await this.redisStore.increment(key);
      } catch (err) {
        // Fall back safely to in-memory store
      }
    }
    return this.memoryStore.increment(key);
  }

  async decrement(key) {
    if (this.redisStore && isReady()) {
      try {
        return await this.redisStore.decrement(key);
      } catch (err) {
        // Fall back safely to in-memory store
      }
    }
    return this.memoryStore.decrement(key);
  }

  async resetKey(key) {
    if (this.redisStore && isReady()) {
      try {
        await this.redisStore.resetKey(key);
      } catch (err) {}
    }
    return this.memoryStore.resetKey(key);
  }

  async get(key) {
    if (this.redisStore && isReady()) {
      try {
        return await this.redisStore.get(key);
      } catch (err) {}
    }
    return this.memoryStore.get(key);
  }
}

/**
 * Build a robust rate limiter instance
 * @param {object} options express-rate-limit options
 */
const buildResilientLimiter = (options = {}) => {
  const store = new ResilientRateLimitStore();
  return rateLimit({
    ...options,
    store,
    validate: {
      keyGeneratorIpFallback: false,
      xForwardedForHeader: false,
      default: false
    }
  });
};

module.exports = {
  buildResilientLimiter,
  ResilientRateLimitStore,
  ipKeyGenerator
};
