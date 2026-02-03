import { z } from "zod";

export const commentCreateSchema = z.object({
  authorName: z.string().min(1).max(80),
  authorEmail: z.union([z.string().email().max(120), z.literal("")]).optional().nullable(),
  authorUrl: z.string().url().max(200).optional().nullable(),
  content: z.string().min(1).max(20000),
  parentId: z.string().min(6).max(64).optional().nullable(),
  replyToId: z.string().min(6).max(64).optional().nullable(),
  fingerprint: z.string().min(6).max(200).optional().nullable(),
  turnstile: z.string().min(1).optional().nullable()
});

export const likeSchema = z.object({
  fingerprint: z.string().min(6).max(200),
  turnstile: z.string().min(1).optional().nullable()
});

export const adminUpdateCommentSchema = z.object({
  status: z.enum(["pending", "approved", "spam"]).optional(),
  content: z.string().min(1).max(20000).optional()
});

const toBool = (val: unknown) => {
  if (val === true || val === "true") return true;
  if (val === false || val === "false") return false;
  return val;
};

const toNumber = (val: unknown) => {
  if (typeof val === "string" && val.trim() !== "") return Number(val);
  return val;
};

export const adminSettingsSchema = z.object({
  auto_approve: z.preprocess(toBool, z.boolean()).optional(),
  require_email: z.preprocess(toBool, z.boolean()).optional(),
  max_comment_length: z.preprocess(toNumber, z.number().int().min(1).max(20000)).optional(),
  min_comment_length: z.preprocess(toNumber, z.number().int().min(1).max(20000)).optional(),
  comment_moderation_email: z
    .union([z.string().email(), z.literal("")])
    .optional(),
  enable_email_notifications: z.preprocess(toBool, z.boolean()).optional(),
  enable_approval_emails: z.preprocess(toBool, z.boolean()).optional(),
  auto_approve_threshold: z.preprocess(toNumber, z.number().min(0).max(1)).optional(),
  enable_nested_emails: z.preprocess(toBool, z.boolean()).optional(),
  enable_telegram_notifications: z.preprocess(toBool, z.boolean()).optional()
});

export const adminReplySchema = z.object({
  articleId: z.string().min(1),
  parentId: z.string().min(6).max(64).optional().nullable(),
  replyToId: z.string().min(6).max(64).optional().nullable(),
  content: z.string().min(1).max(5000),
  adminId: z.string().min(1).optional().nullable()
});
