const redisClient = require('../config/redis');

const inMemoryStore = {};

const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const max = options.max || 100; // Max requests per windowMs
  const message = options.message || 'Too many requests from this IP, please try again later.';

  return async (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const key = `rate-limit:${req.baseUrl || req.originalUrl}:${ip}`;
    const now = Date.now();

    try {
      if (redisClient && redisClient.isReady) {
        let count = await redisClient.get(key);
        if (!count) {
          await redisClient.setEx(key, Math.ceil(windowMs / 1000), '1');
          return next();
        }
        
        count = parseInt(count, 10);
        if (count >= max) {
          return res.status(429).json({ message, retryAfter: windowMs });
        }
        
        await redisClient.incr(key);
        return next();
      }
    } catch (err) {
      console.warn('Rate limiter redis fallback to memory:', err.message);
    }

    // Fallback to in-memory store
    if (!inMemoryStore[key]) {
      inMemoryStore[key] = {
        resetTime: now + windowMs,
        count: 1,
      };
      return next();
    }

    const clientData = inMemoryStore[key];

    if (now > clientData.resetTime) {
      clientData.resetTime = now + windowMs;
      clientData.count = 1;
      return next();
    }

    clientData.count += 1;

    if (clientData.count > max) {
      return res.status(429).json({
        message,
        resetTime: new Date(clientData.resetTime),
      });
    }

    next();
  };
};

module.exports = { createRateLimiter };
