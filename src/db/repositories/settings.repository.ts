import type Database from "better-sqlite3";

export function getAllSettings(db: Database.Database) {
  const stmt = db.prepare(`SELECT key, value FROM comment_settings`);
  return stmt.all() as { key: string; value: string }[];
}

export function upsertSetting(db: Database.Database, key: string, value: string) {
  const stmt = db.prepare(
    `INSERT INTO comment_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  return stmt.run(key, value).changes;
}
