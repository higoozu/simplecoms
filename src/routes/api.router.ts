import { Hono } from "hono";
import { getDb } from "../db/sqlite.js";
import { enqueueTransaction } from "../db/transaction-queue.js";
import {
  getApprovedByArticle,
  insertComment,
  getCommentById,
  updateCommentStatus,
  deleteComment
} from "../db/repositories/comment.repository.js";
import { insertLike, countLikesByArticle } from "../db/repositories/like.repository.js";
import { buildCommentTree } from "../services/comment.service.js";
import { checkSpam } from "../services/spam.service.js";
import { sendCommentApprovedEmail, sendReplyNotificationEmail } from "../services/email.service.js";
import { sanitizeHtml } from "../utils/sanitizer.js";
import { getClientIp } from "../utils/ip.js";
import { commentCreateSchema, likeSchema } from "../utils/validators.js";
import { verifyToken } from "../utils/crypto.js";
import { checkDbHealth } from "../db/health-check.js";
import { getAvatarUrl } from "../services/avatar.service.js";
import { listAdmins } from "../utils/admins.js";
import { loadSettings } from "../utils/settings.js";
import { verifyTurnstile } from "../services/turnstile.service.js";
import { corsMiddleware } from "../middlewares/cors.js";
import { notifyAdminTelegram } from "../services/telegram.service.js";

function attachAvatars(nodes: any[], adminMap: Map<string, string>): any[] {
  return nodes.map((node) => {
    const safe: any = {
      id: node.id,
      article_id: node.article_id,
      parent_id: node.parent_id,
      reply_to_id: node.reply_to_id,
      reply_to_name: node.reply_to_name,
      author_name: node.author_name,
      author_url: node.author_url,
      content: node.content,
      created_at: node.created_at,
      is_admin: Boolean(node.is_admin),
      avatar_url:
        node.is_admin && node.admin_id && adminMap.has(node.admin_id)
          ? adminMap.get(node.admin_id)
          : getAvatarUrl(node.author_email),
      children: []
    };
    safe.children = node.children ? attachAvatars(node.children, adminMap) : [];
    return safe;
  });
}

const api = new Hono();

api.use("*", corsMiddleware);
api.get("/health", (c) => c.json({ status: "ok", scope: "api" }));

api.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

api.get("/articles/:articleId/comments", (c) => {
  const articleId = c.req.param("articleId");
  const db = getDb();
  const rows = getApprovedByArticle(db, articleId);
  const tree = buildCommentTree(rows);
  const admins = listAdmins();
  const adminMap = new Map<string, string>();
  for (const admin of admins) {
    if (admin.avatar_url) {
      adminMap.set(admin.id ?? admin.email, admin.avatar_url);
    }
  }
  const withAvatars = attachAvatars(tree as any[], adminMap);
  c.header("Cache-Control", "public, max-age=60, s-maxage=300");
  return c.json({ data: withAvatars });
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
  const settings = loadSettings(db);

  if (settings.require_email && !payload.authorEmail) {
    return c.json({ error: "Email required" }, 400);
  }
  if (cleaned.length < settings.min_comment_length || cleaned.length > settings.max_comment_length) {
    return c.json({ error: "Invalid comment length" }, 400);
  }
  const turnstileRequired = Boolean(process.env.TURNSTILE_SECRET_KEY);
  if (turnstileRequired && !payload.turnstile) {
    return c.json({ error: "Missing turnstile token" }, 403);
  }
  if (payload.turnstile) {
    const turnstile = await verifyTurnstile(payload.turnstile, ip);
    if (!turnstile.ok) {
      return c.json({ error: "Turnstile verification failed" }, 403);
    }
  }

  const spamResult = await checkSpam(db, {
    articleId,
    authorName: payload.authorName,
    authorEmail: payload.authorEmail ?? "",
    content: cleaned,
    ip,
    userAgent,
    authorUrl: payload.authorUrl ?? null
  });

  let status = spamResult.isSpam ? "spam" : "pending";
  if (settings.auto_approve && spamResult.score <= settings.auto_approve_threshold) {
    status = "approved";
  }

  const id = await enqueueTransaction(db, () =>
    insertComment(db, {
      article_id: articleId,
      parent_id: payload.parentId ?? null,
      reply_to_id: payload.replyToId ?? null,
      author_name: payload.authorName,
      author_email: payload.authorEmail ?? "",
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
    await notifyAdminTelegram(`Spam comment on ${articleId} by ${payload.authorName}`);
  } else if (status === "pending") {
    await notifyAdminTelegram(`New comment pending on ${articleId} by ${payload.authorName}`);
  } else {
    await notifyAdminTelegram(`New approved comment on ${articleId} by ${payload.authorName}`);
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
  const settings = loadSettings(db);
  if (comment) {
    await sendCommentApprovedEmail({
      to: comment.author_email,
      authorName: comment.author_name,
      articleId: comment.article_id,
      content: comment.content
    });
    if (comment.parent_id && settings.enable_nested_emails) {
      const parent = getCommentById(db, comment.parent_id);
      if (parent) {
        await sendReplyNotificationEmail({
          to: parent.author_email,
          parentAuthor: parent.author_name,
          parentContent: parent.content,
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
