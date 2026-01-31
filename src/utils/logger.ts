import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const envLevel = (process.env.LOG_LEVEL as LogLevel) || "info";
const minLevel = levelOrder[envLevel] ?? 20;
const logDir = process.env.LOG_DIR || "logs";
const logFile = resolve(logDir, "app.log");
const auditFile = resolve(logDir, "admin-access.log");

if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

const appStream = createWriteStream(logFile, { flags: "a" });
const auditStream = createWriteStream(auditFile, { flags: "a" });

function sanitize(obj: Record<string, unknown>) {
  const cloned: Record<string, unknown> = { ...obj };
  for (const key of Object.keys(cloned)) {
    if (key.toLowerCase().includes("token") || key.toLowerCase().includes("email")) {
      cloned[key] = "[redacted]";
    }
  }
  return cloned;
}

function write(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
  if (levelOrder[level] < minLevel) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(extra ? sanitize(extra) : {})
  };
  appStream.write(JSON.stringify(payload) + "\n");
  if (process.env.NODE_ENV !== "production") {
    const out = `[${payload.level}] ${payload.msg}`;
    // eslint-disable-next-line no-console
    console.log(out);
  }
}

export const logger = {
  debug: (msg: string, extra?: Record<string, unknown>) => write("debug", msg, extra),
  info: (msg: string, extra?: Record<string, unknown>) => write("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => write("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => write("error", msg, extra)
};

export function audit(event: string, extra?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...(extra ? sanitize(extra) : {})
  };
  auditStream.write(JSON.stringify(payload) + "\n");
}
