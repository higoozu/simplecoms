import type { Context, Next } from "hono";

export async function adminAuth(c: Context, next: Next) {
  const headerEmail = c.req.header("cf-access-authenticated-user-email");
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  if (!headerEmail || !allowed.includes(headerEmail)) {
    return c.text("Unauthorized", 401);
  }

  return next();
}
