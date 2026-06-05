const { Queue, Worker } = require('bullmq');
const { createConnection } = require('./redisConnection');
const { processReservationJob } = require('../workers/reservationWorker');

const connection = createConnection();
let reservationQueue = null;
let worker = null;
let queueEnabled = false;

try {
  reservationQueue = new Queue('reservation-jobs', { connection });
  // Suppress async Redis errors from bullmq Queue (ioredis emits these as events)
  reservationQueue.on('error', (err) => {
    // Silently ignore — Redis is optional, app degrades gracefully
  });

  worker = new Worker('reservation-jobs', async (job) => processReservationJob(job), {
    connection,
    concurrency: 5,
  });
  // Suppress async Redis errors from bullmq Worker
  worker.on('error', (err) => {
    // Silently ignore — Redis is optional
  });

  worker.on('failed', (job, err) => {
    console.error(`[ReservationWorker] Job ${job.id} failed:`, err?.message || err);
  });

  worker.on('completed', (job) => {
    console.info(`[ReservationWorker] Job ${job.id} (${job.name}) completed`);
  });

  queueEnabled = true;
} catch (error) {
  console.warn('⚠️ Reservation queue disabled: unable to connect to Redis.', error?.message || error);
  reservationQueue = null;
  worker = null;
  queueEnabled = false;
}

const addReservationJob = async (jobName, data, opts) => {
  if (!queueEnabled || !reservationQueue) {
    console.warn(`⚠️ Skipping queue job ${jobName} because Redis is unavailable.`);
    return null;
  }

  try {
    return await reservationQueue.add(jobName, data, opts);
  } catch (error) {
    console.error(`❌ Failed to enqueue ${jobName}:`, error?.message || error);
    return null;
  }
};

const scheduleCheckout = async (reservationId, checkOutDate) => {
  const delay = Math.max(0, new Date(checkOutDate).getTime() - Date.now());
  return addReservationJob(
    'autoCheckout',
    { reservationId },
    {
      delay,
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );
};

const schedulePendingCancellation = async (reservationId, expiresAt) => {
  const delay = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  return addReservationJob(
    'autoCancelPending',
    { reservationId },
    {
      delay,
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );
};

const scheduleCheckInReminder = async (reservationId, checkInDate) => {
  const reminderTime = new Date(checkInDate).getTime() - 2 * 60 * 60 * 1000;
  const delay = Math.max(0, reminderTime - Date.now());
  return addReservationJob(
    'checkInReminder',
    { reservationId },
    {
      delay,
      removeOnComplete: true,
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    }
  );
};

module.exports = {
  reservationQueue,
  scheduleCheckout,
  schedulePendingCancellation,
  scheduleCheckInReminder,
};
