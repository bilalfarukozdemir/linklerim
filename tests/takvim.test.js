/** Ders takvimi: saat kuralları, gizlilik, talep ve karar akışı. */

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { sahteD1 } from "./_sahte-d1.js";
import {
	VARSAYILAN_HAFTA,
	bolgeSaatYazisi,
	gecerliSaatMi,
	haftaDogrula,
	haftaDuzelt,
	musaitGunler,
	saatDilimiDuzelt,
	saatYazisi,
	talebeAcikMi,
	talepDogrula,
	telefonDuzelt,
	yerelSimdi,
} from "../lib/takvim.js";
import { musaitYaniti, panelIslemi, panelVerisi, talepOlustur, telegramWebhook } from "../lib/takvim-api.js";

// 5 Kasım 2026 Perşembe, Türkiye saatiyle 14:00.
const SIMDI = new Date("2026-11-05T11:00:00Z");
const HAFTA = haftaDuzelt(null);
const URL_TALEP = "https://link.vitrincim.com/takvim/talep";

function sahteTelegram() {
	const giden = [];
	return {
		chatId: "42",
		giden,
		gonder: async (text, dugmeler) => giden.push({ tur: "gonder", text, dugmeler }),
		duzenle: async (id, text, dugmeler) => giden.push({ tur: "duzenle", id, text, dugmeler }),
		cevapla: async (id, text) => giden.push({ tur: "cevapla", text }),
	};
}

function talepIstegi(ek = {}, baslik = {}) {
	return new Request(URL_TALEP, {
		method: "POST",
		headers: { "content-type": "application/json", origin: "https://link.vitrincim.com", ...baslik },
		body: JSON.stringify({
			start: "2026-11-06T19:00",
			name: "Ayşe Yılmaz",
			phone: "0532 111 22 33",
			note: "",
			onay: true,
			...ek,
		}),
	});
}

function dugme(data, fromId = 42) {
	return new Request("https://link.vitrincim.com/takvim/telegram", {
		method: "POST",
		headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "sir" },
		body: JSON.stringify({ callback_query: { id: "q", data, from: { id: fromId }, message: { message_id: 7 } } }),
	});
}

function kayit(db, id = 1) {
	return db.vt.prepare("SELECT * FROM takvim_kayit WHERE id = ?").get(id);
}

test("Türkiye saati UTC+3 hesaplanır", () => {
	assert.equal(yerelSimdi(SIMDI), "2026-11-05T14:00");
});

test("taşan tarih ve bozuk biçim geçersiz", () => {
	assert.equal(gecerliSaatMi("2026-11-06T19:00"), true);
	assert.equal(gecerliSaatMi("2026-02-30T19:00"), false);
	assert.equal(gecerliSaatMi("2026-11-06T24:00"), false);
	assert.equal(gecerliSaatMi("2026-11-06T19:30"), false);
	assert.equal(gecerliSaatMi(null), false);
});

test("saat yazısı Türkçe ve gece yarısını doğru gösterir", () => {
	assert.equal(saatYazisi("2026-11-06T19:00"), "6 Kasım Cuma, 19:00–20:00");
	assert.equal(saatYazisi("2026-11-06T23:00"), "6 Kasım Cuma, 23:00–00:00");
});

test("talep yalnız haftalık aralıkta, 3 saat sonrasından 28 gün içine alınır", () => {
	assert.equal(talebeAcikMi("2026-11-06T19:00", HAFTA, SIMDI), true);
	assert.equal(talebeAcikMi("2026-11-06T18:00", HAFTA, SIMDI), false, "hafta içi 19 öncesi");
	assert.equal(talebeAcikMi("2026-11-06T23:00", HAFTA, SIMDI), false, "son blok 22-23");
	assert.equal(talebeAcikMi("2026-11-07T10:00", HAFTA, SIMDI), true, "cumartesi 10");
	assert.equal(talebeAcikMi("2026-12-02T19:00", HAFTA, SIMDI), true, "28. gün");
	assert.equal(talebeAcikMi("2026-12-03T19:00", HAFTA, SIMDI), false, "ufuk dışı");
	const aksam = new Date("2026-11-05T16:30:00Z"); // 19:30
	assert.equal(talebeAcikMi("2026-11-05T22:00", HAFTA, aksam), false, "3 saatten yakın");
	assert.equal(talebeAcikMi("2026-11-05T22:00", HAFTA, new Date("2026-11-05T16:00:00Z")), true);
});

