/**
 * Vercel Edge Function — /stats
 *
 * Parola korumalı. `STATS_PASSWORD` ortam değişkeninden okunur;
 * Vercel'de secret olarak tanımlanır, repoda durmaz.
 */

import { loadLinks } from "../lib/links.js";
import { d1FromEnv } from "../lib/d1.js";
import { authorize, fetchStats, mergeStats, renderStatsPage } from "../lib/stats.js";

export const config = { runtime: "edge" };

const DAYS = 7;

const BASE_HEADERS = {
	"Content-Type": "text/html; charset=utf-8",
	"Cache-Control": "no-store, private",
	"X-Robots-Tag": "noindex, nofollow",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "no-referrer",
	"Content-Security-Policy":
		"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
};

function page(html, status = 200, extraHeaders = {}) {
	return new Response(html, { status, headers: { ...BASE_HEADERS, ...extraHeaders } });
}

function notice(title, message, status) {
	return page(
		`<!doctype html><html lang="tr"><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1.5rem;text-align:center;
background:#fbfbfd;color:#16181d;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
h1{font-size:1.125rem;margin:0 0 .5rem}p{color:#6b7080;margin:0;max-width:32rem}
@media(prefers-color-scheme:dark){body{background:#0d0f14;color:#e8eaf0}p{color:#8d93a5}}</style>
<div><h1>${title}</h1><p>${message}</p></div></html>`,
		status,
	);
}

export default async function handler(request) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return page("Method Not Allowed", 405, { Allow: "GET, HEAD" });
	}

	const auth = await authorize(request, process.env);

	if (auth === "unconfigured") {
		return notice(
			"İstatistikler kapalı",
			"STATS_PASSWORD tanımlı değil. Vercel → Project → Settings → Environment Variables bölümünden ekleyip yeniden deploy et.",
			503,
		);
	}

	if (auth === "unauthorized") {
		return page(
			`<!doctype html><html lang="tr"><meta charset="utf-8"><title>Parola gerekli</title>
<meta name="robots" content="noindex,nofollow"><p>Parola gerekli.</p></html>`,
			401,
			{ "WWW-Authenticate": 'Basic realm="linklerim istatistik", charset="UTF-8"' },
		);
	}

	const db = d1FromEnv(process.env);
	if (!db) {
		return notice(
			"Veritabanı bağlı değil",
			"CF_ACCOUNT_ID, CF_DATABASE_ID veya CF_API_TOKEN tanımlı değil. Vercel'in ortam değişkenlerine ekleyip yeniden deploy et.",
			503,
		);
	}

	const now = new Date();
	const origin = new URL(request.url).origin;

	const [data, stats] = await Promise.all([
		loadLinks(origin).catch(() => ({ profile: {}, links: [] })),
		fetchStats(db, { days: DAYS, now }),
	]);

	const rows = mergeStats({ links: data.links, totals: stats.totals, recent: stats.recent });

	return page(
		renderStatsPage({
			rows,
			days: DAYS,
			generatedAt: now.toISOString(),
			name: data.profile?.name ?? "",
		}),
	);
}
