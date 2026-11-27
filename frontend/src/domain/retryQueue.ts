/**
 * Simple ordered retry queue (task 10, Req 13.2). Jobs run one at a time, in order. A job
 * that fails with a retryable error is retried every `intervalMs` up to `maxAttempts`
 * total attempts; the next job waits. No I/O of its own: the job supplies `run`.
 * The full offline queue (task O3) replaces this.
 */
export const RETRY_INTERVAL_MS = 5000;
export const RETRY_MAX_ATTEMPTS = 5;

export interface RetryJob<R> {
  run: () => Promise<R>;
  onSuccess: (result: R) => void;
  /** The attempt failed and will be tried again. */
  onPending?: (attempt: number) => void;
  /** Non-retryable error, or attempts exhausted. */
  onGiveUp: (error: unknown) => void;
  isRetryable: (error: unknown) => boolean;
}

export interface RetryQueueOptions {
  intervalMs?: number;
  maxAttempts?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
}

export class RetryQueue {
  private readonly jobs: RetryJob<never>[] = [];
  private running = false;
  private readonly intervalMs: number;
  private readonly maxAttempts: number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;

  constructor(options: RetryQueueOptions = {}) {
    this.intervalMs = options.intervalMs ?? RETRY_INTERVAL_MS;
    this.maxAttempts = options.maxAttempts ?? RETRY_MAX_ATTEMPTS;
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  }

  get length(): number {
    return this.jobs.length;
  }

  enqueue<R>(job: RetryJob<R>): void {
    this.jobs.push(job as unknown as RetryJob<never>);
    this.pump();
  }

  private pump(): void {
    if (this.running || this.jobs.length === 0) return;
    this.running = true;
    this.attempt(1);
  }

  private attempt(n: number): void {
    const job = this.jobs[0] as unknown as RetryJob<unknown>;
    job.run().then(
      (result) => {
        this.finish();
        job.onSuccess(result);
      },
      (error: unknown) => {
        if (!job.isRetryable(error) || n >= this.maxAttempts) {
          this.finish();
          job.onGiveUp(error);
          return;
        }
        job.onPending?.(n);
        this.setTimer(() => this.attempt(n + 1), this.intervalMs);
      },
    );
  }

  private finish(): void {
    this.jobs.shift();
    this.running = false;
    this.pump();
  }
}
