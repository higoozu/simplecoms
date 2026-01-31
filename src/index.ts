import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import apiRouter from "./routes/api.router.js";
import adminRouter from "./routes/admin.router.js";
import { getDb } from "./db/sqlite.js";

const app = new Hono();
const port = Number(process.env.PORT ?? 8080);
const localTest = process.env.LOCAL_TEST === "1";

const dataDir = resolve("data");
mkdirSync(dataDir, { recursive: true });
getDb();

app.onError((err, c) => {
  console.error("[ERROR]", err);
  return c.text("Internal Server Error", 500);
});

app.all("*", (c) => {
  const host = c.req.header("host")?.split(":")[0] ?? "";
  const path = new URL(c.req.url).pathname;

  if (localTest && (host === "localhost" || host === "127.0.0.1")) {
    if (path.startsWith("/admin")) {
      return adminRouter.fetch(c.req.raw, c.env, c.executionCtx);
    }
    return apiRouter.fetch(c.req.raw, c.env, c.executionCtx);
  }

  if (host === "comment-admin.domain.com") {
    return adminRouter.fetch(c.req.raw, c.env, c.executionCtx);
  }

  if (host === "comment.domain.com") {
    return apiRouter.fetch(c.req.raw, c.env, c.executionCtx);
  }

  return c.text("Not Found", 404);
});

serve({
  fetch: app.fetch,
  port
});

console.log(`Comment service listening on http://localhost:${port}`);
