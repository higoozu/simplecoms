import { mkdirSync, createReadStream, createWriteStream, existsSync, readdirSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import Database from "better-sqlite3";

const dataDir = resolve("data");
const backupDir = resolve("backups");

export async function createBackup() {
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const backupPath = resolve(backupDir, `comments-${date}.db`);
  const gzipPath = `${backupPath}.gz`;

  const db = new Database(resolve(dataDir, "comments.db"));
  try {
    db.pragma("journal_mode = WAL");
    db.exec(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }

  await pipeline(createReadStream(backupPath), createGzip(), createWriteStream(gzipPath));
  return { backupPath, gzipPath };
}

export function cleanupBackups(keepDays = 7) {
  if (!existsSync(backupDir)) return;
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith("comments-") && f.endsWith(".db.gz"))
    .sort();
  if (files.length <= keepDays) return;
  const toDelete = files.slice(0, files.length - keepDays);
  for (const file of toDelete) {
    unlinkSync(resolve(backupDir, file));
  }
}

export function latestBackupPath() {
  if (!existsSync(backupDir)) return null;
  const files = readdirSync(backupDir)
    .filter((f) => f.startsWith("comments-") && f.endsWith(".db.gz"))
    .sort();
  if (!files.length) return null;
  return resolve(backupDir, files[files.length - 1]);
}
