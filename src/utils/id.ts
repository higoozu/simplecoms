import { randomBytes } from "node:crypto";

const ID_LEN = 12;

export function generatePublicId(size = ID_LEN) {
  const raw = randomBytes(size);
  return raw.toString("base64url");
}

export function isPublicId(value: string) {
  return /^[A-Za-z0-9_-]{16,64}$/.test(value);
}
