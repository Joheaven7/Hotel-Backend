const redis = require('redis');

let client = null;
let isConnected = false;

/**
 * Connect to Redis server
 */
const connectRedis = async () => {
  try {
    let exhausted = false;

    const makeReconnectStrategy = () => (retries) => {
      if (retries >= 3) {
        exhausted = true;
        return new Error('Redis reconnection attempts exhausted');
      }
      return Math.min(retries * 100, 2000);
    };

    const redisOptions = process.env.REDIS_URL
      ? {
        url: process.env.REDIS_URL,
        socket: { reconnectStrategy: makeReconnectStrategy() },
      }
      : {
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT) || 6379,
          reconnectStrategy: makeReconnectStrategy(),
        },
        password: process.env.REDIS_PASSWORD || undefined,
      };

    client = redis.createClient(redisOptions);

    client.on('error', (err) => {
      // Suppress repeated AggregateError dumps after retries are exhausted
      if (!exhausted) {
        console.log('⚠️  Redis connection error:', err.message || err.code || err);
      }
      isConnected = false;
    });

    client.on('connect', () => {
      console.log('✅ Redis connected');
      isConnected = true;
    });

    client.on('disconnect', () => {
      console.log('⚠️  Redis disconnected');
      isConnected = false;
    });

    client.on('reconnecting', () => {
      if (!exhausted) {
        console.log('🔄 Redis reconnecting...');
      }
    });

    await client.connect();
    isConnected = true;
    return client;
  } catch (error) {
    if (client) {
      try {
        await client.quit();
      } catch (shutdownError) {
        // Ignore shutdown errors when client is already unavailable
      }
      client = null;
    }
    console.log('⚠️  Redis unavailable - app will work without locking:', error.message || error.code);
    isConnected = false;
    // Don't throw - let app continue without Redis
    return null;
  }
};

/**
 * Get Redis client instance
 * Returns null if Redis is not available (app continues to work)
 */
const getRedisClient = () => {
  if (!client || !isConnected) {
    return null;
  }
  return client;
};

/**
 * Check if Redis is available
 */
const isRedisAvailable = () => isConnected;

/**
 * Close Redis connection
 */
const closeRedis = async () => {
  if (client && isConnected) {
    await client.quit();
    client = null;
    isConnected = false;
    console.log('✅ Redis connection closed');
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  isRedisAvailable,
  closeRedis,
};