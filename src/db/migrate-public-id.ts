import type Database from "better-sqlite3";
import { generatePublicId } from "../utils/id.js";

export function backfillPublicIds(db: Database.Database) {
  const rows = db.prepare(`SELECT id FROM comments WHERE public_id IS NULL OR public_id = ''`).all() as { id: number }[];
  if (!rows.length) return;
  const stmt = db.prepare(`UPDATE comments SET public_id = ? WHERE id = ?`);
  const trx = db.transaction(() => {
    for (const row of rows) {
      stmt.run(generatePublicId(), row.id);
    }
  });
  trx();
}
