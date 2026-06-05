const createConnection = () => {
  // maxRetriesPerRequest:0 + enableOfflineQueue:false = fail fast, no retry flood
  // retryStrategy:null = ioredis will not attempt to reconnect on failure
  const base = {
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: () => null,     // disable ioredis auto-reconnect
    lazyConnect: true,
  };

  if (process.env.REDIS_URL) {
    return { url: process.env.REDIS_URL, ...base };
  }

  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    ...base,
  };
};

module.exports = { createConnection };