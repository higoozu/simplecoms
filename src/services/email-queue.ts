import PQueue from "p-queue";

const emailQueue = new PQueue({
  concurrency: 3,
  timeout: 10000,
  throwOnTimeout: true
});

export function enqueueEmail<T>(task: () => Promise<T>) {
  return emailQueue.add(task);
}

export function getEmailQueueSize() {
  return emailQueue.size;
}
