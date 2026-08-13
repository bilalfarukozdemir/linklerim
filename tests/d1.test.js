/** D1 HTTP istemcisi: binding API'siyle aynı şekilde davranmalı. */

import test from "node:test";
import assert from "node:assert/strict";
import { createD1, d1FromEnv } from "../lib/d1.js";

const AYAR = {
	accountId: "hesap123",
	databaseId: "db456",
	apiToken: "gizli-token",
};

function fakeFetch(cevaplar = []) {
	const cagrilar = [];
	const fn = async (url, init) => {
		cagrilar.push({ url, init, body: JSON.parse(init.body) });
		const cevap = cevaplar.shift() ?? {
			ok: true,
			payload: { success: true, result: [{ results: [], success: true, meta: {} }] },
		};
		return new Response(JSON.stringify(cevap.payload), {
			status: cevap.ok ? 200 : 500,
			headers: { "content-type": "application/json" },
		});
	};
	fn.cagrilar = cagrilar;
	return fn;
}

test("eksik ayarda null döner — sayaç sessizce devre dışı kalır", () => {
	assert.equal(createD1({}), null);
	assert.equal(createD1({ accountId: "a", databaseId: "b" }), null);
	assert.equal(d1FromEnv({}), null);
	assert.equal(d1FromEnv({ CF_ACCOUNT_ID: "a", CF_API_TOKEN: "t" }), null);
});

test("ortam değişkenlerinden istemci kurar", () => {
	const db = d1FromEnv({ CF_ACCOUNT_ID: "a", CF_DATABASE_ID: "b", CF_API_TOKEN: "t" });
	assert.equal(typeof db.prepare, "function");
	assert.equal(typeof db.batch, "function");
});

test("doğru uç noktaya, token ve parametrelerle istek atar", async () => {
	const fetchImpl = fakeFetch();
	const db = createD1({ ...AYAR, fetchImpl });

	await db.prepare("INSERT INTO clicks (slug) VALUES (?)").bind("github").run();

	assert.equal(fetchImpl.cagrilar.length, 1);
	const [cagri] = fetchImpl.cagrilar;
	assert.equal(
		cagri.url,
		"https://api.cloudflare.com/client/v4/accounts/hesap123/d1/database/db456/query",
	);
	assert.equal(cagri.init.method, "POST");
	assert.equal(cagri.init.headers.authorization, "Bearer gizli-token");
	assert.deepEqual(cagri.body, { sql: "INSERT INTO clicks (slug) VALUES (?)", params: ["github"] });
});

test("batch her ifadeyi ayrı istekle gönderir", async () => {
	const fetchImpl = fakeFetch();
	const db = createD1({ ...AYAR, fetchImpl });

	await db.batch([
		db.prepare("INSERT INTO clicks VALUES (?)").bind("a"),
		db.prepare("INSERT INTO clicks_daily VALUES (?, ?)").bind("a", "2026-08-13"),
	]);

	assert.equal(fetchImpl.cagrilar.length, 2);
	assert.deepEqual(fetchImpl.cagrilar[1].body.params, ["a", "2026-08-13"]);
});

test("sonucu binding API'siyle aynı şekilde döner", async () => {
	const fetchImpl = fakeFetch([
		{
			ok: true,
			payload: {
				success: true,
				result: [{ results: [{ slug: "github", count: 3 }], success: true, meta: { duration: 1 } }],
			},
		},
	]);
	const db = createD1({ ...AYAR, fetchImpl });
	const sonuc = await db.prepare("SELECT slug, count FROM clicks").all();
	assert.deepEqual(sonuc.results, [{ slug: "github", count: 3 }]);
});

test("API hatası anlaşılır şekilde fırlatılır", async () => {
	const fetchImpl = fakeFetch([
		{ ok: false, payload: { success: false, errors: [{ message: "Authentication error" }] } },
	]);
	const db = createD1({ ...AYAR, fetchImpl });
	await assert.rejects(() => db.prepare("SELECT 1").run(), /Authentication error/);
});

test("bozuk JSON yanıtı da hata olarak yakalanır", async () => {
	const fetchImpl = async () => new Response("<html>502</html>", { status: 502 });
	const db = createD1({ ...AYAR, fetchImpl });
	await assert.rejects(() => db.prepare("SELECT 1").run(), /okunamadı/);
});
