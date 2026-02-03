import type Database from "better-sqlite3";

export interface CommentRow {
  id: number;
  public_id: string;
  article_id: string;
  parent_id: number | null;
  reply_to_id: number | null;
  author_name: string;
  author_email: string;
  author_url: string | null;
  content: string;
  ip: string | null;
  user_agent: string | null;
  is_admin: number;
  admin_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function getApprovedByArticle(db: Database.Database, articleId: string) {
  const stmt = db.prepare(
    `SELECT * FROM comments WHERE article_id = ? AND status = 'approved' ORDER BY created_at ASC`
  );
  return stmt.all(articleId) as CommentRow[];
}

export function countApprovedByArticle(db: Database.Database, articleId: string) {
  const stmt = db.prepare(
    `SELECT COUNT(*) as count FROM comments WHERE article_id = ? AND status = 'approved'`
  );
  return (stmt.get(articleId) as { count: number }).count;
}

export function insertComment(
  db: Database.Database,
  row: Omit<
    CommentRow,
    "id" | "created_at" | "updated_at" | "status" | "is_admin" | "admin_id"
  > & { status?: string; is_admin?: number; admin_id?: string | null }
) {
  const stmt = db.prepare(
    `INSERT INTO comments (
      public_id, article_id, parent_id, reply_to_id, author_name, author_email, author_url, content,
      ip, user_agent, is_admin, admin_id, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    row.public_id,
    row.article_id,
    row.parent_id ?? null,
    row.reply_to_id ?? null,
    row.author_name,
    row.author_email,
    row.author_url ?? null,
    row.content,
    row.ip ?? null,
    row.user_agent ?? null,
    row.is_admin ?? 0,
    row.admin_id ?? null,
    row.status ?? "pending"
  );
  return result.lastInsertRowid as number;
}

export function listCommentsByStatus(db: Database.Database, status?: string) {
  if (!status) {
    const stmt = db.prepare(`SELECT * FROM comments ORDER BY created_at DESC`);
    return stmt.all() as CommentRow[];
  }
  const stmt = db.prepare(`SELECT * FROM comments WHERE status = ? ORDER BY created_at DESC`);
  return stmt.all(status) as CommentRow[];
}

export function listCommentsByStatusPaged(
  db: Database.Database,
  status: string | undefined,
  limit: number,
  offset: number
) {
  if (!status) {
    const stmt = db.prepare(
      `SELECT * FROM comments ORDER BY created_at DESC LIMIT ? OFFSET ?`
    );
    return stmt.all(limit, offset) as CommentRow[];
  }
  const stmt = db.prepare(
    `SELECT * FROM comments WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  );
  return stmt.all(status, limit, offset) as CommentRow[];
}

export function getCommentById(db: Database.Database, id: number) {
  const stmt = db.prepare(`SELECT * FROM comments WHERE id = ?`);
  return stmt.get(id) as CommentRow | undefined;
}

export function getCommentByPublicId(db: Database.Database, publicId: string) {
  const stmt = db.prepare(`SELECT * FROM comments WHERE public_id = ?`);
  return stmt.get(publicId) as CommentRow | undefined;
}

export function getIdByPublicId(db: Database.Database, publicId: string) {
  const numeric = /^\d+$/.test(publicId);
  if (numeric) {
    const row = db.prepare(`SELECT id FROM comments WHERE id = ?`).get(Number(publicId)) as
      | { id: number }
      | undefined;
    return row?.id ?? null;
  }
  const stmt = db.prepare(`SELECT id FROM comments WHERE public_id = ?`);
  const row = stmt.get(publicId) as { id: number } | undefined;
  return row?.id ?? null;
}

export function countRecentByIp(db: Database.Database, ip: string, minutes: number) {
  const stmt = db.prepare(
    `SELECT COUNT(*) as count FROM comments WHERE ip = ? AND created_at >= datetime('now', ?) `
  );
  return (stmt.get(ip, `-${minutes} minutes`) as { count: number }).count;
}

export function countRecentDuplicateContent(
  db: Database.Database,
  ip: string,
  content: string,
  minutes: number
) {
  const stmt = db.prepare(
    `SELECT COUNT(*) as count FROM comments WHERE ip = ? AND content = ? AND created_at >= datetime('now', ?)`
  );
  return (stmt.get(ip, content, `-${minutes} minutes`) as { count: number }).count;
}

export function countRecentByEmail(db: Database.Database, email: string, minutes: number) {
  const stmt = db.prepare(
    `SELECT COUNT(*) as count FROM comments WHERE author_email = ? AND created_at >= datetime('now', ?)`
  );
  return (stmt.get(email, `-${minutes} minutes`) as { count: number }).count;
}

export function updateCommentStatus(db: Database.Database, id: number, status: string) {
  const stmt = db.prepare(
    `UPDATE comments SET status = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(status, id).changes;
}

export function updateCommentContent(db: Database.Database, id: number, content: string) {
  const stmt = db.prepare(
    `UPDATE comments SET content = ?, updated_at = datetime('now') WHERE id = ?`
  );
  return stmt.run(content, id).changes;
}

export function deleteComment(db: Database.Database, id: number) {
  const stmt = db.prepare(`DELETE FROM comments WHERE id = ?`);
  return stmt.run(id).changes;
}

export function countComments(db: Database.Database) {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM comments`);
  return (stmt.get() as { count: number }).count;
}

export function countCommentsByStatus(db: Database.Database, status: string) {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM comments WHERE status = ?`);
  return (stmt.get(status) as { count: number }).count;
}
