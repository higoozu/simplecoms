import Database from "better-sqlite3";
import { backfillPublicIds } from "./migrate-public-id.js";

let dbInstance: Database.Database | null = null;

function createSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      public_id TEXT UNIQUE,
      article_id TEXT NOT NULL,
      parent_id INTEGER,
      reply_to_id INTEGER,
      author_name TEXT NOT NULL,
      author_email TEXT NOT NULL,
      author_url TEXT,
      content TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      is_admin INTEGER NOT NULL DEFAULT 0,
      admin_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS article_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id TEXT NOT NULL,
      ip TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(article_id, ip, fingerprint)
    );

    CREATE TABLE IF NOT EXISTS comment_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function migrateSchema(db: Database.Database) {
  const cols = db.prepare(`PRAGMA table_info(comments)`).all() as { name: string }[];
  const colNames = new Set(cols.map((c) => c.name));

  if (!colNames.has("public_id")) {
    db.exec(`ALTER TABLE comments ADD COLUMN public_id TEXT`);
  }
  if (!colNames.has("reply_to_id")) {
    db.exec(`ALTER TABLE comments ADD COLUMN reply_to_id INTEGER`);
  }
  if (!colNames.has("is_admin")) {
    db.exec(`ALTER TABLE comments ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0`);
  }
  if (!colNames.has("admin_id")) {
    db.exec(`ALTER TABLE comments ADD COLUMN admin_id TEXT`);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_reply_to_id ON comments(reply_to_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_comments_public_id ON comments(public_id)`);
}

export function getDb(dbPath = "data/comments.db") {
  if (dbInstance) {
    return dbInstance;
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("cache_size = 10000");
  db.pragma("foreign_keys = ON");

  createSchema(db);
  migrateSchema(db);
  backfillPublicIds(db);

  dbInstance = db;
  return dbInstance;
}
