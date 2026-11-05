/**
 * Takvim uçlarının gövdesi. api/takvim/*.js yalnız ortamı bağlar;
 * burası test edilebilsin diye db, telegram ve saat dışarıdan gelir.
 */

import {
	BEKLEME_SAAT,
	EN_AZ_SAAT,
	SAKLAMA_GUN,
	UFUK_GUN,
	bolgeSaatYazisi,
	gecerliSaatMi,
	gunEkle,
	haftaDogrula,
	haftaDuzelt,
	musaitGunler,
	saatYazisi,
	talepDogrula,
	whatsappLinki,
	yerelSimdi,
} from "./takvim.js";
import { htmlKacir } from "./telegram.js";
import { safeEqual } from "./stats.js";

const AZAMI_GOVDE = 4096;
/** Aynı numaradan aynı anda en çok bu kadar bekleyen talep. */
const NUMARA_BASINA = 2;
/** Toplamda bu kadar bekleyen varsa yeni talep alınmaz: sahte talep takvimi dolduramasın. */
const TOPLAM_BEKLEYEN = 15;

export function json(veri, status = 200, ekBaslik = {}) {
	return new Response(JSON.stringify(veri), {
		status,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"Cache-Control": "no-store",
			"X-Robots-Tag": "noindex",
			...ekBaslik,
		},
	});
}

function beklemeSiniri(now) {
	return new Date(now.getTime() - BEKLEME_SAAT * 60 * 60 * 1000).toISOString();
}

export async function haftaOku(db) {
	const { results } = await db.prepare("SELECT value FROM takvim_ayar WHERE key = 'hafta'").all();
	if (!results?.length) return haftaDuzelt(null);
	try {
		return haftaDuzelt(JSON.parse(results[0].value));
	} catch {
		return haftaDuzelt(null);
	}
}

/** Cevapsız kalan ve vakti geçen talepleri düşürür, saat yeniden boşalır. */
async function suresiDolanlariKapat(db, now) {
	await db
		.prepare(
			"UPDATE takvim_kayit SET status = 'iptal', decided_at = ?1 WHERE status = 'bekliyor' AND (created_at < ?2 OR start < ?3)",
		)
		.bind(now.toISOString(), beklemeSiniri(now), yerelSimdi(now))
		.run();
}

// ── Herkese açık ────────────────────────────────────────────────────

export async function musaitYaniti({ db, now = new Date() }) {
	const bugun = yerelSimdi(now).slice(0, 10);
	const [hafta, dolu] = await Promise.all([
		haftaOku(db),
		db
			.prepare(
				"SELECT start FROM takvim_kayit WHERE start >= ?1 AND (status = 'onayli' OR (status = 'bekliyor' AND created_at >= ?2))",
			)
			.bind(`${bugun}T00:00`, beklemeSiniri(now))
			.all(),
	]);
	return json({
		enAzSaat: EN_AZ_SAAT,
		gunler: musaitGunler({ hafta, doluSaatler: (dolu.results ?? []).map((r) => r.start), now }),
	});
}

/** Başka siteden gelen istekleri eler. Tarayıcı dışı istemcide Origin olmayabilir. */
export function ayniKaynakMi(request) {
	const origin = request.headers.get("origin");
	if (!origin) return true;
	try {
		return new URL(origin).host === new URL(request.url).host;
	} catch {
		return false;
	}
}

async function jsonOku(request) {
	const tur = request.headers.get("content-type") ?? "";
	if (!tur.toLowerCase().includes("application/json")) return null;
	const metin = await request.text();
	if (metin.length > AZAMI_GOVDE) return null;
	try {
		return JSON.parse(metin);
	} catch {
		return null;
	}
}

function benzersizlikHatasi(hata) {
	return /UNIQUE constraint/i.test(String(hata?.message ?? hata));
}

