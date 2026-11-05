#!/usr/bin/env node
/**
 * Takvim botunu bağlar. Token ekrana ve dosyaya yazılmaz, yalnız Vercel'e gider.
 *
 *   node scripts/takvim-telegram-kur.mjs
 *
 * Önce @BotFather ile bot aç ve botuna /start yaz.
 */

import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";

const ADRES = "https://link.vitrincim.com/takvim/telegram";

const satir = createInterface({ input: process.stdin, output: process.stdout });
const token = (await satir.question("BotFather'dan aldığın token: ")).trim();
satir.close();
if (!/^\d+:[\w-]{20,}$/.test(token)) hataylaCik("Token biçimi tanınmadı.");
// Yapıştırılan token terminal ekranında kalmasın.
process.stdout.write("\x1b[1A\x1b[2K");

async function bot(metot, govde = {}) {
	const yanit = await fetch(`https://api.telegram.org/bot${token}/${metot}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(govde),
	});
	const veri = await yanit.json();
	if (!veri.ok) hataylaCik(`Telegram ${metot}: ${veri.description}`);
	return veri.result;
}

function hataylaCik(metin) {
	console.error(metin);
	process.exit(1);
}

function vercelYaz(ad, deger) {
	const sonuc = spawnSync("npx", ["--yes", "vercel", "env", "add", ad, "production", "--force"], {
		input: deger,
		stdio: ["pipe", "ignore", "pipe"],
		encoding: "utf8",
	});
	if (sonuc.status !== 0) hataylaCik(`${ad} Vercel'e yazılamadı. "npx vercel login" gerekebilir.`);
	console.log(`${ad} Vercel'e yazıldı.`);
}

const ben = await bot("getMe");
console.log(`Bot: @${ben.username}`);

await bot("deleteWebhook");
const guncellemeler = await bot("getUpdates", { timeout: 1 });
const sohbet = guncellemeler
	.map((g) => g.message?.chat)
	.filter((c) => c?.type === "private")
	.at(-1);
if (!sohbet) hataylaCik(`Önce Telegram'da @${ben.username} botuna /start yaz, sonra yeniden çalıştır.`);

const sir = randomBytes(32).toString("hex");
await bot("setWebhook", { url: ADRES, secret_token: sir, allowed_updates: ["callback_query"] });
console.log("Webhook kuruldu.");

vercelYaz("TELEGRAM_BOT_TOKEN", token);
vercelYaz("TELEGRAM_CHAT_ID", String(sohbet.id));
vercelYaz("TELEGRAM_WEBHOOK_SECRET", sir);

await bot("sendMessage", { chat_id: sohbet.id, text: "Takvim bildirimleri bağlandı." });
console.log("Deneme mesajı gönderildi. Şimdi yeniden deploy et.");
