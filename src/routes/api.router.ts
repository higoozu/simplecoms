import { Hono } from "hono";
import { getDb } from "../db/sqlite.js";
import { enqueueTransaction } from "../db/transaction-queue.js";
import { getApprovedByArticle, insertComment, getCommentById, updateCommentStatus, deleteComment } from "../db/repositories/comment.repository.js";
import { insertLike, countLikesByArticle } from "../db/repositories/like.repository.js";
import { buildCommentTree } from "../services/comment.service.js";
import { checkSpam } from "../services/spam.service.js";
import {
  sendNewCommentEmail,
  sendSpamAlertEmail,
  sendCommentApprovedEmail,
  sendReplyNotificationEmail
} from "../services/email.service.js";
import { sanitizeHtml } from "../utils/sanitizer.js";
import { getClientIp } from "../utils/ip.js";
import { commentCreateSchema, likeSchema } from "../utils/validators.js";
import { verifyToken } from "../utils/crypto.js";
import { checkDbHealth } from "../db/health-check.js";

const api = new Hono();

api.get("/health", (c) => c.json({ status: "ok", scope: "api" }));

api.get("/api/health", (c) => {
  const health = checkDbHealth();
  return c.json({ status: "ok", ...health });
});

api.get("/articles/:articleId/comments", (c) => {
  const articleId = c.req.param("articleId");
  const db = getDb();
  const rows = getApprovedByArticle(db, articleId);
  const tree = buildCommentTree(rows);
  c.header("Cache-Control", "public, max-age=60, s-maxage=300");
  return c.json({ data: tree });
});

api.post("/articles/:articleId/comments", async (c) => {
  const articleId = c.req.param("articleId");
  const body = await c.req.json().catch(() => null);
  const parsed = commentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const payload = parsed.data;
  const cleaned = sanitizeHtml(payload.content);
  const db = getDb();
  const ip = getClientIp(c);
  const userAgent = c.req.header("user-agent") ?? null;

  const spamResult = await checkSpam(db, {
    articleId,
    authorName: payload.authorName,
    authorEmail: payload.authorEmail,
    content: cleaned,
    ip,
    userAgent,
    authorUrl: payload.authorUrl ?? null
  });

  const status = spamResult.isSpam ? "spam" : "pending";

  const id = await enqueueTransaction(db, () =>
    insertComment(db, {
      article_id: articleId,
      parent_id: payload.parentId ?? null,
      author_name: payload.authorName,
      author_email: payload.authorEmail,
      author_url: payload.authorUrl ?? null,
      content: cleaned,
      ip,
      user_agent: userAgent,
      status
    })
  );

  if (!id) {
    return c.json({ error: "Failed to create comment" }, 500);
  }

  if (status === "spam") {
    await sendSpamAlertEmail({
      articleId,
      authorName: payload.authorName,
      reasons: spamResult.reasons,
      content: cleaned
    });
  } else {
    await sendNewCommentEmail({
      commentId: id as number,
      articleId,
      authorName: payload.authorName,
      content: cleaned
    });
  }

  return c.json({ id, status }, 201);
});

api.post("/articles/:articleId/likes", async (c) => {
  const articleId = c.req.param("articleId");
  const body = await c.req.json().catch(() => null);
  const parsed = likeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const db = getDb();
  const ip = getClientIp(c);
  if (!ip) {
    return c.json({ error: "Unable to resolve IP" }, 400);
  }

  await enqueueTransaction(db, () =>
    insertLike(db, articleId, ip, parsed.data.fingerprint)
  );

  const count = countLikesByArticle(db, articleId);
  return c.json({ articleId, likes: count });
});

api.get("/email/approve", async (c) => {
  const token = c.req.query("token");
  const secret = process.env.TOKEN_SECRET ?? "";
  if (!token || !secret) return c.text("Invalid token", 400);

  const payload = verifyToken<{ action: string; commentId: number; exp: number }>(token, secret);
  if (!payload || payload.action !== "approve" || payload.exp < Date.now()) {
    return c.text("Invalid token", 400);
  }

  const db = getDb();
  await enqueueTransaction(db, () => updateCommentStatus(db, payload.commentId, "approved"));
  const comment = getCommentById(db, payload.commentId);
  if (comment) {
    await sendCommentApprovedEmail({
      to: comment.author_email,
      authorName: comment.author_name,
      articleId: comment.article_id,
      content: comment.content
    });
    if (comment.parent_id) {
      const parent = getCommentById(db, comment.parent_id);
      if (parent) {
        await sendReplyNotificationEmail({
          to: parent.author_email,
          parentAuthor: parent.author_name,
          articleId: comment.article_id,
          replyAuthor: comment.author_name,
          replyContent: comment.content
        });
      }
    }
  }
  return c.text("Approved");
});

api.get("/email/delete", async (c) => {
  const token = c.req.query("token");
  const secret = process.env.TOKEN_SECRET ?? "";
  if (!token || !secret) return c.text("Invalid token", 400);

  const payload = verifyToken<{ action: string; commentId: number; exp: number }>(token, secret);
  if (!payload || payload.action !== "delete" || payload.exp < Date.now()) {
    return c.text("Invalid token", 400);
  }
  const db = getDb();
  await enqueueTransaction(db, () => deleteComment(db, payload.commentId));
  return c.text("Deleted");
});

export default api;
