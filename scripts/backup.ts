import { mkdirSync, createReadStream, createWriteStream } from "node:fs";
import { resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import Database from "better-sqlite3";

const dataDir = resolve("data");
const backupDir = resolve("backups");
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
