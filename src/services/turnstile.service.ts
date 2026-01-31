export async function verifyTurnstile(token: string, ip?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: true, skipped: true };
  }

  const payload = new URLSearchParams({
    secret,
    response: token
  });
  if (ip) payload.set("remoteip", ip);

  let attempts = 0;
  while (attempts < 3) {
    attempts += 1;
    try {
      const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: payload.toString()
      });
      if (!res.ok) {
        continue;
      }
      const data = (await res.json()) as { success: boolean; [key: string]: unknown };
      return { ok: data.success, skipped: false };
    } catch {
      // retry
    }
  }

  return { ok: false, skipped: false };
}
