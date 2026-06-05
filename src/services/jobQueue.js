const Queue = require('bull');

const redisConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
};

class SmartQueue {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.bullQueue = null;
    this.processor = null;
  }

  process(fn) {
    this.processor = fn;
    if (this.bullQueue) {
      this.bullQueue.process(fn);
    }
  }

  getQueue() {
    const { isRedisAvailable } = require('../config/redis');
    if (isRedisAvailable()) {
      if (!this.bullQueue) {
        console.log(`[SmartQueue] Initializing real Bull queue for: ${this.name}`);
        try {
          this.bullQueue = new Queue(this.name, this.config);
          if (this.processor) {
            this.bullQueue.process(this.processor);
          }
          // Silence Bull process level errors so they don't crash
          this.bullQueue.on('error', (err) => {
            console.log(`⚠️  [SmartQueue: ${this.name}] Bull error:`, err.message);
          });
        } catch (err) {
          console.warn(`[SmartQueue: ${this.name}] Failed to initialize Bull queue:`, err.message);
          this.bullQueue = null;
        }
      }
      return this.bullQueue;
    }
    return null;
  }

  async add(data) {
    const realQueue = this.getQueue();
    if (realQueue) {
      try {
        return await realQueue.add(data);
      } catch (err) {
        console.warn(`[SmartQueue: ${this.name}] Failed to add to Bull, falling back:`, err.message);
      }
    }

    // Fallback: execute immediately
    if (this.processor) {
      console.log(`[SmartQueue: ${this.name}] Executing job in-memory fallback`);
      // Run in next tick so it is asynchronous and non-blocking
      setImmediate(() => {
        this.processor({ data }).catch(err => {
          console.error(`[SmartQueue: ${this.name}] Fallback job failed:`, err.message);
        });
      });
    }
    return { id: `mock-${Date.now()}`, data };
  }

  on(event, callback) {
    const realQueue = this.getQueue();
    if (realQueue) {
      realQueue.on(event, callback);
    }
  }
}

const emailQueue = new SmartQueue('email processing', redisConfig);
const reportQueue = new SmartQueue('report generation', redisConfig);
const payrollQueue = new SmartQueue('payroll processing', redisConfig);

const { sendEmail, emailTemplates } = require('./emailService');

emailQueue.process(async (job) => {
  const { email, templateName, data } = job.data;
  const template = emailTemplates[templateName];
  if (!template) {
    throw new Error(`Email template ${templateName} not found`);
  }
  
  // Data unpacking
  const htmlObj = template(data.reservation, data.customer);
  
  // The sendEmail function from emailService expects (email, templateFunc, data)
  const wrapperTemplate = () => htmlObj;

  await sendEmail(email, wrapperTemplate, {});
});

reportQueue.process(async (job) => {
  console.log(`[JobQueue] Generating report: ${job.data.reportName}`);
  // Simulate delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { status: 'completed', file: 'report.pdf' };
});

payrollQueue.process(async (job) => {
  console.log(`[JobQueue] Processing payroll for month: ${job.data.month}`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  return { status: 'completed' };
});

emailQueue.on('failed', (job, err) => {
  console.error(`Email job failed: ${job.id}`, err.message);
});

module.exports = {
  emailQueue,
  reportQueue,
  payrollQueue,
};
