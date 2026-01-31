export type CommentStatus = "pending" | "approved" | "spam";

export interface Comment {
  id: number;
  articleId: string;
  parentId: number | null;
  replyToId: number | null;
  authorName: string;
  authorEmail: string;
  authorUrl: string | null;
  content: string;
  ip: string | null;
  userAgent: string | null;
  isAdmin: boolean;
  adminId: string | null;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleLike {
  id: number;
  articleId: string;
  ip: string;
  fingerprint: string;
  createdAt: string;
}

export interface CommentSetting {
  key: string;
  value: string;
}
