/** Vercel Edge Function — GET /takvim/musait: herkese açık, yalnız boş/dolu döner. */

import { d1FromEnv } from "../../lib/d1.js";
import { json, musaitYaniti } from "../../lib/takvim-api.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
	if (request.method !== "GET") return json({ hata: "Method Not Allowed" }, 405, { Allow: "GET" });
	const db = d1FromEnv(process.env);
	if (!db) return json({ hata: "Takvim şu an kapalı." }, 503);
	try {
		return await musaitYaniti({ db });
	} catch (hata) {
		console.error(String(hata?.message ?? hata));
		return json({ hata: "Takvim okunamadı, biraz sonra yeniden dene." }, 502);
	}
}
