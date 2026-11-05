/** Vercel Edge Function — /takvim/panel: Bilal'in takvim yönetimi. Parola /stats ile aynı. */

import { authorize } from "../../lib/stats.js";
import { panelSayfasi } from "../../lib/takvim-panel.js";

export const config = { runtime: "edge" };

const BASLIK = {
	"Content-Type": "text/html; charset=utf-8",
	"Cache-Control": "no-store, private",
	"X-Robots-Tag": "noindex, nofollow",
	"Content-Security-Policy":
		"default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; font-src 'self'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

export default async function handler(request) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
	}
	const izin = await authorize(request, process.env);
	if (izin === "unconfigured") {
		return new Response("STATS_PASSWORD tanımlı değil.", { status: 503, headers: BASLIK });
	}
	if (izin !== "ok") {
		return new Response("Parola gerekli.", {
			status: 401,
			headers: { ...BASLIK, "WWW-Authenticate": 'Basic realm="linklerim takvim", charset="UTF-8"' },
		});
	}
	return new Response(panelSayfasi(), { status: 200, headers: BASLIK });
}
