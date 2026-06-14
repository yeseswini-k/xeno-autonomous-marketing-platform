import { EventEmitter } from 'events';

// Event emitter to notify SSE subscribers of queue changes in real-time
export const queueEvents = new EventEmitter();

export interface QueueJob<T = any> {
  id: string;
  data?: T;
  attempts: number;
  maxAttempts: number;
  nextRunTime: number;
  run: (job: QueueJob<T>) => Promise<void>;
  onSuccess?: () => void;
  onFailure?: (error: Error) => void;
  onRetry?: (error: Error, nextDelay: number) => void;
}

export class ThrottledJobQueue<T> {
  private queue: QueueJob<T>[] = [];
  private processingCount = 0;
  private maxConcurrency = 5;
  private rateLimitPerSec = 20; // Max jobs sent per second
  private lastJobSentTime = 0;
  private checkInterval: NodeJS.Timeout | null = null;
  public name: string;

  constructor(name: string, rateLimit = 20, concurrency = 5) {
    this.name = name;
    this.rateLimitPerSec = rateLimit;
    this.maxConcurrency = concurrency;
    this.start();
  }

  public setRateLimit(rate: number) {
    this.rateLimitPerSec = rate;
  }

  public add(job: Omit<QueueJob<T>, 'attempts' | 'nextRunTime'>) {
    const fullJob: QueueJob<T> = {
      ...job,
      attempts: 0,
      nextRunTime: Date.now(),
    };
    this.queue.push(fullJob);
    this.emitState();
    this.process();
  }

  public getQueueLength(): number {
    return this.queue.length;
  }

  public getActiveProcessingCount(): number {
    return this.processingCount;
  }

  public getJobs(): QueueJob<T>[] {
    return [...this.queue];
  }

  private start() {
    if (!this.checkInterval) {
      this.checkInterval = setInterval(() => this.process(), 50);
    }
  }

  public stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private emitState() {
    queueEvents.emit('state_change', {
      queueName: this.name,
      size: this.queue.length,
      processing: this.processingCount,
    });
  }

  private async process() {
    const now = Date.now();

    // Check concurrency and rate limiting
    if (this.processingCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    // Rate limit throttle check
    const minInterval = 1000 / this.rateLimitPerSec;
    if (now - this.lastJobSentTime < minInterval) {
      return;
    }

    // Find first job that is ready to run
    const readyJobIndex = this.queue.findIndex(j => j.nextRunTime <= now);
    if (readyJobIndex === -1) {
      return;
    }

    const job = this.queue[readyJobIndex];
    this.queue.splice(readyJobIndex, 1); // Remove from queue

    this.processingCount++;
    this.lastJobSentTime = now;
    this.emitState();

    // Execute job async
    (async () => {
      try {
        job.attempts++;
        await job.run(job);
        if (job.onSuccess) job.onSuccess();
      } catch (err: any) {
        console.error(`[Queue: ${this.name}] Job ${job.id} failed:`, err.message || err);
        const error = err instanceof Error ? err : new Error(String(err));

        if (job.attempts < job.maxAttempts) {
          // Calculate exponential backoff: 1s, 2s, 4s, 8s, etc.
          const delay = Math.pow(2, job.attempts) * 1000;
          job.nextRunTime = Date.now() + delay;
          
          if (job.onRetry) job.onRetry(error, delay);
          this.queue.push(job); // Put back for retry
        } else {
          if (job.onFailure) job.onFailure(error);
        }
      } finally {
        this.processingCount--;
        this.emitState();
        this.process();
      }
    })();
  }

  public clear() {
    this.queue = [];
    this.emitState();
  }
}

// Global Throttled Queues
// CRM Outbox Queue: Sends messages from CRM backend to Channel Service API
export const crmOutboxQueue = new ThrottledJobQueue<any>('CRM_Outbox', 20, 5);

// Channel Webhook Queue: Sends webhook callbacks from Channel Service to CRM API
export const channelWebhookQueue = new ThrottledJobQueue<any>('Channel_Webhook', 50, 10);
