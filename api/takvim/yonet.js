/** Vercel Edge Function — /takvim/yonet: panelin veri ucu. Parola /stats ile aynı. */

import { d1FromEnv } from "../../lib/d1.js";
import { authorize } from "../../lib/stats.js";
import { json, panelIslemi, panelVerisi } from "../../lib/takvim-api.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
	if ((await authorize(request, process.env)) !== "ok") return json({ hata: "Parola gerekli." }, 401);
	const db = d1FromEnv(process.env);
	if (!db) return json({ hata: "Veritabanı bağlı değil." }, 503);
	if (request.method === "GET") return panelVerisi({ db });
	if (request.method === "POST") return panelIslemi(request, { db });
	return json({ hata: "Method Not Allowed" }, 405, { Allow: "GET, POST" });
}
