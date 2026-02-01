import type { Context } from "hono";

export function getClientIp(c: Context) {
  const cf = c.req.header("cf-connecting-ip");
  if (cf) return cf;

  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;

  const xr = c.req.header("x-real-ip");
  if (xr) return xr;

  const raw = c.req.raw as Request & { socket?: { remoteAddress?: string } };
  const remote = raw.socket?.remoteAddress;
  return remote ?? null;
}
