import { createHash } from "node:crypto";

export function getAvatarUrl(email?: string | null) {
  const cdn = process.env.GRAVATAR_CDN ?? "https://www.gravatar.com/avatar";
  const theme = process.env.GRAVATAR_DEFAULT_THEME ?? "identicon";
  const clean = (email ?? "").trim().toLowerCase();
  const hash = clean
    ? createHash("md5").update(clean).digest("hex")
    : "00000000000000000000000000000000";
  return `${cdn}/${hash}?d=${encodeURIComponent(theme)}`;
}
