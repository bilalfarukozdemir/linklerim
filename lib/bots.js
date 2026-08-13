/**
 * Bot / önizleme filtresi.
 *
 * WhatsApp, Slack, Discord, iMessage, X, Telegram gibi istemciler bir link
 * paylaşıldığında önizleme kartı için URL'i kendileri çeker. Tarayıcılar da
 * link'leri önceden getirir (prefetch). Bunlar sayılırsa tık sayıları
 * 2-3 kat şişer. Burası o istekleri eler.
 *
 * Not: filtre SADECE sayacı etkiler. Elenen istek de 302 ile hedefe gider.
 */

/** Kendini açıkça tanıtan önizleme botları / crawler'lar / HTTP kütüphaneleri. */
const BOT_UA = [
	// Mesajlaşma & sosyal önizleme
	"whatsapp",
	"facebookexternalhit",
	"facebookcatalog",
	"facebookbot",
	"facebot",
	"meta-externalagent",
	"twitterbot",
	"slackbot",
	"slack-imgproxy",
	"discordbot",
	"discordapp",
	"telegrambot",
	"linkedinbot",
	"skypeuripreview",
	"redditbot",
	"pinterest",
	"tumblr",
	"vkshare",
	"viber",
	"line-podcast",
	"snapchat",
	"threadsbot",
	"bluesky",
	"mastodon",
	"pleroma",
	"misskey",
	"synapse", // Matrix / Element önizlemesi
	"nextcloud-news",
	"quora link preview",
	"xing-contenttabreceiver",
	"outbrain",
	"nuzzel",
	"embedly",
	"iframely",
	"showyoubot",
	"w3c_validator",
	"bitrix link preview",
	"telesphoreo",
	"applebot", // iMessage / Safari zengin önizleme
	"applenewsbot",

	// Arama motorları & SEO tarayıcıları
	"googlebot",
	"google-inspectiontool",
	"googleother",
	"google favicon",
	"bingbot",
	"bingpreview",
	"duckduckbot",
	"yandex",
	"baiduspider",
	"sogou",
	"exabot",
	"ahrefsbot",
	"semrushbot",
	"mj12bot",
	"dotbot",
	"petalbot",
	"seznambot",
	"archive.org_bot",
	"ia_archiver",

	// LLM / veri toplayıcılar
	"gptbot",
	"oai-searchbot",
	"chatgpt-user",
	"claudebot",
	"claude-web",
	"anthropic-ai",
	"perplexitybot",
	"amazonbot",
	"bytespider",
	"ccbot",
	"cohere-ai",
	"diffbot",

	// HTTP kütüphaneleri / araçlar / izleme servisleri
	"curl/",
	"wget",
	"python-requests",
	"python-urllib",
	"aiohttp",
	"httpx",
	"go-http-client",
	"node-fetch",
	"undici",
	"axios",
	"got (",
	"okhttp",
	"java/",
	"apache-httpclient",
	"libwww-perl",
	"guzzlehttp",
	"postmanruntime",
	"insomnia",
	"headlesschrome",
	"phantomjs",
	"puppeteer",
	"playwright",
	"chrome-lighthouse",
	"pagespeed",
	"gtmetrix",
	"pingdom",
	"uptimerobot",
	"statuscake",
	"site24x7",
	"newrelicpinger",
	"datadog",
];

/**
 * Listede olmayan, kendini bot diye tanıtan istemciler için genel kalıplar:
 *   1) ayrı kelime olarak geçen isim  →  "(compatible; Bot; +http://…)"
 *   2) sürümle bitişik bileşik isim   →  "SomeUnknownCrawler/3.1", "FooBot/2.0"
 */
const GENERIC_UA = new RegExp(
	"(?:^|[^a-z0-9])(?:bot|crawler|spider|scraper|fetcher|monitoring|validator|probe|scanner|preview)(?:[^a-z0-9]|$)" +
		"|[a-z0-9](?:bot|crawler|spider|scraper)[/;)\\s.,-]",
);

/**
 * Bilinen yanlış pozitifler. CUBOT gerçek bir Android telefon markası:
 * "CUBOT KING KONG" içindeki "bot" bileşik kalıba takılır, kullanıcı elenirdi.
 */
const NOT_BOTS = /cubot/g;

/** Prefetch / prerender sinyali taşıyan header'lar. */
const PREFETCH_HEADERS = ["purpose", "x-purpose", "x-moz", "sec-purpose"];
const PREFETCH_VALUES = /prefetch|preview|prerender|instant/;

/**
 * User-agent bir önizleme botuna / otomatik istemciye mi ait?
 * Boş user-agent bot sayılır: gerçek tarayıcı navigasyonu her zaman UA gönderir.
 */
export function isPreviewBot(userAgent) {
	const ua = String(userAgent ?? "").toLowerCase().trim();
	if (ua === "") return true;
	if (BOT_UA.some((needle) => ua.includes(needle))) return true;
	return GENERIC_UA.test(ua.replace(NOT_BOTS, ""));
}

/** İstek tarayıcı prefetch/prerender'ı mı? (kullanıcı henüz tıklamadı) */
export function isPrefetch(headers) {
	for (const name of PREFETCH_HEADERS) {
		const value = headers?.get?.(name);
		if (value && PREFETCH_VALUES.test(value.toLowerCase())) return true;
	}
	return false;
}

/**
 * Fetch Metadata header'ları (Chrome, Edge, Firefox, Safari 16.4+) isteğin
 * gerçek bir sayfa navigasyonu olduğunu kanıtlar. Üst seviye navigasyon her
 * zaman `mode: navigate` + `dest: document` gönderir; `mode: cors` (fetch),
 * `dest: iframe` (gömülü çerçeve) gibi değerler tık değildir.
 * Header hiç yoksa karar UA filtresine bırakılır.
 */
export function isNonNavigation(headers) {
	const mode = headers?.get?.("sec-fetch-mode");
	if (mode && mode.toLowerCase() !== "navigate") return true;
	const dest = headers?.get?.("sec-fetch-dest");
	if (dest && dest.toLowerCase() !== "document") return true;
	return false;
}

/**
 * Bu istek tık olarak sayılmalı mı?
 * Sadece gerçek bir tarayıcıdan gelen GET navigasyonu sayılır.
 */
export function shouldCount(request) {
	if (request.method !== "GET") return false; // HEAD = önizleme yoklaması
	const headers = request.headers;
	if (isPreviewBot(headers?.get?.("user-agent"))) return false;
	if (isPrefetch(headers)) return false;
	if (isNonNavigation(headers)) return false;
	return true;
}
