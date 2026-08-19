const REQUIRED_QUEUE_NAMES = [
  'appointment-reminders',
  'campaign-delivery',
  'workflow-execution',
  'voice-processing',
  'social-publishing',
  'knowledge-ingestion',
  'provider-webhooks',
  'analytics-rollups',
  'notifications'
];

const redisUrl = process.env.REDIS_URL || '';
let QueueClass = null;
let WorkerClass = null;
let queueLoadError = null;

if (redisUrl) {
  try {
    const bullmq = await import('bullmq');
    QueueClass = bullmq.Queue;
    WorkerClass = bullmq.Worker;
  } catch (error) {
    queueLoadError = error;
  }
}

class QueueUnavailableError extends Error {
  constructor(message = 'Durable queue is unavailable. Configure REDIS_URL and install BullMQ dependencies.') {
    super(message);
    this.name = 'QueueUnavailableError';
    this.code = 'QUEUE_UNAVAILABLE';
    this.statusCode = 503;
  }
}

class DegradedQueue {
  constructor(name, reason) {
    this.name = name;
    this.reason = reason;
  }

  async add() {
    throw new QueueUnavailableError(this.reason);
  }
}

class QueueManager {
  constructor() {
    this.connection = redisUrl ? { url: redisUrl } : null;
    this.enabled = Boolean(redisUrl && QueueClass && WorkerClass);
    this.reason = this.enabled
      ? null
      : redisUrl
        ? `BullMQ unavailable: ${queueLoadError?.message || 'dependency not loaded'}`
        : 'REDIS_URL is not configured';
    this.queues = new Map();
    this.workers = [];
  }

  getQueue(queueName) {
    if (!this.queues.has(queueName)) {
      const queue = this.enabled
        ? new QueueClass(queueName, {
            connection: this.connection,
            defaultJobOptions: {
              attempts: 3,
              backoff: { type: 'exponential', delay: 5000 },
              removeOnComplete: 1000,
              removeOnFail: 5000
            }
          })
        : new DegradedQueue(queueName, this.reason);
      this.queues.set(queueName, queue);
    }
    return this.queues.get(queueName);
  }

  registerWorker(queueName, processor, options = {}) {
    if (!this.enabled) {
      return null;
    }

    const worker = new WorkerClass(queueName, processor, {
      connection: this.connection,
      concurrency: options.concurrency || 5,
      limiter: options.limiter
    });

    worker.on('failed', (job, error) => {
      console.error('[queue:failed]', {
        queueName,
        jobId: job?.id,
        jobName: job?.name,
        message: error.message
      });
    });

    this.workers.push(worker);
    return worker;
  }

  getHealth() {
    return {
      status: this.enabled ? 'ready' : 'degraded',
      enabled: this.enabled,
      reason: this.reason,
      redisConfigured: Boolean(redisUrl),
      queues: REQUIRED_QUEUE_NAMES
    };
  }

  async shutdown() {
    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all(Array.from(this.queues.values()).map((queue) => queue.close?.()));
  }
}

export { QueueUnavailableError, REQUIRED_QUEUE_NAMES };
export const queueManager = new QueueManager();
export const appointmentQueue = queueManager.getQueue('appointment-reminders');
export const campaignQueue = queueManager.getQueue('campaign-delivery');
export const workflowQueue = queueManager.getQueue('workflow-execution');

export default {
  queueManager,
  appointmentQueue,
  campaignQueue,
  workflowQueue
};
