import type Database from "better-sqlite3";
import { getAllSettings, upsertSetting } from "../db/repositories/settings.repository.js";

export interface SystemSettings {
  auto_approve: boolean;
  require_email: boolean;
  max_comment_length: number;
  min_comment_length: number;
  enable_email_notifications: boolean;
  auto_approve_threshold: number;
  enable_nested_emails: boolean;
  enable_approval_emails: boolean;
  enable_telegram_notifications: boolean;
}

const defaults: SystemSettings = {
  auto_approve: process.env.AUTO_APPROVE === "true",
  require_email: process.env.REQUIRE_EMAIL !== "false",
  max_comment_length: Number(process.env.MAX_COMMENT_LENGTH ?? 5000),
  min_comment_length: Number(process.env.MIN_COMMENT_LENGTH ?? 1),
  enable_email_notifications: process.env.ENABLE_EMAIL_NOTIFICATIONS !== "false",
  auto_approve_threshold: Number(process.env.AUTO_APPROVE_THRESHOLD ?? 0.3),
  enable_nested_emails: process.env.ENABLE_NESTED_EMAILS !== "false",
  enable_approval_emails: process.env.ENABLE_APPROVAL_EMAILS !== "false",
  enable_telegram_notifications: process.env.ENABLE_TELEGRAM_NOTIFICATIONS !== "false"
};

export function loadSettings(db: Database.Database): SystemSettings {
  const rows = getAllSettings(db);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    auto_approve: map.has("auto_approve") ? map.get("auto_approve") === "true" : defaults.auto_approve,
    require_email:
      map.has("require_email") ? map.get("require_email") === "true" : defaults.require_email,
    max_comment_length: Number(map.get("max_comment_length") ?? defaults.max_comment_length),
    min_comment_length: Number(map.get("min_comment_length") ?? defaults.min_comment_length),
    enable_email_notifications: map.has("enable_email_notifications")
      ? map.get("enable_email_notifications") === "true"
      : defaults.enable_email_notifications,
    auto_approve_threshold: Number(map.get("auto_approve_threshold") ?? defaults.auto_approve_threshold),
    enable_nested_emails: map.has("enable_nested_emails")
      ? map.get("enable_nested_emails") === "true"
      : defaults.enable_nested_emails,
    enable_approval_emails: map.has("enable_approval_emails")
      ? map.get("enable_approval_emails") === "true"
      : defaults.enable_approval_emails,
    enable_telegram_notifications: map.has("enable_telegram_notifications")
      ? map.get("enable_telegram_notifications") === "true"
      : defaults.enable_telegram_notifications
  };
}

export function saveSettings(db: Database.Database, settings: Partial<SystemSettings>) {
  for (const [key, value] of Object.entries(settings)) {
    upsertSetting(db, key, String(value));
  }
  return loadSettings(db);
}
