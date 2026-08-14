/**
 * /stats sayfası: parola kontrolü, D1 sorgusu, HTML üretimi.
 *
 * Parola repoda DEĞİL — Vercel'de `STATS_PASSWORD` ortam değişkeni.
 */

const encoder = new TextEncoder();

/** Uzunluk sızdırmamak için önce SHA-256, sonra sabit zamanlı karşılaştırma. */
async function safeEqual(a, b) {
	const [hashA, hashB] = await Promise.all([
		crypto.subtle.digest("SHA-256", encoder.encode(String(a))),
		crypto.subtle.digest("SHA-256", encoder.encode(String(b))),
	]);
	const viewA = new Uint8Array(hashA);
	const viewB = new Uint8Array(hashB);
	let diff = 0;
	for (let i = 0; i < viewA.length; i++) diff |= viewA[i] ^ viewB[i];
	return diff === 0;
}

/**
 * Authorization header'ını doğrular.
 * Kabul edilenler:
 *   Basic <base64(kullanıcı:parola)>  → tarayıcı parola kutusu çıkarır
 *   Bearer <parola>                   → curl için pratik
 * @returns {Promise<"ok"|"unauthorized"|"unconfigured">}
 */
export async function authorize(request, env) {
	const expected = env?.STATS_PASSWORD;
	if (typeof expected !== "string" || expected === "") return "unconfigured";

	const header = request.headers.get("authorization") ?? "";
	const [scheme, ...rest] = header.split(" ");
	const value = rest.join(" ").trim();
	if (!value) return "unauthorized";

	if (scheme.toLowerCase() === "bearer") {
		return (await safeEqual(value, expected)) ? "ok" : "unauthorized";
	}

	if (scheme.toLowerCase() === "basic") {
		let decoded;
		try {
			decoded = atob(value);
		} catch {
			return "unauthorized";
		}
		// Kullanıcı adı serbest; sadece parola önemli.
		const password = decoded.slice(decoded.indexOf(":") + 1);
		return (await safeEqual(password, expected)) ? "ok" : "unauthorized";
	}

	return "unauthorized";
}

/**
 * links.json ile D1 satırlarını birleştirir.
 * - Hiç tıklanmamış linkler 0 ile görünür.
 * - links.json'dan silinmiş ama D1'de sayacı olan slug'lar "arşiv" olarak gelir.
 */
export function mergeStats({ links = [], totals = [], recent = [] }) {
	const totalBySlug = new Map(totals.map((row) => [row.slug, row]));
	const recentBySlug = new Map(recent.map((row) => [row.slug, Number(row.count) || 0]));

	const rows = links.map((link) => {
		const row = totalBySlug.get(link.slug);
		return {
			slug: link.slug,
			title: link.title,
			emoji: link.emoji,
			url: link.url,
			count: Number(row?.count) || 0,
			recent: recentBySlug.get(link.slug) ?? 0,
			lastClick: row?.last_click ?? null,
			archived: false,
		};
	});

	for (const row of totals) {
		if (links.some((link) => link.slug === row.slug)) continue;
		rows.push({
			slug: row.slug,
			title: row.slug,
			emoji: "",
			url: "",
			count: Number(row.count) || 0,
			recent: recentBySlug.get(row.slug) ?? 0,
			lastClick: row.last_click ?? null,
			archived: true,
		});
	}

	rows.sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "tr"));
	return rows;
}

/** D1'den toplam ve son N günlük sayıları çeker. */
export async function fetchStats(db, { days = 7, now = new Date() } = {}) {
	const since = new Date(now.getTime() - (days - 1) * 86400000).toISOString().slice(0, 10);
	const [totals, recent] = await db.batch([
		db.prepare("SELECT slug, count, first_click, last_click FROM clicks"),
		db.prepare("SELECT slug, SUM(count) AS count FROM clicks_daily WHERE day >= ? GROUP BY slug").bind(since),
	]);
	return { totals: totals?.results ?? [], recent: recent?.results ?? [], since };
}