test("bütün hafta görünür: açık olmayan saat kapalıdır, geçmiş saat listelenmez", () => {
	const hafta = { ...HAFTA, 5: null };
	const gunler = musaitGunler({ hafta, doluSaatler: [], now: SIMDI });
	assert.equal(gunler.length, 28);
	const cuma = gunler.find((g) => g.gun === "2026-11-06").saatler;
	assert.equal(cuma.length, 16, "08:00–23:00");
	assert.ok(cuma.every((s) => s.durum === "kapali"));
	const pazartesi = gunler.find((g) => g.gun === "2026-11-09").saatler;
	assert.equal(pazartesi.find((s) => s.start.endsWith("11:00")).durum, "kapali");
	assert.equal(pazartesi.find((s) => s.start.endsWith("19:00")).durum, "bos");
	const aksam = new Date("2026-11-05T17:30:00Z"); // 20:30
	const bugun = musaitGunler({ hafta: HAFTA, doluSaatler: ["2026-11-05T19:00", "2026-11-05T22:00"], now: aksam })[0];
	assert.deepEqual(bugun.saatler, [
		{ start: "2026-11-05T21:00", durum: "kapali" },
		{ start: "2026-11-05T22:00", durum: "dolu" },
		{ start: "2026-11-05T23:00", durum: "kapali" },
	]);
});

test("telefon biçimleri sadeleşir, bozuk numara reddedilir", () => {
	assert.equal(telefonDuzelt("0532 111 22 33"), "905321112233");
	assert.equal(telefonDuzelt("532-111-22-33"), "905321112233");
	assert.equal(telefonDuzelt("+90 (532) 111 22 33"), "905321112233");
	assert.equal(telefonDuzelt("+49 151 23456789"), "4915123456789");
	assert.equal(telefonDuzelt("0049 151 23456789"), "4915123456789");
	assert.equal(telefonDuzelt("123"), null);
	assert.equal(telefonDuzelt("abc"), null);
	assert.equal(telefonDuzelt(""), null);
});

test("form doğrulaması: onay ve ad zorunlu, konu sabit", () => {
	const temel = { start: "2026-11-06T19:00", name: "Ayşe", phone: "05321112233", onay: true };
	assert.equal(talepDogrula(temel, { hafta: HAFTA, now: SIMDI }).deger.topic, "Yapay zekâ");
	assert.equal(talepDogrula({ ...temel, topic: "Matematik" }, { hafta: HAFTA, now: SIMDI }).deger.topic, "Yapay zekâ");
	assert.ok(talepDogrula({ ...temel, onay: false }, { hafta: HAFTA, now: SIMDI }).hata);
	assert.ok(talepDogrula({ ...temel, name: " " }, { hafta: HAFTA, now: SIMDI }).hata);
	assert.ok(talepDogrula({ ...temel, start: "2026-11-06T12:00" }, { hafta: HAFTA, now: SIMDI }).hata);
});

test("hafta doğrulaması ters aralığı reddeder, kapalı günü kabul eder", () => {
	assert.ok(haftaDogrula({ ...VARSAYILAN_HAFTA, 3: null }));
	assert.equal(haftaDogrula({ ...VARSAYILAN_HAFTA, 3: [20, 19] }), null);
	assert.equal(haftaDogrula({ ...VARSAYILAN_HAFTA, 3: [19, 25] }), null);
	assert.equal(haftaDogrula(null), null);
});

