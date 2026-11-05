/**
 * Vercel Edge Function — POST /takvim/telegram: Telegram düğmelerinin webhook'u.
 * İstek yalnız TELEGRAM_WEBHOOK_SECRET başlığıyla kabul edilir.
 */

import { d1FromEnv } from "../../lib/d1.js";
import { telegramFromEnv } from "../../lib/telegram.js";
import { json, telegramWebhook } from "../../lib/takvim-api.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
	if (request.method !== "POST") return json({ hata: "Method Not Allowed" }, 405, { Allow: "POST" });
	const db = d1FromEnv(process.env);
	if (!db) return json({ hata: "ayarlı değil" }, 503);
	return telegramWebhook(request, {
		db,
		telegram: telegramFromEnv(process.env),
		sir: String(process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim(),
	});
}
