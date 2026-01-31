import { enqueueEmail } from "./email-queue.js";
import {
  newCommentTemplate,
  commentApprovedTemplate,
  replyNotificationTemplate,
  spamAlertTemplate
} from "./email-template.js";
import { signToken } from "../utils/crypto.js";

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
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Comments <no-reply@example.com>";
  if (!apiKey) return;

  await enqueueEmail(async () => {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html
      })
    }).catch(() => null);
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
  const admins = getAdminEmails();
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
  const admins = getAdminEmails();
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