test("talep kaydolur, Telegram'a düğmeyle gider, herkes yalnız dolu görür", async () => {
	const db = sahteD1();
	const telegram = sahteTelegram();
	const yanit = await talepOlustur(talepIstegi({ name: "Ayşe <b>" }), { db, telegram, now: SIMDI });
	assert.equal(yanit.status, 201);

	assert.equal(kayit(db).phone, "905321112233");
	assert.equal(telegram.giden.length, 1);
	assert.match(telegram.giden[0].text, /Ayşe &lt;b&gt;/, "HTML kaçırılır");
	assert.equal(telegram.giden[0].dugmeler[0][0].callback_data, "t:onay:1");

	const metin = await (await musaitYaniti({ db, now: SIMDI })).text();
	assert.ok(metin.includes('"start":"2026-11-06T19:00","durum":"dolu"'));
	assert.ok(!metin.includes("Ayşe"), "ad sızmaz");
	assert.ok(!metin.includes("90532"), "telefon sızmaz");
});

test("aynı saate ikinci talep 409 alır", async () => {
	const db = sahteD1();
	await talepOlustur(talepIstegi(), { db, telegram: null, now: SIMDI });
	const ikinci = await talepOlustur(talepIstegi({ phone: "05329998877" }), { db, telegram: null, now: SIMDI });
	assert.equal(ikinci.status, 409);
	assert.equal((await ikinci.json()).dolu, true);
});

test("Telegram düşse de talep kaybolmaz, panelde görünür", async () => {
	const db = sahteD1();
	const telegram = { ...sahteTelegram(), gonder: async () => { throw new Error("ağ yok"); } };
	const hataKaydi = console.error;
	console.error = () => {};
	const yanit = await talepOlustur(talepIstegi(), { db, telegram, now: SIMDI });
	console.error = hataKaydi;
	assert.equal(yanit.status, 201);
	const panel = await (await panelVerisi({ db, now: SIMDI })).json();
	assert.equal(panel.kayitlar[0].name, "Ayşe Yılmaz");
	assert.equal(panel.kayitlar[0].status, "bekliyor");
});

test("bal küpü dolu ise başarılı görünür, kayıt düşmez", async () => {
	const db = sahteD1();
	const telegram = sahteTelegram();
	const yanit = await talepOlustur(talepIstegi({ site: "http://spam" }), { db, telegram, now: SIMDI });
	assert.equal(yanit.status, 200);
	assert.equal(kayit(db), undefined);
	assert.equal(telegram.giden.length, 0);
});

test("başka siteden gelen istek reddedilir", async () => {
	const db = sahteD1();
	const yanit = await talepOlustur(talepIstegi({}, { origin: "https://kotu.example" }), { db, telegram: null, now: SIMDI });
	assert.equal(yanit.status, 403);
});

test("aynı numaradan üçüncü bekleyen talep ve toplam sınır engellenir", async () => {
	const db = sahteD1();
	const al = (start, phone) => talepOlustur(talepIstegi({ start, phone }), { db, telegram: null, now: SIMDI });
	assert.equal((await al("2026-11-06T19:00", "05321112233")).status, 201);
	assert.equal((await al("2026-11-06T20:00", "05321112233")).status, 201);
	assert.equal((await al("2026-11-06T21:00", "05321112233")).status, 429);
	for (let gun = 9; gun <= 21; gun++) {
		const n = String(gun).padStart(2, "0");
		assert.equal((await al(`2026-11-${n}T19:00`, `0532111${n}${n}0`.slice(0, 11))).status, 201);
	}
	assert.equal((await al("2026-11-24T19:00", "05359990000")).status, 429);
});

test("onay düğmesi saati kesinleştirir, ikinci tıklama etkisiz", async () => {
	const db = sahteD1();
	const telegram = sahteTelegram();
	await talepOlustur(talepIstegi(), { db, telegram, now: SIMDI });
	const bag = { db, telegram, sir: "sir", now: SIMDI };

	assert.equal((await telegramWebhook(dugme("t:onay:1"), bag)).status, 200);
	assert.equal(kayit(db).status, "onayli");
	const duzenle = telegram.giden.find((g) => g.tur === "duzenle");
	assert.match(duzenle.dugmeler[0][0].url, /^https:\/\/wa\.me\/905321112233\?text=/);

	await telegramWebhook(dugme("t:red:1"), bag);
	assert.equal(kayit(db).status, "onayli");
	assert.equal(telegram.giden.at(-1).text, "Bu talep artık beklemiyor.");
});

