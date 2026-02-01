import { cors } from "hono/cors";

const allowed = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const allowAll = allowed.includes("*");

export const corsMiddleware = cors({
  origin: (origin) => {
    if (!origin) return null;
    if (allowAll) return origin;
    return allowed.includes(origin) ? origin : null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: false,
  maxAge: 600
});
