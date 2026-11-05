/**
 * Ders takvimi: saat hesabı ve doğrulama. Veritabanı ve ağ bilmez.
 *
 * Saatler Türkiye yerel saati olarak "2026-11-06T19:00" biçiminde tutulur.
 * Türkiye'de yaz saati uygulaması yok, fark her zaman UTC+3.
 */

const TURKIYE_MS = 3 * 60 * 60 * 1000;

/** Sayfada kaç gün ileriye talep alınır. */
export const UFUK_GUN = 28;
/** En erken kaç saat sonrasına talep alınır. */
export const EN_AZ_SAAT = 2;
/** Cevaplanmayan talep kaç saat sonra saati yeniden boşaltır. */
export const BEKLEME_SAAT = 24;
/** Takvimde her gün bu saatten itibaren görünür; daha erkeni yalnız açıksa görünür. */
export const ILK_GORUNEN_SAAT = 8;

/** Takvimden alınan tek ders konusu. */
export const DERS_KONUSU = "Yapay zekâ";

/** Anahtar: Date.getUTCDay() (0 = pazar). Değer: [ilk saat, bitiş saati] ya da kapalıysa null. */
export const VARSAYILAN_HAFTA = Object.freeze({
	0: [10, 23],
	1: [19, 23],
	2: [19, 23],
	3: [19, 23],
	4: [19, 23],
	5: [19, 23],
	6: [10, 23],
});

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

const SAAT_BICIMI = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):00$/;

/** Şu anın Türkiye saatindeki karşılığı: "2026-11-05T14:37". */
export function yerelSimdi(now = new Date()) {
	return new Date(now.getTime() + TURKIYE_MS).toISOString().slice(0, 16);
}