test("red saati yeniden boşaltır", async () => {
	const db = sahteD1();
	const telegram = sahteTelegram();
	await talepOlustur(talepIstegi(), { db, telegram, now: SIMDI });
	await telegramWebhook(dugme("t:red:1"), { db, telegram, sir: "sir", now: SIMDI });
	assert.equal(kayit(db).status, "reddedildi");
	assert.equal((await talepOlustur(talepIstegi({ phone: "05329998877" }), { db, telegram, now: SIMDI })).status, 201);
});

test("webhook: yanlış sır 401, yabancı kullanıcı kararı değiştiremez", async () => {
	const db = sahteD1();
	const telegram = sahteTelegram();
	await talepOlustur(talepIstegi(), { db, telegram, now: SIMDI });
	assert.equal((await telegramWebhook(dugme("t:onay:1"), { db, telegram, sir: "baska", now: SIMDI })).status, 401);
	await telegramWebhook(dugme("t:onay:1", 999), { db, telegram, sir: "sir", now: SIMDI });
	assert.equal(kayit(db).status, "bekliyor");
});

test("cevapsız talep 24 saat sonra saati boşaltır, geç onay işlemez", async () => {
	const db = sahteD1();
	const telegram = sahteTelegram();
	await talepOlustur(talepIstegi({ start: "2026-11-08T12:00" }), { db, telegram, now: SIMDI });
	const sonra = new Date(SIMDI.getTime() + 25 * 60 * 60 * 1000);
	const metin = await (await musaitYaniti({ db, now: sonra })).text();
	assert.ok(metin.includes('"start":"2026-11-08T12:00","durum":"bos"'));
	await telegramWebhook(dugme("t:onay:1"), { db, telegram, sir: "sir", now: sonra });
	assert.equal(kayit(db).status, "bekliyor");
	assert.equal((await talepOlustur(talepIstegi({ start: "2026-11-08T12:00", phone: "05329998877" }), { db, telegram, now: sonra })).status, 201);
	assert.equal(kayit(db).status, "iptal");
});

function panelIstegi(govde) {
	return new Request("https://link.vitrincim.com/takvim/yonet", {
		method: "POST",
		headers: { "content-type": "application/json", origin: "https://link.vitrincim.com" },
		body: JSON.stringify(govde),
	});
}

test("plan saati doldurur, başlığı dışarı çıkmaz, iptal boşaltır", async () => {
	const db = sahteD1();
	const bag = { db, now: SIMDI };
	const y = await panelIslemi(panelIstegi({ islem: "plan_ekle", start: "2026-11-06T20:00", saatSayisi: 2, title: "Doktor randevusu" }), bag);
	assert.deepEqual(await y.json(), { ok: true, eklenen: 2, atlanan: 0 });

	const metin = await (await musaitYaniti(bag)).text();
	assert.ok(metin.includes('"start":"2026-11-06T20:00","durum":"dolu"'));
	assert.ok(metin.includes('"start":"2026-11-06T21:00","durum":"dolu"'));
	assert.ok(!metin.includes("Doktor"), "plan başlığı sızmaz");

	assert.equal((await talepOlustur(talepIstegi({ start: "2026-11-06T20:00" }), { db, telegram: null, now: SIMDI })).status, 409);

	await panelIslemi(panelIstegi({ islem: "iptal", id: 1 }), bag);
	assert.equal((await talepOlustur(talepIstegi({ start: "2026-11-06T20:00" }), { db, telegram: null, now: SIMDI })).status, 201);
});

test("plan dolu saati ezmez, atlananı söyler", async () => {
	const db = sahteD1();
	await talepOlustur(talepIstegi({ start: "2026-11-06T20:00" }), { db, telegram: null, now: SIMDI });
	const y = await panelIslemi(panelIstegi({ islem: "plan_ekle", start: "2026-11-06T19:00", saatSayisi: 3 }), { db, now: SIMDI });
	assert.deepEqual(await y.json(), { ok: true, eklenen: 2, atlanan: 1 });
	assert.equal(kayit(db).name, "Ayşe Yılmaz");
});

test("plan gece yarısını aşamaz", async () => {
	const y = await panelIslemi(panelIstegi({ islem: "plan_ekle", start: "2026-11-06T23:00", saatSayisi: 2 }), { db: sahteD1(), now: SIMDI });
	assert.equal(y.status, 400);
});