export async function talepOlustur(request, { db, telegram, now = new Date() }) {
	if (!ayniKaynakMi(request)) return json({ hata: "İzin verilmedi." }, 403);

	const govde = await jsonOku(request);
	if (!govde) return json({ hata: "Form okunamadı." }, 400);

	// Bal küpü: insan bu alanı görmez, dolduran bottur. Başarılı görünür, kayıt düşmez.
	if (typeof govde.site === "string" && govde.site !== "") return json({ ok: true });

	const hafta = await haftaOku(db);
	const sonuc = talepDogrula(govde, { hafta, now });
	if (sonuc.hata) return json({ hata: sonuc.hata }, 400);
	const talep = sonuc.deger;

	await suresiDolanlariKapat(db, now);

	const sayim = await db
		.prepare(
			"SELECT COUNT(*) AS toplam, COALESCE(SUM(phone = ?1), 0) AS numara FROM takvim_kayit WHERE status = 'bekliyor'",
		)
		.bind(talep.phone)
		.all();
	const { toplam = 0, numara = 0 } = sayim.results?.[0] ?? {};
	if (Number(numara) >= NUMARA_BASINA) {
		return json({ hata: "Bu numarayla bekleyen talebin var. Cevap gelince yenisini gönderebilirsin." }, 429);
	}
	if (Number(toplam) >= TOPLAM_BEKLEYEN) {
		return json({ hata: "Şu an çok talep var, biraz sonra yeniden dene." }, 429);
	}

	let eklenen;
	try {
		eklenen = await db
			.prepare(
				"INSERT INTO takvim_kayit (start, kind, status, name, phone, topic, note, tz, created_at) VALUES (?1, 'talep', 'bekliyor', ?2, ?3, ?4, ?5, ?6, ?7)",
			)
			.bind(talep.start, talep.name, talep.phone, talep.topic, talep.note, talep.tz, now.toISOString())
			.run();
	} catch (hata) {
		if (benzersizlikHatasi(hata)) {
			return json({ hata: "Bu saat az önce doldu, başka bir saat seç.", dolu: true }, 409);
		}
		throw hata;
	}

	const id = eklenen.meta?.last_row_id;
	// Bildirim gitmese de talep kayıtlıdır ve panelde görünür; öğrenciye hata gösterilmez.
	if (telegram) {
		try {
			await telegram.gonder(talepMetni(talep), talepDugmeleri(id, talep));
		} catch (hata) {
			console.error(String(hata?.message ?? hata));
		}
	} else {
		console.error("Telegram ayarlı değil: talep yalnız panelde görünecek.");
	}

	return json({ ok: true, saat: saatYazisi(talep.start) }, 201);
}

// ── Karar: hem Telegram düğmesi hem panel buradan geçer ─────────────

function talepMetni(t, ust = "📩 <b>Yeni ders talebi</b>") {
	const ogrenciSaati = bolgeSaatYazisi(t.start, t.tz);
	const satirlar = [
		ust,
		`🗓 ${saatYazisi(t.start)}`,
		...(ogrenciSaati ? [`🌍 Öğrencinin saati: ${ogrenciSaati} (${htmlKacir(t.tz)})`] : []),
		`👤 ${htmlKacir(t.name)}`,
		`📞 +${htmlKacir(t.phone)}`,
		`📚 ${htmlKacir(t.topic)}`,
	];
	if (t.note) satirlar.push(`📝 ${htmlKacir(t.note)}`);
	return satirlar.join("\n");
}

/** Öğrenciye giden mesajda saat onun saatiyle yazılır; karışıklık kalmasın diye belirtilir. */
function ogrenciyeSaat(t) {
	const yazi = bolgeSaatYazisi(t.start, t.tz);
	return yazi ? `${yazi} (senin saatinle)` : saatYazisi(t.start);
}

function onayMesaji(t) {
	return `Merhaba ${t.name}, ${ogrenciyeSaat(t)} için ders talebini onayladım. Görüşmek üzere!`;
}

function redMesaji(t) {
	return `Merhaba ${t.name}, ${ogrenciyeSaat(t)} için ders talebini aldım ama o saat bana uymuyor. Başka bir saat bakabilir miyiz?`;
}

