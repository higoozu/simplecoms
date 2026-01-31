import { statSync, existsSync, accessSync, constants } from "node:fs";
import { resolve } from "node:path";
import { getDb } from "./sqlite.js";
import { countCommentsByStatus } from "./repositories/comment.repository.js";
import { latestBackupPath } from "./backup.js";
import { logger } from "../utils/logger.js";
import { restoreLatestBackup } from "./restore.js";

export function runHealthCheck() {
  const db = getDb();
  let integrity = "unknown";
  try {
    const result = db.pragma("integrity_check") as { integrity_check: string }[];
    integrity = result[0]?.integrity_check ?? "unknown";
  } catch (err) {
    logger.error("integrity_check_failed", { err: String(err) });
  }

  const dbPath = resolve("data", "comments.db");
  const walPath = resolve("data", "comments.db-wal");
  const dbSize = existsSync(dbPath) ? statSync(dbPath).size : 0;
  const walSize = existsSync(walPath) ? statSync(walPath).size : 0;
  let permissionsOk = true;
  try {
    accessSync(dbPath, constants.R_OK | constants.W_OK);
  } catch {
    permissionsOk = false;
    logger.error("db_permission_issue");
  }
  const backups = latestBackupPath();

  const pending = countCommentsByStatus(db, "pending");
  const spam = countCommentsByStatus(db, "spam");

  if (integrity !== "ok") {
    logger.error("db_integrity_issue", { integrity });
    restoreLatestBackup().then((restored) => {
      if (restored) {
        logger.warn("db_restored_from_backup");
      }
    });
  }
  if (!backups) {
    logger.warn("backup_missing");
  }
  if (pending > 100) {
    logger.warn("pending_comment_high", { pending });
  }
  if (spam > 500) {
    logger.warn("spam_comment_high", { spam });
  }

  return { integrity, dbSize, walSize, pending, spam, backups: Boolean(backups), permissionsOk };
}

export function scheduleHealthChecks() {
  runHealthCheck();
  setInterval(runHealthCheck, 5 * 60 * 1000);
}
