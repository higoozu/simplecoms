import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface AdminProfile {
  email: string;
  name: string;
  website?: string;
  avatar_url?: string;
  id?: string;
}

let cache: AdminProfile[] | null = null;

export function loadAdmins() {
  if (cache) return cache;
  const file = resolve("config", "admins.json");
  try {
    const raw = readFileSync(file, "utf8");
    cache = JSON.parse(raw) as AdminProfile[];
  } catch {
    cache = [];
  }
  return cache;
}

export function findAdminByEmail(email: string) {
  const admins = loadAdmins();
  return admins.find((admin) => admin.email === email) || null;
}

export function listAdmins() {
  return loadAdmins();
}