test("panelden onay WhatsApp bağlantısı döner", async () => {
	const db = sahteD1();
	await talepOlustur(talepIstegi(), { db, telegram: null, now: SIMDI });
	const y = await (await panelIslemi(panelIstegi({ islem: "onayla", id: 1 }), { db, now: SIMDI })).json();
	assert.match(y.wa, /^https:\/\/wa\.me\/905321112233/);
	assert.equal(kayit(db).status, "onayli");
});

test("haftalık aralık değişince sayfa ve talep kuralı değişir", async () => {
	const db = sahteD1();
	const hafta = { ...VARSAYILAN_HAFTA, 5: [9, 12] };
	const y = await panelIslemi(panelIstegi({ islem: "hafta_kaydet", hafta }), { db, now: SIMDI });
	assert.equal(y.status, 200);
	assert.equal((await talepOlustur(talepIstegi({ start: "2026-11-06T19:00" }), { db, telegram: null, now: SIMDI })).status, 400);
	assert.equal((await talepOlustur(talepIstegi({ start: "2026-11-06T09:00" }), { db, telegram: null, now: SIMDI })).status, 201);
});


test("öğrencinin saati başka dilimde yazılır, Türkiye'de ayrıca yazılmaz", () => {
	assert.equal(bolgeSaatYazisi("2026-11-06T19:00", "Europe/Berlin"), "6 Kasım Cuma, 17:00–18:00");
	assert.equal(bolgeSaatYazisi("2026-11-06T22:00", "Asia/Tokyo"), "7 Kasım Cumartesi, 04:00–05:00");
	assert.equal(bolgeSaatYazisi("2026-11-06T19:00", "Asia/Kolkata"), "6 Kasım Cuma, 21:30–22:30");
	assert.equal(bolgeSaatYazisi("2026-11-07T10:00", "America/New_York"), "7 Kasım Cumartesi, 02:00–03:00");
	assert.equal(bolgeSaatYazisi("2026-11-06T19:00", "Europe/Istanbul"), null);
	assert.equal(bolgeSaatYazisi("2026-11-06T19:00", ""), null);
	assert.equal(bolgeSaatYazisi("2026-11-06T19:00", "Yok/Boyle"), null);
});

test("bozuk saat dilimi talebi engellemez, boş kaydedilir", () => {
	assert.equal(saatDilimiDuzelt("Europe/Berlin"), "Europe/Berlin");
	assert.equal(saatDilimiDuzelt("Yok/Boyle"), "");
	assert.equal(saatDilimiDuzelt("<script>"), "");
	assert.equal(saatDilimiDuzelt(null), "");
});

test("yurt dışındaki öğrencinin saati Telegram'a ve WhatsApp mesajına geçer", async () => {
	const db = sahteD1();
	const telegram = sahteTelegram();
	await talepOlustur(talepIstegi({ tz: "Europe/Berlin" }), { db, telegram, now: SIMDI });
	assert.match(telegram.giden[0].text, /🗓 6 Kasım Cuma, 19:00–20:00/);
	assert.match(telegram.giden[0].text, /Öğrencinin saati: 6 Kasım Cuma, 17:00–18:00 \(Europe\/Berlin\)/);
	await telegramWebhook(dugme("t:onay:1"), { db, telegram, sir: "sir", now: SIMDI });
	const url = telegram.giden.find((g) => g.tur === "duzenle").dugmeler[0][0].url;
	assert.match(decodeURIComponent(url), /17:00–18:00 \(senin saatinle\)/);
});

