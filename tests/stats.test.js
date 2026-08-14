/** /stats parola kontrolü ve tablo birleştirme testleri. */

import test from "node:test";
import assert from "node:assert/strict";
import { authorize, mergeStats, renderStatsPage } from "../lib/stats.js";

const PAROLA = "cok-gizli-parola";
const ENV = { STATS_PASSWORD: PAROLA };

function req(authHeader) {
	return new Request("https://link.ornek.com/stats", {
		headers: authHeader ? { authorization: authHeader } : {},
	});
}

const basic = (user, pass) => `Basic ${btoa(`${user}:${pass}`)}`;

test("parola secret'ı yoksa sayfa açılmaz", async () => {
	assert.equal(await authorize(req(basic("admin", PAROLA)), {}), "unconfigured");
	assert.equal(await authorize(req(basic("admin", PAROLA)), { STATS_PASSWORD: "" }), "unconfigured");
});

test("doğru parola kabul edilir (Basic ve Bearer)", async () => {
	assert.equal(await authorize(req(basic("admin", PAROLA)), ENV), "ok");
	assert.equal(await authorize(req(basic("", PAROLA)), ENV), "ok"); // kullanıcı adı serbest
	assert.equal(await authorize(req(`Bearer ${PAROLA}`), ENV), "ok");
});

test("yanlış veya eksik parola reddedilir", async () => {
	assert.equal(await authorize(req(basic("admin", "yanlis")), ENV), "unauthorized");
	assert.equal(await authorize(req(basic("admin", PAROLA + "x")), ENV), "unauthorized");
	assert.equal(await authorize(req(`Bearer ${PAROLA}x`), ENV), "unauthorized");
	assert.equal(await authorize(req(), ENV), "unauthorized");
	assert.equal(await authorize(req("Basic ###bozuk###"), ENV), "unauthorized");
	assert.equal(await authorize(req(`Digest ${PAROLA}`), ENV), "unauthorized");
});

test("mergeStats: tıklanmamış linkler 0 ile, silinmiş slug'lar arşiv olarak gelir", () => {
	const rows = mergeStats({
		links: [
			{ slug: "github", title: "GitHub", emoji: "💻", url: "https://github.com/test" },
			{ slug: "blog", title: "Blog", emoji: "", url: "https://ornek.com" },
		],
		totals: [
			{ slug: "blog", count: 12, last_click: "2026-08-13T10:00:00.000Z" },
			{ slug: "eski", count: 3, last_click: "2026-07-01T10:00:00.000Z" },
		],
		recent: [{ slug: "blog", count: 5 }],
	});

	assert.deepEqual(
		rows.map((r) => [r.slug, r.count, r.recent, r.archived]),
		[
			["blog", 12, 5, false],
			["eski", 3, 0, true],
			["github", 0, 0, false],
		],
	);
});

test("başlıklar HTML olarak kaçırılır", () => {
	const html = renderStatsPage({
		rows: [{ slug: "x", title: "<img src=x onerror=alert(1)>", emoji: "", count: 1, recent: 0, lastClick: null, archived: false }],
		generatedAt: "2026-08-13T12:00:00.000Z",
	});
	assert.equal(html.includes("<img src=x"), false);
	assert.equal(html.includes("&lt;img src=x onerror=alert(1)&gt;"), true);
});
