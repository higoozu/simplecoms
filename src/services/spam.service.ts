import type Database from "better-sqlite3";
import { countRecentByIp, countRecentDuplicateContent, countRecentByEmail } from "../db/repositories/comment.repository.js";

export interface SpamCheckInput {
  articleId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  ip: string | null;
  userAgent: string | null;
  authorUrl: string | null;
}

export interface SpamResult {
  score: number;
  isSpam: boolean;
  reasons: string[];
  akismet: boolean | null;
}

const tempEmailDomains = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "yopmail.com",
  "trashmail.com"
]);

function localScore(db: Database.Database, input: SpamCheckInput) {
  let score = 0;
  const reasons: string[] = [];

  if (input.ip) {
    const recent = countRecentByIp(db, input.ip, 5);
    if (recent >= 5) {
      score += 0.25;
      reasons.push("rate_limit");
    }
  }

  if (input.ip) {
    const dup = countRecentDuplicateContent(db, input.ip, input.content, 3);
    if (dup >= 2) {
      score += 0.2;
      reasons.push("duplicate_content");
    }
  }

  const emailDomain = input.authorEmail.split("@")[1]?.toLowerCase() ?? "";
  if (tempEmailDomains.has(emailDomain)) {
    score += 0.2;
    reasons.push("temporary_email");
  }

  const linkCount = (input.content.match(/https?:\/\//g) ?? []).length;
  if (linkCount >= 3) {
    score += 0.15;
    reasons.push("too_many_links");
  }

  if (input.content.length < 10) {
    score += 0.1;
    reasons.push("too_short");
  }

  if (input.ip) {
    const recentByEmail = countRecentByEmail(db, input.authorEmail, 3);
    if (recentByEmail >= 4) {
      score += 0.1;
      reasons.push("email_burst");
    }
  }

  return { score: Math.min(score, 1), reasons };
}

async function akismetCheck(input: SpamCheckInput) {
  const key = process.env.AKISMET_KEY;
  const blog = process.env.AKISMET_BLOG;
  if (!key || !blog) {
    return null;
  }

  const params = new URLSearchParams({
    blog,
    user_ip: input.ip ?? "",
    user_agent: input.userAgent ?? "",
    comment_type: "comment",
    comment_author: input.authorName,
    comment_author_email: input.authorEmail,
    comment_author_url: input.authorUrl ?? "",
    comment_content: input.content
  });

  const res = await fetch(`https://${key}.rest.akismet.com/1.1/comment-check`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString()
  }).catch(() => null);

  if (!res || !res.ok) {
    return null;
  }

  const text = await res.text();
  return text.trim() === "true";
}

export async function checkSpam(db: Database.Database, input: SpamCheckInput): Promise<SpamResult> {
  const local = localScore(db, input);
  const akismet = await akismetCheck(input);
  let score = local.score;

  if (akismet === true) {
    score = Math.max(score, 0.9);
  }

  const threshold = Number(process.env.SPAM_THRESHOLD ?? 0.7);
  return {
    score,
    isSpam: score >= threshold,
    reasons: local.reasons,
    akismet
  };
}