function talepDugmeleri(id, t) {
	return [
		[
			{ text: "✅ Onayla", callback_data: `t:onay:${id}` },
			{ text: "❌ Reddet", callback_data: `t:red:${id}` },
		],
		[{ text: "💬 WhatsApp'tan yaz", url: whatsappLinki(t.phone, `Merhaba ${t.name},`) }],
	];
}

/** Yalnız hâlâ bekleyen talep değişir; ikinci tıklama ya da süresi dolmuş talep null döner. */
async function kararVer(db, id, onay, now) {
	const yeni = onay ? "onayli" : "reddedildi";
	const sonuc = await db
		.prepare(
			"UPDATE takvim_kayit SET status = ?1, decided_at = ?2 WHERE id = ?3 AND kind = 'talep' AND status = 'bekliyor' AND created_at >= ?4",
		)
		.bind(yeni, now.toISOString(), id, beklemeSiniri(now))
		.run();
	if (!sonuc.meta?.changes) return null;
	const { results } = await db.prepare("SELECT * FROM takvim_kayit WHERE id = ?1").bind(id).all();
	return results?.[0] ?? null;
}

export async function telegramWebhook(request, { db, telegram, sir, now = new Date() }) {
	if (!sir || !telegram) return json({ hata: "ayarlı değil" }, 503);
	const gelen = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
	if (!(await safeEqual(gelen, sir))) return json({ hata: "izin yok" }, 401);

	const guncelleme = await request.json().catch(() => null);
	const sorgu = guncelleme?.callback_query;
	if (!sorgu) return json({ ok: true });

	// Bot adresini bulan biri kendi hesabından düğme basamasın.
	if (String(sorgu.from?.id) !== telegram.chatId) {
		await telegram.cevapla(sorgu.id, "Bu işlem için yetkin yok.");
		return json({ ok: true });
	}

	const m = /^t:(onay|red):(\d+)$/.exec(sorgu.data ?? "");
	if (!m) {
		await telegram.cevapla(sorgu.id, "Bilinmeyen işlem.");
		return json({ ok: true });
	}

	const onay = m[1] === "onay";
	const kayit = await kararVer(db, Number(m[2]), onay, now);
	if (!kayit) {
		await telegram.cevapla(sorgu.id, "Bu talep artık beklemiyor.");
		return json({ ok: true });
	}

	const baslik = onay ? "✅ <b>Onaylandı</b>" : "❌ <b>Reddedildi</b>";
	const dugme = onay
		? { text: "💬 Öğrenciye haber ver", url: whatsappLinki(kayit.phone, onayMesaji(kayit)) }
		: { text: "💬 Öğrenciye haber ver", url: whatsappLinki(kayit.phone, redMesaji(kayit)) };
	await telegram.duzenle(sorgu.message?.message_id, talepMetni(kayit, baslik), [[dugme]]);
	await telegram.cevapla(sorgu.id, onay ? "Onaylandı, öğrenciye haber vermeyi unutma." : "Reddedildi, saat yeniden boş.");
	return json({ ok: true });
}

// ── Yönetim (parola api/ tarafında kontrol edilir) ─────────────────

export async function panelVerisi({ db, now = new Date() }) {
	await suresiDolanlariKapat(db, now);

	// Eski talebin kişisel alanları temizlenir, saat kaydı kalır.
	const sinir = gunEkle(yerelSimdi(now).slice(0, 10), -SAKLAMA_GUN);
	await db
		.prepare(
			"UPDATE takvim_kayit SET name = '', phone = '', note = '' WHERE kind = 'talep' AND start < ?1 AND phone != ''",
		)
		.bind(`${sinir}T00:00`)
		.run();

	const bugun = yerelSimdi(now).slice(0, 10);
	const [hafta, kayitlar] = await Promise.all([
		haftaOku(db),
		db
			.prepare(
				"SELECT id, start, kind, status, title, name, phone, topic, note, tz FROM takvim_kayit WHERE start >= ?1 AND status IN ('bekliyor', 'onayli') ORDER BY start",
			)
			.bind(`${bugun}T00:00`)
			.all(),
	]);

	return json({
		bugun,
		simdi: yerelSimdi(now),
		ufukGun: UFUK_GUN,
		hafta,
		kayitlar: (kayitlar.results ?? []).map((k) => ({
			...k,
			saat: saatYazisi(k.start),
			ogrenciSaati: bolgeSaatYazisi(k.start, k.tz),
			wa: k.phone
				? whatsappLinki(k.phone, k.status === "onayli" ? onayMesaji(k) : `Merhaba ${k.name},`)
				: null,
		})),
	});
}

