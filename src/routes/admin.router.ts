import { Hono } from "hono";
import { adminAuth } from "../middlewares/admin-auth.js";
import { getDb } from "../db/sqlite.js";
import { enqueueTransaction } from "../db/transaction-queue.js";
import {
  listCommentsByStatus,
  updateCommentStatus,
  deleteComment,
  updateCommentContent,
  getCommentById,
  countComments,
  countCommentsByStatus
} from "../db/repositories/comment.repository.js";
import { getAllSettings, upsertSetting } from "../db/repositories/settings.repository.js";
import { topLikedArticles } from "../db/repositories/like.repository.js";
import { adminUpdateCommentSchema, adminSettingsSchema } from "../utils/validators.js";
import { renderDashboard } from "./admin/dashboard.js";
import { sendCommentApprovedEmail, sendReplyNotificationEmail } from "../services/email.service.js";

const admin = new Hono();

admin.use("*", adminAuth);

admin.get("/health", (c) => c.json({ status: "ok", scope: "admin" }));
admin.get("/", (c) => c.html(renderDashboard()));

admin.get("/admin/comments", (c) => {
  const status = c.req.query("status") || undefined;
  const db = getDb();
  const rows = listCommentsByStatus(db, status);
  return c.json({ data: rows });
});

admin.put("/admin/comments/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = adminUpdateCommentSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const db = getDb();
  await enqueueTransaction(db, () => {
    if (parsed.data.status) {
      updateCommentStatus(db, id, parsed.data.status);
    }
    if (parsed.data.content) {
      updateCommentContent(db, id, parsed.data.content);
    }
  });

  if (parsed.data.status === "approved") {
    const comment = getCommentById(db, id);
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
  }

  return c.json({ ok: true });
});

admin.delete("/admin/comments/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }
  const db = getDb();
  await enqueueTransaction(db, () => deleteComment(db, id));
  return c.json({ ok: true });
});

admin.get("/admin/settings", (c) => {
  const db = getDb();
  const rows = getAllSettings(db);
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return c.json({ data: settings });
});

admin.put("/admin/settings", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = adminSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const db = getDb();
  await enqueueTransaction(db, () => {
    for (const [key, value] of Object.entries(parsed.data)) {
      upsertSetting(db, key, value);
    }
  });

  return c.json({ ok: true });
});

admin.get("/admin/stats", (c) => {
  const db = getDb();
  const totalComments = countComments(db);
  const pendingComments = countCommentsByStatus(db, "pending");
  const topLikes = topLikedArticles(db);
  return c.json({
    data: {
      totalComments,
      pendingComments,
      topLikes
    }
  });
});

export default admin;
