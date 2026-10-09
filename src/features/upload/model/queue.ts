type QueueJob = { id: string };

type QueueOptions<J extends QueueJob> = {
  concurrency: number;
  // Owns its own error handling (dispatches a failed event); a rejection only frees the slot.
  run: (job: J, signal: AbortSignal) => Promise<void>;
};

// FIFO queue with a fixed number of concurrent jobs. Cancelling a waiting job drops it; cancelling a running job
// aborts its signal and the slot is freed when the job settles.
class UploadQueue<J extends QueueJob> {
  private readonly waiting: J[] = [];
  private readonly running = new Map<string, AbortController>();
  private idleResolvers: (() => void)[] = [];
  private readonly options: QueueOptions<J>;

  constructor(options: QueueOptions<J>) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1) throw new RangeError("concurrency must be >= 1");
    this.options = options;
  }

  enqueue(job: J): void {
    if (this.has(job.id)) return;
    this.waiting.push(job);
    this.pump();
  }

  cancel(id: string): boolean {
    const index = this.waiting.findIndex((job) => job.id === id);
    if (index >= 0) {
      this.waiting.splice(index, 1);
      this.notifyIdle();
      return true;
    }
    const controller = this.running.get(id);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  cancelAll(): void {
    this.waiting.length = 0;
    for (const controller of this.running.values()) controller.abort();
    this.notifyIdle();
  }

  has(id: string): boolean {
    return this.running.has(id) || this.waiting.some((job) => job.id === id);
  }

  get activeCount(): number {
    return this.running.size;
  }

  get pendingCount(): number {
    return this.waiting.length;
  }

  // Resolves when nothing is running or waiting; used by tests and by unmount cleanup.
  idle(): Promise<void> {
    if (this.running.size === 0 && this.waiting.length === 0) return Promise.resolve();
    return new Promise((resolve) => this.idleResolvers.push(resolve));
  }

  private pump(): void {
    while (this.running.size < this.options.concurrency) {
      const job = this.waiting.shift();
      if (!job) break;
      const controller = new AbortController();
      this.running.set(job.id, controller);
      void this.options
        .run(job, controller.signal)
        .catch(() => undefined)
        .finally(() => {
          this.running.delete(job.id);
          this.pump();
          this.notifyIdle();
        });
    }
  }

  private notifyIdle(): void {
    if (this.running.size > 0 || this.waiting.length > 0) return;
    const resolvers = this.idleResolvers;
    this.idleResolvers = [];
    for (const resolve of resolvers) resolve();
  }
}

export { UploadQueue };
export type { QueueJob, QueueOptions };