export async function panelIslemi(request, { db, now = new Date() }) {
	if (!ayniKaynakMi(request)) return json({ hata: "İzin verilmedi." }, 403);
	const g = await jsonOku(request);
	if (!g) return json({ hata: "İstek okunamadı." }, 400);

	if (g.islem === "plan_ekle") return planEkle(db, g, now);

	if (g.islem === "hafta_kaydet") {
		const hafta = haftaDogrula(g.hafta);
		if (!hafta) return json({ hata: "Saat aralığı geçersiz: başlangıç bitişten önce olmalı." }, 400);
		await db
			.prepare(
				"INSERT INTO takvim_ayar (key, value) VALUES ('hafta', ?1) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
			)
			.bind(JSON.stringify(hafta))
			.run();
		return json({ ok: true });
	}

	const id = Number(g.id);
	if (!Number.isInteger(id) || id <= 0) return json({ hata: "Kayıt bulunamadı." }, 400);

	if (g.islem === "onayla" || g.islem === "reddet") {
		const kayit = await kararVer(db, id, g.islem === "onayla", now);
		if (!kayit) return json({ hata: "Bu talep artık beklemiyor." }, 409);
		const mesaj = g.islem === "onayla" ? onayMesaji(kayit) : redMesaji(kayit);
		return json({ ok: true, wa: whatsappLinki(kayit.phone, mesaj) });
	}

	if (g.islem === "iptal") {
		// Kayıt silinmez, iptal olur: saat boşalır, geçmiş kalır.
		const sonuc = await db
			.prepare(
				"UPDATE takvim_kayit SET status = 'iptal', decided_at = ?1 WHERE id = ?2 AND status IN ('bekliyor', 'onayli')",
			)
			.bind(now.toISOString(), id)
			.run();
		if (!sonuc.meta?.changes) return json({ hata: "Kayıt bulunamadı." }, 404);
		return json({ ok: true });
	}

	return json({ hata: "Bilinmeyen işlem." }, 400);
}

/** Dolu saate denk geleni atlar, atlananları söyler. Gece yarısını aşmaz. */
async function planEkle(db, g, now) {
	if (!gecerliSaatMi(g.start)) return json({ hata: "Saat geçersiz." }, 400);
	const adet = Number(g.saatSayisi ?? 1);
	if (!Number.isInteger(adet) || adet < 1 || adet > 12) {
		return json({ hata: "Süre 1 ile 12 saat arasında olmalı." }, 400);
	}
	const baslangic = Number(g.start.slice(11, 13));
	if (baslangic + adet > 24) return json({ hata: "Plan gece yarısını geçemez." }, 400);
	const title = String(g.title ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
	const gun = g.start.slice(0, 10);

	let eklenen = 0;
	for (let i = 0; i < adet; i++) {
		const start = `${gun}T${String(baslangic + i).padStart(2, "0")}:00`;
		const sonuc = await db
			.prepare(
				"INSERT OR IGNORE INTO takvim_kayit (start, kind, status, title, created_at, decided_at) VALUES (?1, 'plan', 'onayli', ?2, ?3, ?3)",
			)
			.bind(start, title, now.toISOString())
			.run();
		eklenen += Number(sonuc.meta?.changes ?? 0);
	}
	return json({ ok: true, eklenen, atlanan: adet - eklenen });
}
