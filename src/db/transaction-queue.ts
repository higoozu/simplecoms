import PQueue from "p-queue";
import type Database from "better-sqlite3";

const writeQueue = new PQueue({ concurrency: 1 });

export function enqueueWrite<T>(task: () => T | Promise<T>): Promise<T | void> {
  return writeQueue.add(async () => task());
}

export function enqueueTransaction<T>(db: Database.Database, task: () => T): Promise<T | void> {
  const trx = db.transaction(task);
  return writeQueue.add(async () => trx());
}

export function getQueueSize() {
  return writeQueue.size;
}
