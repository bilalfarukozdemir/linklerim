/**
 * links.json okuma ve doğrulama.
 *
 * links.json tek gerçek kaynak: hem sayfa hem /go/<slug> yönlendirmesi hem de
 * /stats başlıkları oradan gelir. Telefondan GitHub üzerinden düzenle, commit at,
 * site kendini güncellesin.
 */

/** javascript: gibi şemaları Location header'ına koymamak için beyaz liste. */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function isSafeUrl(value) {
	if (typeof value !== "string" || value.trim() === "") return false;
	try {
		return SAFE_PROTOCOLS.has(new URL(value.trim()).protocol);
	} catch {
		return false;
	}
}

/** Bir link kaydını temizler; geçersizse null döner. */
export function normalizeLink(raw) {
	if (!raw || typeof raw !== "object") return null;
	const slug = typeof raw.slug === "string" ? raw.slug.trim().toLowerCase() : "";
	const title = typeof raw.title === "string" ? raw.title.trim() : "";
	const url = typeof raw.url === "string" ? raw.url.trim() : "";
	if (!slug || !title || !isSafeUrl(url)) return null;
	if (!/^[a-z0-9][a-z0-9._-]*$/.test(slug)) return null;
	return {
		slug,
		title,
		url,
		emoji: typeof raw.emoji === "string" ? raw.emoji.trim() : "",
		featured: raw.featured === true,
	};
}

/** Ham JSON'u güvenli bir yapıya indirger. Bozuk kayıtlar sessizce atlanır. */
export function normalize(data) {
	const profile = data && typeof data.profile === "object" && data.profile !== null ? data.profile : {};
	const rawLinks = Array.isArray(data?.links) ? data.links : [];
	const links = [];
	const seen = new Set();
	for (const raw of rawLinks) {
		const link = normalizeLink(raw);
		if (!link || seen.has(link.slug)) continue;
		seen.add(link.slug);
		links.push(link);
	}
	return {
		profile: {
			name: typeof profile.name === "string" ? profile.name : "",
			bio: typeof profile.bio === "string" ? profile.bio : "",
			avatar: typeof profile.avatar === "string" ? profile.avatar : "",
			accent: typeof profile.accent === "string" ? profile.accent : "",
		},
		links,
	};
}

/** links.json'u Pages statik varlıklarından okur. */
export async function loadLinks(env, request) {
	const target = new URL("/links.json", request.url);
	const assetRequest = new Request(target.toString(), { headers: { accept: "application/json" } });
	// env.ASSETS Pages Functions içinde vardır; yoksa (yerel/test) normal fetch.
	const response = env?.ASSETS?.fetch
		? await env.ASSETS.fetch(assetRequest)
		: await fetch(assetRequest);
	if (!response.ok) throw new Error(`links.json okunamadı (HTTP ${response.status})`);
	return normalize(await response.json());
}

/** Slug'a karşılık gelen linki bulur. Büyük/küçük harf ve boşluk toleranslı. */
export function findLink(data, slug) {
	let wanted = typeof slug === "string" ? slug : "";
	try {
		wanted = decodeURIComponent(wanted);
	} catch {
		// bozuk yüzde kodlaması: ham haliyle ara
	}
	wanted = wanted.trim().replace(/\/+$/, "").toLowerCase();
	if (!wanted) return null;
	return data.links.find((link) => link.slug === wanted) ?? null;
}
