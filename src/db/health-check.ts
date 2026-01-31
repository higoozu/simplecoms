import { statSync } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "./sqlite.js";

export function checkDbHealth() {
  const db = getDb();
  let walSize = 0;
  let dbSize = 0;
  const dbPath = resolve("data", "comments.db");
  const walPath = resolve("data", "comments.db-wal");

  try {
    walSize = statSync(walPath).size;
  } catch {
    walSize = 0;
  }

  try {
    dbSize = statSync(dbPath).size;
  } catch {
    dbSize = 0;
  }

  const walCheckpoint = db.pragma("wal_checkpoint");
  return {
    dbSize,
    walSize,
    walCheckpoint
  };
}
