import { enqueueEmail } from "./email-queue.js";
import { commentApprovedTemplate, replyNotificationTemplate } from "./email-template.js";
import { logger } from "../utils/logger.js";
import { getDb } from "../db/sqlite.js";
import { loadSettings } from "../utils/settings.js";

const dedupeMap = new Map<string, number>();
const DAY_MS = 24 * 60 * 60 * 1000;

function shouldSendDedupe(key: string) {
  const now = Date.now();
  const last = dedupeMap.get(key) ?? 0;
  if (now - last < DAY_MS) return false;
  dedupeMap.set(key, now);
  return true;
}

function getArticleUrl(articleId: string) {
  const base = process.env.PUBLIC_SITE_URL ?? process.env.PUBLIC_BASE_URL ?? "";
  if (!base) return "";
  const decoded = decodeURIComponent(articleId);
  return `${base.replace(/\/$/, "")}${decoded}`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const provider = (process.env.EMAIL_PROVIDER ?? "resend").toLowerCase();
  const fromName = process.env.EMAIL_FROM_NAME ?? "Comments";
  const from = process.env.EMAIL_FROM ?? "no-reply@example.com";
  const fromField = `${fromName} <${from}>`;

  const attemptSend = async () => {
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
          personalizations: [{ to: [{ email: to }] }],
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
  };

  await enqueueEmail(async () => {
    for (let i = 0; i < 2; i += 1) {
      try {
        await attemptSend();
        logger.info("email_sent", { subject });
        return;
      } catch (err) {
        logger.warn("email_send_retry", { err: String(err) });
      }
    }
    logger.error("email_send_failed", { subject });
  });
}

export async function sendCommentApprovedEmail(input: {
  to: string;
  authorName: string;
  articleId: string;
  content: string;
}) {
  const settings = loadSettings(getDb());
  if (!settings.enable_email_notifications || !settings.enable_approval_emails) return;
  const key = `approval:${input.to}`;
  if (!shouldSendDedupe(key)) return;
  const viewUrl = getArticleUrl(input.articleId);
  await sendEmail(
    input.to,
    `Your comment is approved: ${input.articleId}`,
    commentApprovedTemplate({
      authorName: input.authorName,
      articleId: input.articleId,
      content: input.content,
      viewUrl
    })
  );
}

export async function sendReplyNotificationEmail(input: {
  to: string;
  parentAuthor: string;
  parentContent: string;
  articleId: string;
  replyAuthor: string;
  replyContent: string;
}) {
  const settings = loadSettings(getDb());
  if (!settings.enable_email_notifications || !settings.enable_nested_emails) return;
  const key = `reply:${input.to}`;
  if (!shouldSendDedupe(key)) return;
  const viewUrl = getArticleUrl(input.articleId);
  await sendEmail(
    input.to,
    `New reply on ${input.articleId}`,
    replyNotificationTemplate({
      parentAuthor: input.parentAuthor,
      parentContent: input.parentContent,
      articleId: input.articleId,
      replyAuthor: input.replyAuthor,
      replyContent: input.replyContent,
      viewUrl
    })
  );
}
