import { logger } from "../utils/logger.js";
import { getDb } from "../db/sqlite.js";
import { loadSettings } from "../utils/settings.js";

export async function notifyAdminTelegram(message: string) {
  const settings = loadSettings(getDb());
  if (!settings.enable_telegram_notifications) return;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
  } catch (err) {
    logger.error("telegram_notify_failed", { err: String(err) });
  }
}