/** Tarayıcı kodunu gerçek saat dilimiyle ayrı süreçte çalıştırır. */
function gruplaDilimde(tz, gunler, simdi) {
	const kod = `require(${JSON.stringify(new URL("../public/takvim-saat.js", import.meta.url).pathname)});
		console.log(JSON.stringify(globalThis.TakvimSaat.grupla(${JSON.stringify(gunler)}, new Date(${JSON.stringify(simdi)}))));`;
	const c = spawnSync(process.execPath, ["--input-type=commonjs", "-e", kod], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
	assert.equal(c.status, 0, c.stderr);
	return JSON.parse(c.stdout);
}

test("tarayıcı: saatler ziyaretçinin dilimine ve gününe taşınır", () => {
	const gunler = [
		{ gun: "2026-11-06", saatler: [{ start: "2026-11-06T19:00", durum: "bos" }, { start: "2026-11-06T22:00", durum: "dolu" }] },
		{ gun: "2026-11-07", saatler: [{ start: "2026-11-07T10:00", durum: "bos" }] },
	];
	const simdi = "2026-11-06T06:00:00Z";

	const istanbul = gruplaDilimde("Europe/Istanbul", gunler, simdi);
	assert.equal(istanbul[0].gun, "2026-11-06");
	assert.deepEqual(istanbul[0].saatler.map((s) => s.saat), ["19:00", "22:00"]);
	assert.equal(istanbul[0].saatler[0].turkiyeden, false);

	const tokyo = gruplaDilimde("Asia/Tokyo", gunler, simdi);
	assert.equal(tokyo[0].gun, "2026-11-06");
	assert.deepEqual(tokyo[0].saatler, []);
	assert.equal(tokyo[1].ad, "Cumartesi");
	assert.deepEqual(tokyo[1].saatler.map((s) => s.saat), ["01:00", "04:00", "16:00"]);
	assert.equal(tokyo[1].saatler[0].turkiyeden, true);
	assert.equal(tokyo[1].saatler[0].start, "2026-11-06T19:00", "sunucuya Türkiye saati gider");
	assert.equal(tokyo[1].saatler[1].durum, "dolu");

	const hindistan = gruplaDilimde("Asia/Kolkata", gunler, simdi);
	assert.equal(hindistan[0].saatler[0].aralik, "21:30–22:30");

	const newYork = gruplaDilimde("America/New_York", gunler, simdi);
	assert.deepEqual(newYork[0].saatler.map((s) => s.saat), ["11:00", "14:00"]);
	assert.deepEqual(newYork[1].saatler.map((s) => s.saat), ["02:00"]);
});

test("kaydı sil kişisel veriyi kalıcı siler ve saati boşaltır, planı silmez", async () => {
	const db = sahteD1();
	const bag = { db, now: SIMDI };
	await talepOlustur(talepIstegi(), { db, telegram: null, now: SIMDI });
	await panelIslemi(panelIstegi({ islem: "plan_ekle", start: "2026-11-06T21:00" }), bag);

	assert.equal((await panelIslemi(panelIstegi({ islem: "sil", id: 2 }), bag)).status, 404, "plan silinmez");
	assert.equal((await panelIslemi(panelIstegi({ islem: "sil", id: 1 }), bag)).status, 200);
	assert.equal(kayit(db), undefined);
	assert.equal((await panelIslemi(panelIstegi({ islem: "sil", id: 1 }), bag)).status, 404);
	assert.equal((await talepOlustur(talepIstegi({ phone: "05329998877" }), { db, telegram: null, now: SIMDI })).status, 201);
});

test("geçmiş talepler panelde kalır, kendiliğinden silinmez, herkese açık uçta yoktur", async () => {
	const db = sahteD1();
	await talepOlustur(talepIstegi(), { db, telegram: null, now: SIMDI });
	await talepOlustur(talepIstegi({ start: "2026-11-07T10:00", phone: "05329998877", name: "Reddedilen" }), { db, telegram: null, now: SIMDI });
	await panelIslemi(panelIstegi({ islem: "onayla", id: 1 }), { db, now: SIMDI });
	await panelIslemi(panelIstegi({ islem: "reddet", id: 2 }), { db, now: SIMDI });

	const simdi = await (await panelVerisi({ db, now: SIMDI })).json();
	assert.deepEqual(simdi.gecmis.map((k) => k.name), ["Reddedilen"]);

	const sonra = new Date(SIMDI.getTime() + 400 * 24 * 60 * 60 * 1000);
	const yil = await (await panelVerisi({ db, now: sonra })).json();
	assert.deepEqual(yil.gecmis.map((k) => k.name).sort(), ["Ayşe Yılmaz", "Reddedilen"]);
	assert.equal(yil.gecmis.find((k) => k.name === "Ayşe Yılmaz").phone, "905321112233");

	const acik = await (await musaitYaniti({ db, now: SIMDI })).text();
	assert.ok(!acik.includes("Reddedilen"));
});

test("kapalı saat bir kerelik açılır, yalnız o tarihte geçerlidir, geri alınır", async () => {
	const db = sahteD1();
	const bag = { db, now: SIMDI };
	const pzt = "2026-11-09T11:00"; // pazartesi gündüz, haftalık düzende kapalı
	const sonrakiPzt = "2026-11-16T11:00";
	assert.equal((await talepOlustur(talepIstegi({ start: pzt }), { db, telegram: null, now: SIMDI })).status, 400);

	assert.equal((await panelIslemi(panelIstegi({ islem: "saat_ac", start: pzt, saatSayisi: 2 }), bag)).status, 200);
	const metin = await (await musaitYaniti(bag)).text();
	assert.ok(metin.includes('"start":"2026-11-09T11:00","durum":"bos"'));
	assert.ok(metin.includes('"start":"2026-11-09T12:00","durum":"bos"'));
	assert.ok(metin.includes(`"start":"${sonrakiPzt}","durum":"kapali"`), "haftalık düzen değişmez");

	assert.equal((await talepOlustur(talepIstegi({ start: pzt }), { db, telegram: null, now: SIMDI })).status, 201);
	const dolu = await (await musaitYaniti(bag)).text();
	assert.ok(dolu.includes('"start":"2026-11-09T11:00","durum":"dolu"'));

	await panelIslemi(panelIstegi({ islem: "saat_kapat", start: "2026-11-09T12:00" }), bag);
	assert.ok((await (await musaitYaniti(bag)).text()).includes('"start":"2026-11-09T12:00","durum":"kapali"'));
	assert.equal((await talepOlustur(talepIstegi({ start: "2026-11-09T12:00", phone: "05329998877" }), { db, telegram: null, now: SIMDI })).status, 400);
});

test("bir kerelik saat 3 saat kuralına bakmaz ama vakti geçmişse açılmaz", async () => {
	const db = sahteD1();
	const bag = { db, now: SIMDI }; // 14:00
	await panelIslemi(panelIstegi({ islem: "saat_ac", start: "2026-11-05T15:00" }), bag);
	await panelIslemi(panelIstegi({ islem: "saat_ac", start: "2026-11-05T12:00" }), bag);
	const metin = await (await musaitYaniti(bag)).text();
	assert.ok(metin.includes('"start":"2026-11-05T15:00","durum":"bos"'));
	assert.ok(!metin.includes("2026-11-05T12:00"));
	assert.equal((await talepOlustur(talepIstegi({ start: "2026-11-05T15:00" }), { db, telegram: null, now: SIMDI })).status, 201);
	assert.equal((await talepOlustur(talepIstegi({ start: "2026-11-05T12:00", phone: "05329998877" }), { db, telegram: null, now: SIMDI })).status, 400);
});

test("bir kerelik açmada süre sınırları", async () => {
	const bag = { db: sahteD1(), now: SIMDI };
	assert.equal((await panelIslemi(panelIstegi({ islem: "saat_ac", start: "2026-11-09T23:00", saatSayisi: 2 }), bag)).status, 400);
	assert.equal((await panelIslemi(panelIstegi({ islem: "saat_ac", start: "bozuk" }), bag)).status, 400);
});

test("kapalı saate girilen plan herkese kapalı görünür, açık saatte dolu", async () => {
	const db = sahteD1();
	const bag = { db, now: SIMDI };
	await panelIslemi(panelIstegi({ islem: "plan_ekle", start: "2026-11-09T11:00" }), bag);
	await panelIslemi(panelIstegi({ islem: "plan_ekle", start: "2026-11-09T19:00" }), bag);
	const metin = await (await musaitYaniti(bag)).text();
	assert.ok(metin.includes('"start":"2026-11-09T11:00","durum":"kapali"'));
	assert.ok(metin.includes('"start":"2026-11-09T19:00","durum":"dolu"'));
});
