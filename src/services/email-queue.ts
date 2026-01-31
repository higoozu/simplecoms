import PQueue from "p-queue";

const emailQueue = new PQueue({ concurrency: 1 });

export function enqueueEmail<T>(task: () => Promise<T>) {
  return emailQueue.add(task);
}

export function getEmailQueueSize() {
  return emailQueue.size;
}