export function escapeHtml(value) {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function formatDate(iso) {
	if (!iso) return "—";
	return `${String(iso).slice(0, 10)} ${String(iso).slice(11, 16)}`;
}

/** İstatistik sayfası HTML'i. Sayfa ile aynı tasarım dili, tek dosya. */
export function renderStatsPage({ rows = [], days = 7, generatedAt = null, name = "" } = {}) {
	const total = rows.reduce((sum, row) => sum + row.count, 0);
	const recentTotal = rows.reduce((sum, row) => sum + row.recent, 0);
	const max = rows.reduce((peak, row) => Math.max(peak, row.count), 0);

	const body = rows.length
		? rows
				.map((row) => {
					const width = max > 0 ? Math.round((row.count / max) * 100) : 0;
					const label = `${row.emoji ? `${escapeHtml(row.emoji)} ` : ""}${escapeHtml(row.title)}`;
					return `<tr${row.archived ? ' class="archived"' : ""}>
	<td class="name"><span class="bar" style="width:${width}%"></span><span class="label">${label}${row.archived ? ' <em>(arşiv)</em>' : ""}</span><code>/go/${escapeHtml(row.slug)}</code></td>
	<td class="num">${row.count.toLocaleString("tr-TR")}</td>
	<td class="num muted">${row.recent.toLocaleString("tr-TR")}</td>
	<td class="date muted">${escapeHtml(formatDate(row.lastClick))}</td>
</tr>`;
				})
				.join("\n")
		: `<tr><td colspan="4" class="empty">Henüz tık yok.</td></tr>`;

	return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>İstatistikler${name ? ` — ${escapeHtml(name)}` : ""}</title>
<style>
:root{
	color-scheme:light;
	--bg:#fbfbfd; --surface:#ffffff; --border:#e4e6ee; --text:#16181d;
	--muted:#6b7080; --accent:#4f7cff; --bar:#eef2ff;
}
@media (prefers-color-scheme:dark){
	:root{
		color-scheme:dark;
		--bg:#0d0f14; --surface:#161a22; --border:#262b36; --text:#e8eaf0;
		--muted:#8d93a5; --accent:#6f92ff; --bar:#1b2233;
	}
}
*{box-sizing:border-box}
body{margin:0;padding:2rem 1rem 3rem;background:var(--bg);color:var(--text);
	font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
	-webkit-font-smoothing:antialiased}
main{max-width:44rem;margin:0 auto}
h1{font-size:1.25rem;margin:0 0 .25rem;letter-spacing:-.01em}
.sub{color:var(--muted);font-size:.875rem;margin:0 0 1.5rem}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1.5rem}
.card{background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:.875rem 1rem}
.card b{display:block;font-size:1.75rem;font-weight:650;letter-spacing:-.02em;line-height:1.2}
.card span{color:var(--muted);font-size:.8125rem}
table{width:100%;border-collapse:collapse;background:var(--surface);
	border:1px solid var(--border);border-radius:14px;overflow:hidden}
th,td{padding:.75rem .875rem;text-align:left;border-bottom:1px solid var(--border)}
th{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}
tr:last-child td{border-bottom:0}
td.name{position:relative;isolation:isolate}
.bar{position:absolute;inset:0 auto 0 0;background:var(--bar);z-index:-1}
.label{display:block;font-weight:550}
td.name code{font-size:.75rem;color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}
.date{white-space:nowrap;font-size:.8125rem}
.muted{color:var(--muted);font-weight:450}
.archived .label{opacity:.7}
.archived em{font-style:normal;font-size:.75rem;color:var(--muted)}
.empty{color:var(--muted);text-align:center;padding:2rem}
footer{margin-top:1.25rem;color:var(--muted);font-size:.75rem;line-height:1.6}
a{color:var(--accent)}
@media (max-width:30rem){
	.cards{grid-template-columns:1fr}
	.date{display:none}
	th.date{display:none}
}
</style>
</head>
<body>
<main>
	<h1>İstatistikler</h1>
	<p class="sub">Bot ve önizleme istekleri sayılmaz. IP veya kişisel veri saklanmaz.</p>

	<div class="cards">
		<div class="card"><b>${total.toLocaleString("tr-TR")}</b><span>toplam tık</span></div>
		<div class="card"><b>${recentTotal.toLocaleString("tr-TR")}</b><span>son ${days} gün</span></div>
	</div>

	<table>
		<thead><tr><th>Link</th><th class="num">Toplam</th><th class="num">${days} gün</th><th class="date">Son tık (UTC)</th></tr></thead>
		<tbody>
${body}
		</tbody>
	</table>

	<footer>
		Üretildi: ${escapeHtml(formatDate(generatedAt))} UTC · <a href="/">← sayfaya dön</a>
	</footer>
</main>
</body>
</html>`;
}
