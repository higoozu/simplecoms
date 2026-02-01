import { Hono } from "hono";
import { adminAuth } from "../middlewares/admin-auth.js";
import { getDb } from "../db/sqlite.js";
import { enqueueTransaction } from "../db/transaction-queue.js";
import {
  listCommentsByStatusPaged,
  updateCommentStatus,
  deleteComment,
  updateCommentContent,
  getCommentById,
  insertComment,
  countComments,
  countCommentsByStatus
} from "../db/repositories/comment.repository.js";
import { topLikedArticles } from "../db/repositories/like.repository.js";
import { adminUpdateCommentSchema, adminReplySchema, adminSettingsSchema } from "../utils/validators.js";
import { loadSettings, saveSettings } from "../utils/settings.js";
import { runHealthCheck } from "../db/health-monitor.js";
import { createBackup, cleanupBackups } from "../db/backup.js";
import { restoreLatestBackup } from "../db/restore.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readLastLines(filePath: string, limit = 50) {
  try {
    const raw = readFileSync(filePath, "utf8");
    const lines = raw.trim().split("\n");
    return lines.slice(Math.max(lines.length - limit, 0)).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  } catch {
    return [];
  }
}
import { renderDashboard } from "./admin/dashboard.js";
import { renderSystemPage } from "./admin/system.js";
import { sendCommentApprovedEmail, sendReplyNotificationEmail } from "../services/email.service.js";
import { findAdminByEmail, listAdmins } from "../utils/admins.js";

const admin = new Hono();

admin.use("*", adminAuth);

admin.get("/health", (c) => c.json({ status: "ok", scope: "admin" }));
admin.get("/admin", (c) => c.html(renderDashboard()));
admin.get("/admin/system", (c) => c.html(renderSystemPage()));

admin.get("/admin/admins", (c) => {
  return c.json({ data: listAdmins() });
});

admin.get("/admin/comments", (c) => {
  const status = c.req.query("status") || undefined;
  const page = Math.max(Number(c.req.query("page") ?? 1), 1);
  const pageSize = Math.min(Math.max(Number(c.req.query("pageSize") ?? 20), 1), 100);
  const offset = (page - 1) * pageSize;
  const db = getDb();
  const rows = listCommentsByStatusPaged(db, status, pageSize, offset);
  const total = status ? countCommentsByStatus(db, status) : countComments(db);
  return c.json({ data: rows, page, pageSize, total });
});

admin.get("/admin/settings", (c) => {
  const db = getDb();
  return c.json({ data: loadSettings(db) });
});

admin.put("/admin/settings", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = adminSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }
  const db = getDb();
  const settings = saveSettings(db, parsed.data);
  return c.json({ data: settings });
});

admin.get("/admin/health", (c) => {
  return c.json({ data: { status: "ok" } });
});

admin.get("/admin/audit", (c) => {
  const limit = Math.min(Math.max(Number(c.req.query("limit") ?? 50), 1), 200);
  const logDir = process.env.LOG_DIR || "logs";
  const filePath = resolve(logDir, "admin-access.log");
  const entries = readLastLines(filePath, limit);
  return c.json({ data: entries });
});

admin.post("/admin/backup", async (c) => {
  const result = await createBackup();
  cleanupBackups(7);
  return c.json({ data: result });
});

admin.post("/admin/restore", async (c) => {
  const restored = await restoreLatestBackup();
  return c.json({ data: { restored } });
});

admin.post("/admin/comments/reply", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = adminReplySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid input", details: parsed.error.flatten() }, 400);
  }

  const headerEmail = c.req.header("cf-access-authenticated-user-email") ?? "";
  const adminProfile =
    (parsed.data.adminId
      ? listAdmins().find(
          (admin) => admin.email === parsed.data.adminId || admin.id === parsed.data.adminId
        )
      : null) ?? findAdminByEmail(headerEmail);

  if (!adminProfile) {
    return c.json({ error: "Admin profile not found" }, 400);
  }

  const db = getDb();
  const id = await enqueueTransaction(db, () =>
    insertComment(db, {
      article_id: parsed.data.articleId,
      parent_id: parsed.data.parentId ?? null,
      reply_to_id: parsed.data.replyToId ?? null,
      author_name: adminProfile.name,
      author_email: adminProfile.email,
      author_url: adminProfile.website ?? null,
      content: parsed.data.content,
      ip: null,
      user_agent: null,
      is_admin: 1,
      admin_id: adminProfile.id ?? adminProfile.email,
      status: "approved"
    })
  );

  if (parsed.data.replyToId) {
    const parent = getCommentById(db, parsed.data.replyToId);
    if (parent) {
      await sendReplyNotificationEmail({
        to: parent.author_email,
        parentAuthor: parent.author_name,
        articleId: parsed.data.articleId,
        replyAuthor: adminProfile.name,
        replyContent: parsed.data.content
      });
    }
  }

  return c.json({ ok: true, id });
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
