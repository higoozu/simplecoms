import type Database from "better-sqlite3";

export function insertLike(db: Database.Database, articleId: string, ip: string, fingerprint: string) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO article_likes (article_id, ip, fingerprint) VALUES (?, ?, ?)`
  );
  const result = stmt.run(articleId, ip, fingerprint);
  return result.changes;
}

export function countLikesByArticle(db: Database.Database, articleId: string) {
  const stmt = db.prepare(`SELECT COUNT(*) as count FROM article_likes WHERE article_id = ?`);
  return (stmt.get(articleId) as { count: number }).count;
}

export function topLikedArticles(db: Database.Database, limit = 5) {
  const stmt = db.prepare(
    `SELECT article_id as articleId, COUNT(*) as likes
     FROM article_likes
     GROUP BY article_id
     ORDER BY likes DESC
     LIMIT ?`
  );
  return stmt.all(limit) as { articleId: string; likes: number }[];
}
