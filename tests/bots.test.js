/** Bot filtresi testleri — yanlış eleme kadar yanlış sayma da hata. */

import test from "node:test";
import assert from "node:assert/strict";
import { isPreviewBot, isPrefetch, isNonNavigation, shouldCount } from "../lib/bots.js";

const IPHONE =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const GERCEK_TARAYICILAR = [
	IPHONE,
	"Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0",
	// Regresyon: CUBOT gerçek bir Android telefon markası. Düz "bot" araması bunu eler.
	"Mozilla/5.0 (Linux; Android 10; CUBOT_X30 Build/QP1A.190711.020) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Mobile Safari/537.36",
	"Mozilla/5.0 (Linux; Android 12; CUBOT KING KONG 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
	// Instagram / Facebook uygulama içi tarayıcı = gerçek kullanıcı
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Instagram 331.0.0.32.90",
];

const ONIZLEME_BOTLARI = [
	"WhatsApp/2.23.20.0 A",
	"WhatsApp/2.2429.10 N",
	"facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
	"Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
	"Slackbot 1.0 (+https://api.slack.com/robots)",
	"Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
	"Twitterbot/1.0",
	"TelegramBot (like TwitterBot)",
	"Mozilla/5.0 (compatible; LinkedInBot/1.0; +http://www.linkedin.com)",
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15 Applebot/0.1", // iMessage önizlemesi
	"SkypeUriPreview Preview/0.5",
	"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
	"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
	"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.1; +https://openai.com/gptbot",
	"curl/8.7.1",
	"Wget/1.21.4",
	"python-requests/2.32.3",
	"Go-http-client/2.0",
	"PostmanRuntime/7.39.0",
	"Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/126.0.0.0 Safari/537.36",
	"redditbot/1.0",
	"Mozilla/5.0 (compatible; SomeUnknownCrawler/3.1)",
];

test("gerçek tarayıcılar bot sayılmaz", () => {
	for (const ua of GERCEK_TARAYICILAR) {
		assert.equal(isPreviewBot(ua), false, `yanlışlıkla elendi: ${ua}`);
	}
});

test("önizleme botları ve HTTP araçları elenir", () => {
	for (const ua of ONIZLEME_BOTLARI) {
		assert.equal(isPreviewBot(ua), true, `elenmedi: ${ua}`);
	}
});

test("boş veya eksik user-agent bot sayılır", () => {
	assert.equal(isPreviewBot(""), true);
	assert.equal(isPreviewBot("   "), true);
	assert.equal(isPreviewBot(null), true);
	assert.equal(isPreviewBot(undefined), true);
});

test("prefetch header'ları yakalanır", () => {
	assert.equal(isPrefetch(new Headers({ purpose: "prefetch" })), true);
	assert.equal(isPrefetch(new Headers({ "x-purpose": "preview" })), true);
	assert.equal(isPrefetch(new Headers({ "x-moz": "prefetch" })), true);
	assert.equal(isPrefetch(new Headers({ "sec-purpose": "prefetch;prerender" })), true);
	assert.equal(isPrefetch(new Headers({ "user-agent": IPHONE })), false);
});

test("navigasyon olmayan Fetch Metadata istekleri elenir", () => {
	assert.equal(isNonNavigation(new Headers({ "sec-fetch-mode": "cors" })), true);
	assert.equal(isNonNavigation(new Headers({ "sec-fetch-dest": "iframe" })), true);
	assert.equal(
		isNonNavigation(new Headers({ "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" })),
		false,
	);
	assert.equal(isNonNavigation(new Headers({})), false); // header yoksa karar UA'ya kalır
});

const url = "https://ornek.pages.dev/go/github";

test("shouldCount: sadece gerçek tarayıcı navigasyonu sayılır", () => {
	const gercek = new Request(url, {
		method: "GET",
		headers: { "user-agent": IPHONE, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" },
	});
	assert.equal(shouldCount(gercek), true);

	// Fetch Metadata göndermeyen eski ama gerçek tarayıcı
	assert.equal(shouldCount(new Request(url, { headers: { "user-agent": IPHONE } })), true);
});

test("shouldCount: bot, prefetch, HEAD ve iframe sayılmaz", () => {
	const bot = new Request(url, { headers: { "user-agent": "WhatsApp/2.23.20.0 A" } });
	assert.equal(shouldCount(bot), false);

	const head = new Request(url, { method: "HEAD", headers: { "user-agent": IPHONE } });
	assert.equal(shouldCount(head), false);

	const prefetch = new Request(url, { headers: { "user-agent": IPHONE, purpose: "prefetch" } });
	assert.equal(shouldCount(prefetch), false);

	const iframe = new Request(url, {
		headers: { "user-agent": IPHONE, "sec-fetch-mode": "navigate", "sec-fetch-dest": "iframe" },
	});
	assert.equal(shouldCount(iframe), false);

	const bos = new Request(url, { headers: {} });
	assert.equal(shouldCount(bos), false);
});
