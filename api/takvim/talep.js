/** Vercel Edge Function — POST /takvim/talep: öğrencinin ders talebi. */

import { d1FromEnv } from "../../lib/d1.js";
import { telegramFromEnv } from "../../lib/telegram.js";
import { json, talepOlustur } from "../../lib/takvim-api.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
	if (request.method !== "POST") return json({ hata: "Method Not Allowed" }, 405, { Allow: "POST" });
	const db = d1FromEnv(process.env);
	if (!db) return json({ hata: "Takvim şu an kapalı." }, 503);
	try {
		return await talepOlustur(request, { db, telegram: telegramFromEnv(process.env) });
	} catch (hata) {
		console.error(String(hata?.message ?? hata));
		return json({ hata: "Talep kaydedilemedi, biraz sonra yeniden dene." }, 502);
	}
}
