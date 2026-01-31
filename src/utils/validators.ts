import { z } from "zod";

export const commentCreateSchema = z.object({
  authorName: z.string().min(1).max(80),
  authorEmail: z.string().email().max(120),
  authorUrl: z.string().url().max(200).optional().nullable(),
  content: z.string().min(1).max(5000),
  parentId: z.number().int().positive().optional().nullable(),
  fingerprint: z.string().min(6).max(200).optional().nullable()
});

export const likeSchema = z.object({
  fingerprint: z.string().min(6).max(200)
});

export const adminUpdateCommentSchema = z.object({
  status: z.enum(["pending", "approved", "spam"]).optional(),
  content: z.string().min(1).max(5000).optional()
});

export const adminSettingsSchema = z.record(z.string().min(1));
