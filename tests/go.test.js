/** /go/<slug> yönlendirme + tık sayacı testleri. */

import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { handleGo, recordClick } from "../lib/go.js";

const IPHONE =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const BASE = "https://link.ornek.com";

const LINKS = {
	profile: { name: "Test Kullanıcı", bio: "bio", accent: "#4f7cff" },
	links: [
		{ slug: "github", title: "GitHub", url: "https://github.com/test", emoji: "💻", featured: true },
		{ slug: "mail", title: "E-posta", url: "mailto:test@ornek.com" },
		{ slug: "kotu", title: "Kötü link", url: "javascript:alert(1)" },
	],
};

/** links.json'u ağa çıkmadan servis et. */
const gercekFetch = globalThis.fetch;
beforeEach(() => {
	globalThis.fetch = async (input) => {
		const url = typeof input === "string" ? input : input.url;
		if (url.endsWith("/links.json")) {
			return new Response(JSON.stringify(LINKS), {
				headers: { "content-type": "application/json" },
			});
		}
		throw new Error(`beklenmeyen istek: ${url}`);
	};
});
afterEach(() => {
	globalThis.fetch = gercekFetch;
});

/** D1 taklidi: çalıştırılan batch'leri kaydeder. */
function fakeDb({ shouldThrow = false } = {}) {
	const batches = [];
	return {
		batches,
		prepare(sql) {
			return {
				sql: sql.replace(/\s+/g, " ").trim(),
				params: [],
				bind(...params) {
					this.params = params;
					return this;
				},
			};
		},
		async batch(statements) {
			if (shouldThrow) throw new Error("D1 down");
			batches.push(statements.map((s) => ({ sql: s.sql, params: s.params })));
			return statements.map(() => ({ success: true }));
		},
	};
}

function request(slug, { method = "GET", headers = { "user-agent": IPHONE } } = {}) {
	return new Request(`${BASE}/go/${slug}`, { method, headers });
}

const go = (slug, opts = {}) =>
	handleGo({ request: opts.request ?? request(slug), db: opts.db, slug, baseUrl: BASE, ...opts.extra });

test("gerçek tık: 302 + hedef URL + D1'e tek kayıt", async () => {
	const db = fakeDb();
	const response = await go("github", { db });

	assert.equal(response.status, 302);
	assert.equal(response.headers.get("location"), "https://github.com/test");
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(db.batches.length, 1);

	const [toplam, gunluk] = db.batches[0];
	assert.match(toplam.sql, /INSERT INTO clicks /);
	assert.equal(toplam.params[0], "github");
	assert.match(toplam.params[1], /^\d{4}-\d{2}-\d{2}T/);
	assert.equal(toplam.params[1], toplam.params[2]);
	assert.match(gunluk.sql, /INSERT INTO clicks_daily/);
	assert.deepEqual(gunluk.params, ["github", toplam.params[1].slice(0, 10)]);

	// Gizlilik: IP / user-agent / referrer hiçbir parametreye sızmamalı
	const tumParametreler = JSON.stringify(db.batches);
	assert.equal(tumParametreler.includes("iPhone"), false);
	assert.equal(tumParametreler.includes("Mozilla"), false);
});

test("bot tıkı sayılmaz ama yönlendirme yine çalışır", async () => {
	const db = fakeDb();
	const response = await go("github", {
		db,
		request: request("github", { headers: { "user-agent": "WhatsApp/2.23.20.0 A" } }),
	});
	assert.equal(response.status, 302);
	assert.equal(response.headers.get("location"), "https://github.com/test");
	assert.equal(db.batches.length, 0);
});

test("HEAD ve prefetch sayılmaz", async () => {
	const db = fakeDb();
	await go("github", { db, request: request("github", { method: "HEAD" }) });
	await go("github", {
		db,
		request: request("github", { headers: { "user-agent": IPHONE, purpose: "prefetch" } }),
	});
	assert.equal(db.batches.length, 0);
});

test("slug büyük/küçük harf ve sondaki slash toleranslı", async () => {
	const db = fakeDb();
	const response = await handleGo({ request: request("GitHub"), db, slug: "GitHub/", baseUrl: BASE });
	assert.equal(response.status, 302);
	assert.equal(db.batches[0][0].params[0], "github");
});

test("mailto linki de yönlendirilir", async () => {
	const response = await go("mail", { db: fakeDb() });
	assert.equal(response.status, 302);
	assert.equal(response.headers.get("location"), "mailto:test@ornek.com");
});

test("bilinmeyen slug ve güvensiz şema 404 döner, sayaç artmaz", async () => {
	const db = fakeDb();
	assert.equal((await go("yok", { db })).status, 404);
	assert.equal((await go("kotu", { db })).status, 404); // javascript: elenir
	assert.equal(db.batches.length, 0);
});

test("D1 hatası yönlendirmeyi bozmaz", async () => {
	const db = fakeDb({ shouldThrow: true });
	const orijinal = console.error;
	console.error = () => {};
	try {
		const response = await go("github", { db });
		assert.equal(response.status, 302);
		assert.equal(response.headers.get("location"), "https://github.com/test");
	} finally {
		console.error = orijinal;
	}
});

test("D1 ayarlanmamışsa site yine çalışır", async () => {
	const response = await go("github", { db: null });
	assert.equal(response.status, 302);
});

test("links.json okunamazsa 404 döner, çökmez", async () => {
	globalThis.fetch = async () => new Response("bulunamadi", { status: 404 });
	const response = await go("github", { db: fakeDb() });
	assert.equal(response.status, 404);
});

test("recordClick UTC gün kovasını doğru hesaplar", async () => {
	const db = fakeDb();
	await recordClick(db, "blog", new Date("2026-08-13T22:45:09.123Z"));
	const [toplam, gunluk] = db.batches[0];
	assert.deepEqual(toplam.params, ["blog", "2026-08-13T22:45:09.123Z", "2026-08-13T22:45:09.123Z"]);
	assert.deepEqual(gunluk.params, ["blog", "2026-08-13"]);
});

test("waitUntil verilirse kayıt arka plana atılır", async () => {
	const db = fakeDb();
	const bekleyenler = [];
	const response = await handleGo({
		request: request("github"),
		db,
		slug: "github",
		baseUrl: BASE,
		waitUntil: (promise) => bekleyenler.push(promise),
	});
	assert.equal(response.status, 302);
	assert.equal(bekleyenler.length, 1);
	await Promise.all(bekleyenler);
	assert.equal(db.batches.length, 1);
});
