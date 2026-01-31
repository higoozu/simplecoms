import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip } from "node:zlib";
import { latestBackupPath } from "./backup.js";

export async function restoreLatestBackup() {
  const latest = latestBackupPath();
  if (!latest) return false;
  if (!existsSync(latest)) return false;

  const dbPath = resolve("data", "comments.db");
  await pipeline(createReadStream(latest), createGunzip(), createWriteStream(dbPath));
  return true;
}
