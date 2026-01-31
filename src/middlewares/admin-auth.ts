import type { Context, Next } from "hono";
import { audit } from "../utils/logger.js";

export async function adminAuth(c: Context, next: Next) {
  if (process.env.LOCAL_ADMIN_BYPASS === "1") {
    return next();
  }

  const allowedCountries = (process.env.ALLOWED_COUNTRIES ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (allowedCountries.length) {
    const country = c.req.header("cf-ipcountry") ?? "";
    if (!allowedCountries.includes(country)) {
      return c.text("Unauthorized", 401);
    }
  }

  const headerEmail = c.req.header("cf-access-authenticated-user-email");
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!headerEmail || !allowed.includes(headerEmail)) {
    return c.text("Unauthorized", 401);
  }

  if (process.env.ENABLE_AUDIT_LOG !== "false") {
    audit("admin_access", { email: headerEmail, path: c.req.path });
  }

  return next();
}
