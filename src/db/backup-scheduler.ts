import { createBackup, cleanupBackups } from "./backup.js";
import { logger } from "../utils/logger.js";

function msUntilMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next.getTime() - now.getTime();
}

export function scheduleBackups() {
  if (process.env.BACKUP_ENABLED === "false") return;

  const run = async () => {
    try {
      await createBackup();
      cleanupBackups(7);
      logger.info("backup_completed");
    } catch (err) {
      logger.error("backup_failed", { err: String(err) });
    }
  };

  setTimeout(async () => {
    await run();
    setInterval(run, 24 * 60 * 60 * 1000);
  }, msUntilMidnight());
}
