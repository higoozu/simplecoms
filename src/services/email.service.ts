import { enqueueEmail } from "./email-queue.js";
import {
  newCommentTemplate,
  commentApprovedTemplate,
  replyNotificationTemplate,
  spamAlertTemplate
} from "./email-template.js";
import { signToken } from "../utils/crypto.js";
import { logger } from "../utils/logger.js";
import { getDb } from "../db/sqlite.js";
import { loadSettings } from "../utils/settings.js";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

function getPublicBaseUrl() {
  return process.env.PUBLIC_BASE_URL ?? "";
}

async function sendEmail(to: string[] | string, subject: string, html: string) {
  const provider = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();
  const fromName = process.env.EMAIL_FROM_NAME ?? "Comments";
  const from = process.env.EMAIL_FROM ?? "no-reply@example.com";
  const fromField = `${fromName} <${from}>`;

  await enqueueEmail(async () => {
    try {
      if (provider === "sendgrid") {
        const apiKey = process.env.SENDGRID_API_KEY;
        if (!apiKey) return;
        await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            personalizations: [{ to: Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }] }],
            from: { email: from, name: fromName },
            subject,
            content: [{ type: "text/html", value: html }]
          })
        });
      } else {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) return;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            from: fromField,
            to,
            subject,
            html
          })
        });
      }
      logger.info("email_sent", { subject });
    } catch (err) {
      logger.error("email_send_failed", { err: String(err) });
    }
  });
}

export function buildModerationLinks(commentId: number) {
  const secret = process.env.TOKEN_SECRET ?? "";
  const base = getPublicBaseUrl();
  const exp = Date.now() + 1000 * 60 * 60 * 24;
  const approveToken = signToken({ action: "approve", commentId, exp }, secret);
  const deleteToken = signToken({ action: "delete", commentId, exp }, secret);
  return {
    approveUrl: `${base}/email/approve?token=${approveToken}`,
    deleteUrl: `${base}/email/delete?token=${deleteToken}`
  };
}

export async function sendNewCommentEmail(input: {
  commentId: number;
  articleId: string;
  authorName: string;
  content: string;
}) {
  const db = getDb();
  const settings = loadSettings(db);
  if (!settings.enable_email_notifications) return;
  const admins = settings.comment_moderation_email
    ? [settings.comment_moderation_email]
    : getAdminEmails();
  if (!admins.length) return;

  const links = buildModerationLinks(input.commentId);
  await sendEmail(
    admins,
    `New comment on ${input.articleId}`,
    newCommentTemplate({
      articleId: input.articleId,
      authorName: input.authorName,
      content: input.content,
      approveUrl: links.approveUrl,
      deleteUrl: links.deleteUrl
    })
  );
}

export async function sendCommentApprovedEmail(input: {
  to: string;
  authorName: string;
  articleId: string;
  content: string;
}) {
  const settings = loadSettings(getDb());
  if (!settings.enable_email_notifications) return;
  await sendEmail(
    input.to,
    `Your comment is approved: ${input.articleId}`,
    commentApprovedTemplate({
      authorName: input.authorName,
      articleId: input.articleId,
      content: input.content
    })
  );
}

export async function sendReplyNotificationEmail(input: {
  to: string;
  parentAuthor: string;
  articleId: string;
  replyAuthor: string;
  replyContent: string;
}) {
  const settings = loadSettings(getDb());
  if (!settings.enable_email_notifications || !settings.enable_nested_emails) return;
  await sendEmail(
    input.to,
    `New reply on ${input.articleId}`,
    replyNotificationTemplate({
      parentAuthor: input.parentAuthor,
      articleId: input.articleId,
      replyAuthor: input.replyAuthor,
      replyContent: input.replyContent
    })
  );
}

export async function sendSpamAlertEmail(input: {
  articleId: string;
  authorName: string;
  reasons: string[];
  content: string;
}) {
  const settings = loadSettings(getDb());
  if (!settings.enable_email_notifications) return;
  const admins = settings.comment_moderation_email
    ? [settings.comment_moderation_email]
    : getAdminEmails();
  if (!admins.length) return;

  await sendEmail(
    admins,
    `Spam detected on ${input.articleId}`,
    spamAlertTemplate({
      articleId: input.articleId,
      authorName: input.authorName,
      reasons: input.reasons,
      content: input.content
    })
  );
}
