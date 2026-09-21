/**
 * Resilient Redis Client Configuration
 * Supports production Redis caching, distributed locks, Bloom filters, and rate limiting.
 * Safe fallback to database and in-memory operations if Redis is unavailable or unconfigured.
 */

let Redis = null;
try {
  Redis = require('ioredis');
} catch (e) {
  console.log('[Redis] Optional module ioredis not found. Operating in resilient database-direct mode.');
}

// Environment configuration
const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || '';
const redisUsername = process.env.REDIS_USERNAME || '';

// Connect ONLY if Redis is explicitly configured
const isExplicitRedisEnabled = Boolean(
  process.env.ENABLE_REDIS === 'true' || 
  redisUrl || 
  (redisHost && redisHost !== 'localhost' && redisHost !== '127.0.0.1') ||
  (redisHost && process.env.NODE_ENV !== 'production')
);

let redisClient = null;
let connectionAttempts = 0;

if (Redis && isExplicitRedisEnabled) {
  try {
    const targetHost = redisHost || '127.0.0.1';
    const commonOpts = {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false, // Fail fast to fallback rather than blocking
      connectTimeout: 5000,
      lazyConnect: false,
      retryStrategy(times) {
        connectionAttempts++;
        if (connectionAttempts > 5) {
          console.warn('[Redis] Max reconnection attempts reached. Redis will remain degraded until restarted.');
          return null; // Stop retrying to avoid log spam and event loop congestion
        }
        return Math.min(times * 1000, 5000);
      }
    };

    if (redisUrl) {
      redisClient = new Redis(redisUrl, commonOpts);
    } else {
      redisClient = new Redis({
        host: targetHost,
        port: redisPort,
        username: redisUsername || undefined,
        password: redisPassword || undefined,
        ...commonOpts
      });
    }

    redisClient.on('error', (err) => {
      // Catch all connection errors cleanly so Node.js never crashes or terminates
      if (err.code !== 'ECONNREFUSED' && err.code !== 'ETIMEDOUT') {
        console.warn(`[Redis Error] ${err.message}`);
      }
    });

    redisClient.on('connect', () => {
      connectionAttempts = 0;
      console.log('[Redis] Connected successfully.');
    });

    redisClient.on('ready', () => {
      console.log('[Redis] Client ready for commands.');
    });

    redisClient.on('close', () => {
      // Informational only
    });
  } catch (err) {
    console.warn('[Redis Init Warning]', err.message);
    redisClient = null;
  }
} else {
  console.log('[Redis] Redis not explicitly configured. Operating in resilient database-direct mode.');
}

/**
 * Returns true if Redis is ready to accept commands
 */
const isReady = () => Boolean(redisClient && redisClient.status === 'ready');

// ==========================================
// Caching Utilities (Cache-Aside Pattern)
// ==========================================

/**
 * Retrieve cached JSON value
 * @param {string} key
 * @returns {Promise<any|null>}
 */
const getCache = async (key) => {
  if (!isReady()) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
};

/**
 * Store value in Redis with TTL.
 * CRITICAL RULE: NEVER cache negative/empty results (null, undefined, 404s).
 * @param {string} key
 * @param {any} value
 * @param {number} ttlSeconds
 */
const setCache = async (key, value, ttlSeconds = 300) => {
  // Disallow negative caching strictly
  if (!isReady() || value === undefined || value === null) return;
  if (typeof value === 'object' && Object.keys(value).length === 0 && !Array.isArray(value)) return;

  try {
    // Add jitter (±10%) to prevent synchronized cache stampedes
    const jitter = Math.floor(Math.random() * (ttlSeconds * 0.2)) - Math.floor(ttlSeconds * 0.1);
    const effectiveTtl = Math.max(10, ttlSeconds + jitter);
    const stringified = JSON.stringify(value);
    await redisClient.set(key, stringified, 'EX', effectiveTtl);
  } catch (err) {
    // Non-fatal, application continues safely
  }
};

/**
 * Delete specific cache key
 * @param {string} key
 */
const delCache = async (key) => {
  if (!isReady()) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    // Non-fatal
  }
};

/**
 * Delete keys matching a pattern (e.g. 'app:prod:wedding:customer:123:*')
 * @param {string} pattern
 */
const delCachePattern = async (pattern) => {
  if (!isReady()) return;
  try {
    const stream = redisClient.scanStream({
      match: pattern,
      count: 100
    });

    stream.on('data', async (keys) => {
      if (keys && keys.length) {
        const pipeline = redisClient.pipeline();
        keys.forEach(k => pipeline.del(k));
        await pipeline.exec().catch(() => {});
      }
    });

    stream.on('error', () => {
      // Non-fatal
    });
  } catch (err) {
    // Non-fatal
  }
};

// ==========================================
// Distributed Locking (Stampede Protection)
// ==========================================

/**
 * Acquire a distributed lock with automatic expiration
 * @param {string} lockKey
 * @param {number} ttlSeconds
 * @returns {Promise<boolean>}
 */
const acquireLock = async (lockKey, ttlSeconds = 5) => {
  if (!isReady()) return false;
  try {
    const result = await redisClient.set(lockKey, 'locked', 'NX', 'EX', ttlSeconds);
    return result === 'OK';
  } catch (err) {
    return false;
  }
};

/**
 * Release a distributed lock
 * @param {string} lockKey
 */
const releaseLock = async (lockKey) => {
  if (!isReady()) return;
  try {
    await redisClient.del(lockKey);
  } catch (err) {
    // Non-fatal
  }
};

// ==========================================
// Bloom Filter Utilities (Penetration Prevention)
// ==========================================

/**
 * Initialize a Bloom Filter on Redis.
 * Uses BF.RESERVE if RedisBloom is enabled. Graceful fallback if unsupported.
 * @param {string} filterName
 * @param {number} errorRate
 * @param {number} capacity
 */
const initBloomFilter = async (filterName, errorRate = 0.01, capacity = 100000) => {
  if (!isReady()) return false;
  try {
    await redisClient.call('BF.RESERVE', filterName, errorRate, capacity);
    console.log(`[Redis Bloom] Filter reserved: ${filterName}`);
    return true;
  } catch (err) {
    if (err.message && err.message.includes('ERR item exists')) {
      return true; // Already exists, perfectly fine
    }
    // Module might not be installed; log once and fail open
    return false;
  }
};

/**
 * Add an item identifier to the Bloom Filter
 * @param {string} filterName
 * @param {string} item
 */
const bfAdd = async (filterName, item) => {
  if (!isReady() || !item) return;
  try {
    await redisClient.call('BF.ADD', filterName, String(item));
  } catch (err) {
    // Fail silently if RedisBloom not supported
  }
};

/**
 * Check if an item exists in the Bloom Filter
 * Returns true if possibly present (or if Redis is offline/unsupported).
 * Returns false ONLY if RedisBloom definitely confirms absence.
 * @param {string} filterName
 * @param {string} item
 * @returns {Promise<boolean>}
 */
const bfExists = async (filterName, item) => {
  if (!isReady() || !item) return true; // Fail open to DB lookup
  try {
    const result = await redisClient.call('BF.EXISTS', filterName, String(item));
    return result === 1; // 1 = possibly exists, 0 = definitely absent
  } catch (err) {
    return true; // Fail open on error
  }
};

module.exports = {
  redisClient,
  isReady,
  getCache,
  setCache,
  delCache,
  delCachePattern,
  acquireLock,
  releaseLock,
  initBloomFilter,
  bfAdd,
  bfExists
};
