/**
 * /go/<slug> yönlendirme + tık sayacı mantığı.
 *
 * Gizlilik: IP, user-agent, referrer HİÇBİR yerde saklanmaz. D1'e sadece
 * slug + zaman damgası + sayaç yazılır.
 *
 * Sayaç asla yönlendirmeyi bloklamaz veya bozmaz: kayıt waitUntil() ile
 * arka planda yapılır, hata olursa yutulur.
 */

import { shouldCount } from "./bots.js";
import { loadLinks, findLink } from "./links.js";

/** Tıklamayı D1'e yazar: toplam sayaç + günlük kova. */
export async function recordClick(db, slug, now = new Date()) {
	const timestamp = now.toISOString();
	const day = timestamp.slice(0, 10); // YYYY-MM-DD (UTC)
	await db.batch([
		db
			.prepare(
				`INSERT INTO clicks (slug, count, first_click, last_click)
				 VALUES (?, 1, ?, ?)
				 ON CONFLICT(slug) DO UPDATE SET
				   count = count + 1,
				   last_click = excluded.last_click`,
			)
			.bind(slug, timestamp, timestamp),
		db
			.prepare(
				`INSERT INTO clicks_daily (slug, day, count)
				 VALUES (?, ?, 1)
				 ON CONFLICT(slug, day) DO UPDATE SET count = count + 1`,
			)
			.bind(slug, day),
	]);
}

function redirectTo(url) {
	return new Response(null, {
		status: 302,
		headers: {
			Location: url,
			// Yönlendirme asla önbelleğe alınmasın: links.json değişince
			// eski hedefe gitmemeli.
			"Cache-Control": "no-store",
			"Referrer-Policy": "no-referrer",
			"X-Robots-Tag": "noindex",
		},
	});
}

function notFound(message) {
	const body = `<!doctype html><meta charset="utf-8"><title>Link bulunamadı</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<style>body{font:16px/1.6 system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#fbfbfd;color:#16181d}a{color:#4f7cff}@media(prefers-color-scheme:dark){body{background:#0d0f14;color:#e8eaf0}}</style>
<div><p>${message}</p><p><a href="/">← Ana sayfa</a></p></div>`;
	return new Response(body, {
		status: 404,
		headers: {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Robots-Tag": "noindex",
		},
	});
}

/**
 * @param {object} ctx
 * @param {Request} ctx.request
 * @param {object|null} ctx.db   - D1 istemcisi (yoksa sayaç atlanır)
 * @param {string} ctx.slug      - URL'deki slug
 * @param {string|URL} [ctx.baseUrl] - links.json'un çözüleceği adres
 * @param {(p: Promise<any>) => void} [ctx.waitUntil]
 */
export async function handleGo({ request, db, slug, baseUrl, waitUntil }) {
	let data;
	try {
		data = await loadLinks(baseUrl ?? request.url);
	} catch {
		return notFound("Link listesi şu an okunamadı.");
	}

	const link = findLink(data, slug);
	if (!link) return notFound("Böyle bir link yok.");

	if (db && shouldCount(request)) {
		const task = recordClick(db, link.slug).catch((error) => {
			// Sayaç yazılamadıysa kullanıcı yine de hedefe gitsin.
			console.error("tık kaydedilemedi:", error?.message ?? error);
		});
		if (typeof waitUntil === "function") waitUntil(task);
		else await task;
	}

	return redirectTo(link.url);
}
