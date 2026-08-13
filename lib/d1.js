/**
 * Cloudflare D1'e HTTP API üzerinden erişim.
 *
 * Site Vercel'de çalışıyor ama sayaç D1'de duruyor: veri ve şema zaten orada,
 * ayrıca yeni bir veritabanı hesabı açmaya gerek kalmıyor.
 *
 * Bu modül D1'in Workers binding'i ile AYNI arayüzü taklit eder
 * (`prepare().bind().run()` ve `batch()`), böylece lib/go.js ve lib/stats.js
 * tek satır değişmeden çalışır.
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * @param {object} config
 * @param {string} config.accountId   - Cloudflare hesap ID'si
 * @param {string} config.databaseId  - D1 veritabanı UUID'si
 * @param {string} config.apiToken    - D1 Edit yetkili API token'ı (secret)
 * @param {typeof fetch} [config.fetchImpl] - test için
 * @returns {object|null} Eksik ayar varsa null — çağıran taraf sayacı atlar.
 */
export function createD1({ accountId, databaseId, apiToken, fetchImpl } = {}) {
	// Kopyala-yapıştırdan gelen boşluk/satır sonu Authorization başlığını bozar.
	const hesap = String(accountId ?? "").trim();
	const veritabani = String(databaseId ?? "").trim();
	const token = String(apiToken ?? "").trim();
	if (!hesap || !veritabani || !token) return null;

	const endpoint = `${API_BASE}/accounts/${hesap}/d1/database/${veritabani}/query`;
	const doFetch = fetchImpl ?? fetch;

	async function exec(sql, params) {
		const response = await doFetch(endpoint, {
			method: "POST",
			headers: {
				authorization: `Bearer ${token}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({ sql, params }),
		});

		let body;
		try {
			body = await response.json();
		} catch {
			throw new Error(`D1 yanıtı okunamadı (HTTP ${response.status})`);
		}

		if (!response.ok || body?.success !== true) {
			const detay =
				body?.errors?.map((e) => `${e.message}${e.code ? ` (kod ${e.code})` : ""}`).join("; ") ||
				"ayrıntı yok";
			throw new Error(`D1 sorgusu başarısız [HTTP ${response.status}]: ${detay}`);
		}

		// Binding API'siyle aynı şekil: { results, success, meta }
		return body.result?.[0] ?? { results: [], success: true, meta: {} };
	}

	return {
		prepare(sql) {
			return {
				sql,
				params: [],
				bind(...params) {
					this.params = params;
					return this;
				},
				run() {
					return exec(this.sql, this.params);
				},
				all() {
					return exec(this.sql, this.params);
				},
			};
		},

		/**
		 * D1 HTTP API'si tek istekte parametreli çoklu ifade kabul etmiyor,
		 * bu yüzden paralel gönderiyoruz. Sıra garantisi gerekmiyor:
		 * iki ifade de farklı tablolara upsert yapıyor.
		 */
		batch(statements) {
			return Promise.all(statements.map((s) => exec(s.sql, s.params)));
		},
	};
}

/** Ortam değişkenlerinden D1 istemcisi kurar. Eksikse null döner. */
export function d1FromEnv(env = {}) {
	return createD1({
		accountId: env.CF_ACCOUNT_ID,
		databaseId: env.CF_DATABASE_ID,
		apiToken: env.CF_API_TOKEN,
	});
}