export function gunEkle(gun, adet) {
	const d = new Date(`${gun}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + adet);
	return d.toISOString().slice(0, 10);
}

function haftaGunu(gun) {
	return new Date(`${gun}T00:00:00Z`).getUTCDay();
}

/** Gerçek bir takvim saati mi? "2026-02-30T19:00" gibi taşanları da eler. */
export function gecerliSaatMi(start) {
	const m = SAAT_BICIMI.exec(String(start ?? ""));
	if (!m) return false;
	if (Number(m[4]) > 23) return false;
	const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
	return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === start.slice(0, 10);
}

/** "2026-11-06T19:00" → "6 Kasım Cuma, 19:00–20:00" */
export function saatYazisi(start) {
	const gun = start.slice(0, 10);
	const saat = Number(start.slice(11, 13));
	const d = new Date(`${gun}T00:00:00Z`);
	const iki = (n) => String(n).padStart(2, "0");
	return `${d.getUTCDate()} ${AYLAR[d.getUTCMonth()]} ${GUNLER[d.getUTCDay()]}, ${iki(saat)}:00–${iki((saat + 1) % 24)}:00`;
}

/**
 * Aynı saatin başka dilimdeki yazısı. Türkiye saatinden farkı yoksa ya da dilim
 * tanınmıyorsa null: çağıran taraf yalnız Türkiye saatini gösterir.
 */
export function bolgeSaatYazisi(start, tz) {
	if (!tz) return null;
	try {
		const an = Date.parse(`${start}:00+03:00`);
		const bicim = new Intl.DateTimeFormat("en-US", {
			timeZone: tz,
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
		});
		const parca = (ms) => Object.fromEntries(bicim.formatToParts(ms).map((p) => [p.type, p.value]));
		const a = parca(an);
		const b = parca(an + 60 * 60 * 1000);
		const gun = new Date(Date.UTC(Number(a.year), Number(a.month) - 1, Number(a.day)));
		const yazi = `${gun.getUTCDate()} ${AYLAR[gun.getUTCMonth()]} ${GUNLER[gun.getUTCDay()]}, ${a.hour}:${a.minute}–${b.hour}:${b.minute}`;
		return yazi === saatYazisi(start) ? null : yazi;
	} catch {
		return null;
	}
}

/** Tanınmayan saat dilimi talebi engellemez, boş kalır. */
export function saatDilimiDuzelt(ham) {
	const tz = String(ham ?? "").trim();
	if (!tz || tz.length > 64 || !/^[A-Za-z0-9_+/-]+$/.test(tz)) return "";
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: tz });
		return tz;
	} catch {
		return "";
	}
}

/** Bozuk ya da eksik ayarda o gün varsayılana düşer; sayfa asla kırılmaz. */
export function haftaDuzelt(ham) {
	const sonuc = {};
	for (let gun = 0; gun < 7; gun++) {
		const deger = ham && typeof ham === "object" ? ham[gun] : undefined;
		if (deger === null) sonuc[gun] = null;
		else if (haftaAraligiMi(deger)) sonuc[gun] = [deger[0], deger[1]];
		else sonuc[gun] = [...VARSAYILAN_HAFTA[gun]];
	}
	return sonuc;
}

function haftaAraligiMi(deger) {
	return (
		Array.isArray(deger) &&
		deger.length === 2 &&
		Number.isInteger(deger[0]) &&
		Number.isInteger(deger[1]) &&
		deger[0] >= 0 &&
		deger[1] <= 24 &&
		deger[0] < deger[1]
	);
}

/** Panelden gelen haftayı katı kontrol eder; bozuksa null. */
export function haftaDogrula(ham) {
	if (!ham || typeof ham !== "object") return null;
	const sonuc = {};
	for (let gun = 0; gun < 7; gun++) {
		const deger = ham[gun];
		if (deger === null) sonuc[gun] = null;
		else if (haftaAraligiMi(deger)) sonuc[gun] = [deger[0], deger[1]];
		else return null;
	}
	return sonuc;
}

/**
 * O saat talebe açık mı? Haftalık aralıkta ve en erken sınırdan sonra olmalı.
 * Bilal'in elle açtığı saat aralık ve en erken sınıra bakmaz, yalnız vakti geçmemiş olmalı.
 */
export function talebeAcikMi(start, hafta, now = new Date(), ekSaatler = []) {
	if (!gecerliSaatMi(start)) return false;
	if (ekSaatler.includes(start)) {
		const sonGun = gunEkle(yerelSimdi(now).slice(0, 10), UFUK_GUN - 1);
		return start >= yerelSimdi(now) && start.slice(0, 10) <= sonGun;
	}
	const aralik = hafta[haftaGunu(start.slice(0, 10))];
	if (!aralik) return false;
	const saat = Number(start.slice(11, 13));
	if (saat < aralik[0] || saat >= aralik[1]) return false;

	const enErken = yerelSimdi(new Date(now.getTime() + EN_AZ_SAAT * 60 * 60 * 1000));
	const sonGun = gunEkle(yerelSimdi(now).slice(0, 10), UFUK_GUN - 1);
	return start >= enErken && start.slice(0, 10) <= sonGun;
}

/**
 * Herkese açık görünüm. Kim olduğu, talep mi plan mı olduğu buradan ÇIKMAZ:
 * saat "bos", "dolu" ya da "kapali". Bütün hafta görünür; açık işaretlenmeyen saat kapalıdır.
 * Kapalı saate denk gelen plan da "kapali" görünür. Vakti geçmiş saatler listelenmez.
 */
export function musaitGunler({ hafta, doluSaatler, ekSaatler = [], now = new Date() }) {
	const dolu = new Set(doluSaatler);
	const bugun = yerelSimdi(now).slice(0, 10);
	const gunler = [];

	for (let i = 0; i < UFUK_GUN; i++) {
		const gun = gunEkle(bugun, i);
		const aralik = hafta[haftaGunu(gun)];
		const saatler = [];
		for (let saat = 0; saat < 24; saat++) {
			const start = `${gun}T${String(saat).padStart(2, "0")}:00`;
			const acik = (aralik && saat >= aralik[0] && saat < aralik[1]) || ekSaatler.includes(start);
			if ((!acik && saat < ILK_GORUNEN_SAAT) || start < yerelSimdi(now)) continue;
			let durum = "kapali";
			if (acik && dolu.has(start)) durum = "dolu";
			else if (talebeAcikMi(start, hafta, now, ekSaatler)) durum = "bos";
			saatler.push({ start, durum });
		}
		gunler.push({ gun, ad: GUNLER[haftaGunu(gun)], saatler });
	}
	return gunler;
}

/** Türkiye numarasını ülke koduyla sadeleştirir: "0532 111 22 33" → "905321112233". Bozuksa null. */
export function telefonDuzelt(ham) {
	const metin = String(ham ?? "").trim();
	if (!/^[+\d][\d\s().-]*$/.test(metin)) return null;
	let rakam = metin.replace(/\D/g, "");
	if (metin.startsWith("+")) {
		// Uluslararası biçim olduğu gibi kalır.
	} else if (rakam.startsWith("00")) {
		rakam = rakam.slice(2);
	} else if (rakam.startsWith("0") && rakam.length === 11) {
		rakam = `9${rakam}`;
	} else if (rakam.length === 10 && rakam.startsWith("5")) {
		rakam = `90${rakam}`;
	}
	return rakam.length >= 11 && rakam.length <= 15 ? rakam : null;
}

function kisalt(deger, azami) {
	return String(deger ?? "").replace(/\s+/g, " ").trim().slice(0, azami);
}

/** @returns {{deger: object}|{hata: string}} */
export function talepDogrula(govde, { hafta, ekSaatler = [], now = new Date() }) {
	if (!govde || typeof govde !== "object") return { hata: "Form okunamadı." };

	const name = kisalt(govde.name, 80);
	if (name.length < 2) return { hata: "Adını yaz." };

	const phone = telefonDuzelt(govde.phone);
	if (!phone) return { hata: "Telefon numarasını kontrol et." };

	if (govde.onay !== true) return { hata: "Bilgilerini paylaşma onayını işaretle." };

	if (!talebeAcikMi(govde.start, hafta, now, ekSaatler)) {
		return { hata: "Bu saat artık seçilemiyor, başka bir saat seç." };
	}

	return { deger: { start: govde.start, name, phone, topic: DERS_KONUSU, note: kisalt(govde.note, 300), tz: saatDilimiDuzelt(govde.tz) } };
}

/** WhatsApp sohbetini hazır mesajla açan bağlantı. */
export function whatsappLinki(phone, mesaj) {
	return `https://wa.me/${phone}?text=${encodeURIComponent(mesaj)}`;
}
