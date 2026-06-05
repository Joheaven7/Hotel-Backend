const crypto = require('crypto');
const { getRedisClient } = require('../config/redis');

const acquireLock = async (key, ttl = 10) => {
  const client = getRedisClient();
  if (!client) {
    console.error('Redis lock unavailable: Redis client is not connected');
    return null;
  }

  const lockKey = `lock:${key}`;
  const lockValue = crypto.randomBytes(16).toString('hex');

  try {
    const result = await client.set(lockKey, lockValue, {
      NX: true,
      PX: ttl * 1000,
    });

    if (result === 'OK') {
      console.debug(`🔒 Lock acquired: ${lockKey}`);
      return lockValue;
    }

    return null;
  } catch (error) {
    console.error('Redis lock acquisition error:', error.message);
    return null;
  }
};

const releaseLock = async (key, lockValue) => {
  const client = getRedisClient();
  if (!client) {
    console.error('Redis lock unavailable: Redis client is not connected');
    return false;
  }

  const lockKey = `lock:${key}`;
  const script = `
    if redis.call('get', KEYS[1]) == ARGV[1] then
      return redis.call('del', KEYS[1])
    end
    return 0
  `;

  try {
    const result = await client.eval(script, {
      keys: [lockKey],
      arguments: [lockValue],
    });
    return result === 1;
  } catch (error) {
    console.error('Redis lock release error:', error.message);
    return false;
  }
};

module.exports = { acquireLock, releaseLock };