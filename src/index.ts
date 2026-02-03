import "dotenv/config";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import apiRouter from "./routes/api.router.js";
import adminRouter from "./routes/admin.router.js";
import { getDb } from "./db/sqlite.js";
import { scheduleHealthChecks } from "./db/health-monitor.js";
import { scheduleBackups } from "./db/backup-scheduler.js";
import { logger } from "./utils/logger.js";

const app = new Hono();
const port = Number(process.env.PORT ?? 8080);
const localTest = process.env.LOCAL_TEST === "1";
const adminDomain = process.env.ADMIN_DOMAIN ?? "comment-admin.domain.com";
const apiDomain = process.env.API_DOMAIN ?? "comment.domain.com";

const dataDir = resolve("data");
mkdirSync(dataDir, { recursive: true });
getDb();
scheduleHealthChecks();
scheduleBackups();

app.onError((err, c) => {
  const message = process.env.NODE_ENV === "production" ? "Internal Server Error" : String(err);
  logger.error("request_error", { err: String(err) });
  return c.text(message, 500);
});

app.all("*", (c) => {
  const host = c.req.header("host")?.split(":")[0] ?? "";
  const path = new URL(c.req.url).pathname;

  if (localTest && (host === "localhost" || host === "127.0.0.1")) {
    if (path.startsWith("/admin")) {
      return adminRouter.fetch(c.req.raw);
    }
    return apiRouter.fetch(c.req.raw);
  }

  if (host === adminDomain) {
    return adminRouter.fetch(c.req.raw);
  }

  if (host === apiDomain) {
    return apiRouter.fetch(c.req.raw);
  }

  return c.text("Not Found", 404);
});

serve({
  fetch: app.fetch,
  port
});

logger.info(`Comment service listening on http://localhost:${port}`);
