/**
 * /takvim/panel sayfası. Sır içermez; veriyi /takvim/yonet'ten parolayla çeker.
 * Metin şablon dizesi olduğu için aşağıdaki JS ters tırnak ve dolar-süslü kullanmaz.
 */

export function panelSayfasi() {
	return PANEL;
}

const PANEL = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="light dark">
<title>Takvim Paneli</title>
<link rel="icon" href="data:,">
<style>
:root{ color-scheme:light; --bg:#eeeae3; --surface:#fbf8f1; --border:#d6cebd; --text:#111720; --muted:#5d6470; --accent:#8a6d33; --navy:#1d2b3a; --gold:#d9b45f; --cream:#f7f1e4;
	--plan:#d9e2ec; --plan-t:#1d2b3a; --talep:#f3dfa8; --talep-t:#3f3620; --onay:#cfe8d6; --onay-t:#17422a; --err:#a3281e; --ana-bg:#1d2b3a; --ana-t:#f7f1e4; }
@media (prefers-color-scheme: dark){ :root{ color-scheme:dark; --bg:#0d1219; --surface:#18222e; --border:#2b3948; --text:#f1ece0; --muted:#a3abb6; --accent:#d9b45f;
	--plan:#2a3d51; --plan-t:#e4ecf4; --talep:#5a4815; --talep-t:#f8e7b5; --onay:#1d4a30; --onay-t:#c8efd5; --err:#ff9d92; --ana-bg:#d9b45f; --ana-t:#111720; } }
@font-face{ font-family:"DM Sans"; font-weight:100 1000; font-display:swap; src:url(/fonts/dm-sans-latin-ext-wght-normal.woff2) format("woff2"); unicode-range:U+0100-02BA,U+1E00-1E9F; }
@font-face{ font-family:"DM Sans"; font-weight:100 1000; font-display:swap; src:url(/fonts/dm-sans-latin-wght-normal.woff2) format("woff2"); unicode-range:U+0000-00FF,U+2000-206F; }
*{ box-sizing:border-box; }
body{ margin:0; background:var(--bg); color:var(--text); font:15px/1.5 "DM Sans",system-ui,sans-serif; }
main{ max-width:70rem; margin:0 auto; padding:1rem 1rem 3rem; }
h1{ font-size:1.375rem; margin:.25rem 0 1rem; }
h2{ font-size:1.0625rem; margin:1.5rem 0 .6rem; }
button,select,input{ font:inherit; color:var(--text); }
button{ cursor:pointer; min-height:44px; padding:0 .8rem; border:1px solid var(--border); border-radius:8px; background:var(--surface); }
button.ana{ background:var(--ana-bg); color:var(--ana-t); border-color:var(--ana-bg); font-weight:600; }
a.dugme{ display:inline-flex; align-items:center; min-height:44px; padding:0 .8rem; border:1px solid var(--border); border-radius:8px; color:inherit; text-decoration:none; background:var(--surface); }
input,select{ min-height:44px; padding:0 .6rem; background:var(--bg); border:1px solid var(--border); border-radius:7px; width:100%; }
:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }
.kart{ background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:.8rem; margin-bottom:.6rem; }
.kart strong{ display:block; }
.kart .alt{ color:var(--muted); font-size:.875rem; overflow-wrap:anywhere; }
.satir{ display:flex; flex-wrap:wrap; gap:.4rem; margin-top:.6rem; }
.gezgin{ display:flex; justify-content:space-between; align-items:center; gap:.5rem; margin-bottom:.75rem; }
.izgara{ display:grid; gap:.6rem; }
@media (min-width:900px){ .izgara{ grid-template-columns:repeat(7,minmax(0,1fr)); gap:.4rem; } }
.gun{ background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:.6rem; min-width:0; }
.gun h3{ font-size:.875rem; margin:0 0 .5rem; }
.gun h3 span{ color:var(--muted); font-weight:400; }
.saatler{ display:grid; grid-template-columns:repeat(auto-fill,minmax(5rem,1fr)); gap:.3rem; }
@media (min-width:900px){ .saatler{ grid-template-columns:minmax(0,1fr); } }
.saat{ min-height:40px; padding:.2rem .3rem; font-size:.8125rem; line-height:1.2; font-variant-numeric:tabular-nums; overflow:hidden; text-overflow:ellipsis; text-align:center; }
.saat.kapali{ color:var(--muted); border-style:dashed; background:transparent; }
.saat.acik{ border-color:var(--accent); font-weight:600; }
.saat.plan{ background:var(--plan); color:var(--plan-t); border-color:transparent; }
.saat.bekliyor{ background:var(--talep); color:var(--talep-t); border-color:transparent; font-weight:600; }
.saat.onayli{ background:var(--onay); color:var(--onay-t); border-color:transparent; font-weight:600; }
.saat small{ display:block; font-size:.75rem; font-weight:400; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.lejant{ display:flex; flex-wrap:wrap; gap:.75rem; color:var(--muted); font-size:.8125rem; margin:.6rem 0 0; }
.lejant i{ display:inline-block; width:.8rem; height:.8rem; border-radius:3px; margin-right:.3rem; vertical-align:-1px; border:1px solid var(--border); }
.hafta-satir{ display:grid; grid-template-columns:6.5rem 1fr 1fr 5.5rem; gap:.4rem; align-items:center; margin-bottom:.4rem; }
.hafta-satir label{ display:flex; gap:.3rem; align-items:center; font-size:.8125rem; }
.hafta-satir input[type=checkbox]{ width:1.1rem; height:1.1rem; min-height:0; }
dialog{ border:1px solid var(--border); border-radius:12px; background:var(--surface); color:var(--text); width:min(26rem,calc(100vw - 2rem)); padding:1.1rem; }
dialog::backdrop{ background:rgba(13,18,25,.6); }
dialog h2{ margin:0 0 .75rem; }
dialog label{ display:block; margin-bottom:.7rem; font-weight:500; }
#ileti{ position:sticky; top:0; z-index:5; padding:.5rem .75rem; margin:0 -.25rem .5rem; border-radius:7px; background:var(--ana-bg); color:var(--ana-t); }
#ileti.hata{ background:var(--err); color:#fff; }
</style>
</head>
<body>
<main>
	<h1>Takvim paneli</h1>
	<div id="ileti" role="status" hidden></div>
	<section id="bekleyenler"></section>

	<h2>Takvim (Türkiye saati)</h2>
	<div class="gezgin">
		<button type="button" id="geri" aria-label="Önceki hafta">←</button>
		<strong id="aralik"></strong>
		<button type="button" id="ileri" aria-label="Sonraki hafta">→</button>
	</div>
	<div class="izgara" id="izgara"></div>
	<p class="lejant">
		<span><i style="border-color:var(--accent)"></i>Öğrenciye açık</span>
		<span><i style="border-style:dashed"></i>Kapalı</span>
		<span><i style="background:var(--plan)"></i>Planın</span>
		<span><i style="background:var(--talep)"></i>Bekleyen talep</span>
		<span><i style="background:var(--onay)"></i>Onaylı ders</span>
	</p>

	<h2>Haftalık açık saatler</h2>
	<div class="kart" id="hafta"></div>
</main>

<dialog id="pencere">
	<h2 id="pBaslik"></h2>
	<div id="pIcerik"></div>
</dialog>

<script>
(function () {
	var $ = function (id) { return document.getElementById(id); };
	var GUNLER = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
	var AYLAR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
	// Adreste parola varsa (kullanici:parola@) göreli fetch hata verir; origin onu içermez.
	var UC = location.origin + "/takvim/yonet";
	var veri = null;
	var hafta = 0;
	var iletiSayac = null;

	function el(etiket, sinif, metin) {
		var e = document.createElement(etiket);
		if (sinif) e.className = sinif;
		if (metin != null) e.textContent = metin;
		return e;
	}
	function iki(n) { return String(n).padStart(2, "0"); }
	function gunEkle(gun, n) {
		var d = new Date(gun + "T00:00:00Z");
		d.setUTCDate(d.getUTCDate() + n);
		return d.toISOString().slice(0, 10);
	}
	function haftaGunu(gun) { return new Date(gun + "T00:00:00Z").getUTCDay(); }
	function tarih(gun) { var p = gun.split("-"); return Number(p[2]) + " " + AYLAR[Number(p[1]) - 1]; }

	function ileti(metin, hata) {
		var k = $("ileti");
		k.textContent = metin;
		k.className = hata ? "hata" : "";
		k.hidden = false;
		clearTimeout(iletiSayac);
		iletiSayac = setTimeout(function () { k.hidden = true; }, hata ? 7000 : 3500);
	}

	function gonder(govde) {
		return fetch(UC, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(govde)
		}).then(function (y) {
			return y.json().catch(function () { return {}; }).then(function (v) {
				if (!y.ok) throw new Error(v.hata || "İşlem yapılamadı.");
				return v;
			});
		});
	}

	function yukle() {
		return fetch(UC, { cache: "no-store" }).then(function (y) {
			if (y.status === 401) { location.reload(); throw new Error("Parola gerekli."); }
			return y.json().then(function (v) {
				if (!y.ok) throw new Error(v.hata || "Veri okunamadı.");
				return v;
			});
		}).then(function (v) { veri = v; ciz(); });
	}

	function islem(govde, basari) {
		return gonder(govde).then(function (v) {
			if (basari) ileti(basari);
			return yukle().then(function () { return v; });
		}).catch(function (e) { ileti(e.message, true); });
	}

	function talepDugmeleri(k, kapsayici, sonra) {
		function bitti() { if (sonra) sonra(); }
		if (k.status === "bekliyor") {
			var on = el("button", "ana", "Onayla");
			on.addEventListener("click", function () {
				islem({ islem: "onayla", id: k.id }, "Onaylandı.").then(function (v) {
					if (v && v.wa) wpSor(v.wa, "Öğrenciye haber ver"); else bitti();
				});
			});
			var red = el("button", "", "Reddet");
			red.addEventListener("click", function () {
				islem({ islem: "reddet", id: k.id }, "Reddedildi, saat yeniden boş.").then(function (v) {
					if (v && v.wa) wpSor(v.wa, "Öğrenciye haber ver"); else bitti();
				});
			});
			kapsayici.append(on, red);
		} else {
			var ip = el("button", "", "Dersi iptal et");
			ip.addEventListener("click", function () {
				if (!confirm("Bu ders iptal edilsin mi? Saat yeniden boşa çıkar.")) return;
				islem({ islem: "iptal", id: k.id }, "İptal edildi.").then(bitti);
			});
			kapsayici.appendChild(ip);
		}
		if (k.wa) {
			var w = el("a", "dugme", "WhatsApp");
			w.href = k.wa; w.target = "_blank"; w.rel = "noopener";
			kapsayici.appendChild(w);
		}
	}

	function wpSor(baglanti, etiket) {
		var p = $("pIcerik");
		$("pBaslik").textContent = "Öğrenciye haber ver";
		var s = el("div", "satir");
		var a = el("a", "dugme", etiket);
		a.href = baglanti; a.target = "_blank"; a.rel = "noopener";
		a.addEventListener("click", function () { $("pencere").close(); });
		var k = el("button", "", "Kapat");
		k.addEventListener("click", function () { $("pencere").close(); });
		s.append(a, k);
		p.replaceChildren(el("p", "alt", "Karar öğrenciye kendiliğinden gitmez, WhatsApp'tan sen yazarsın."), s);
		if (!$("pencere").open) $("pencere").showModal();
	}

	function talepKarti(k) {
		var kart = el("div", "kart");
		kart.appendChild(el("strong", "", k.saat));
		kart.appendChild(el("div", "alt", k.name + " · +" + k.phone + " · " + k.topic));
		if (k.ogrenciSaati) kart.appendChild(el("div", "alt", "Öğrencinin saati: " + k.ogrenciSaati + " (" + k.tz + ")"));
		if (k.note) kart.appendChild(el("div", "alt", k.note));
		var s = el("div", "satir");
		talepDugmeleri(k, s, function () { if ($("pencere").open) $("pencere").close(); });
		kart.appendChild(s);
		return kart;
	}

	function ciz() {
		var bekleyen = veri.kayitlar.filter(function (k) { return k.status === "bekliyor"; });
		var alan = $("bekleyenler");
		alan.replaceChildren();
		if (bekleyen.length) {
			alan.appendChild(el("h2", "", "Bekleyen talepler (" + bekleyen.length + ")"));
			bekleyen.forEach(function (k) { alan.appendChild(talepKarti(k)); });
		}
		izgara();
		haftaFormu();
	}

	function izgara() {
		var bas = gunEkle(veri.bugun, hafta * 7);
		$("aralik").textContent = tarih(bas) + " – " + tarih(gunEkle(bas, 6));
		$("geri").disabled = hafta === 0;
		var dolu = {};
		veri.kayitlar.forEach(function (k) { dolu[k.start] = k; });

		var kutular = [];
		for (var i = 0; i < 7; i++) (function (gun) {
			var kutu = el("section", "gun");
			var h = el("h3", "", GUNLER[haftaGunu(gun)] + " ");
			h.appendChild(el("span", "", tarih(gun)));
			kutu.appendChild(h);
			var liste = el("div", "saatler");
			var aralik = veri.hafta[haftaGunu(gun)];
			for (var saat = 8; saat < 24; saat++) (function (saat) {
				var start = gun + "T" + iki(saat) + ":00";
				if (start.slice(0, 13) < veri.simdi.slice(0, 13)) return;
				var k = dolu[start];
				var acik = aralik && saat >= aralik[0] && saat < aralik[1];
				var d = el("button", "saat " + (k ? (k.kind === "plan" ? "plan" : k.status) : (acik ? "acik" : "kapali")), iki(saat) + ":00");
				d.type = "button";
				if (k) {
					var yazi = k.kind === "plan" ? (k.title || "Plan") : k.name;
					d.appendChild(el("small", "", yazi));
					d.addEventListener("click", function () { kayitPenceresi(k); });
				} else {
					d.addEventListener("click", function () { planPenceresi(start); });
				}
				liste.appendChild(d);
			})(saat);
			kutu.appendChild(liste);
			kutular.push(kutu);
		})(gunEkle(bas, i));
		$("izgara").replaceChildren.apply($("izgara"), kutular);
	}

	function planPenceresi(start) {
		var saat = Number(start.slice(11, 13));
		$("pBaslik").textContent = tarih(start.slice(0, 10)) + " " + start.slice(11, 16) + " · plan ekle";
		var p = $("pIcerik");
		var e1 = el("label", "", "Başlık (yalnız sen görürsün)");
		var baslik = el("input");
		baslik.type = "text"; baslik.maxLength = 80; baslik.placeholder = "Örn. iş, spor, aile";
		e1.appendChild(baslik);
		var e2 = el("label", "", "Süre");
		var sure = el("select");
		for (var n = 1; n <= Math.min(12, 24 - saat); n++) {
			var o = el("option", "", n + " saat");
			o.value = n;
			sure.appendChild(o);
		}
		e2.appendChild(sure);
		var s = el("div", "satir");
		var ekle = el("button", "ana", "Saati doldur");
		ekle.addEventListener("click", function () {
			ekle.disabled = true;
			islem({ islem: "plan_ekle", start: start, saatSayisi: Number(sure.value), title: baslik.value }).then(function (v) {
				if (v) ileti(v.atlanan ? v.eklenen + " saat eklendi, " + v.atlanan + " saat zaten doluydu." : "Plan eklendi.");
				$("pencere").close();
			});
		});
		var vaz = el("button", "", "Vazgeç");
		vaz.addEventListener("click", function () { $("pencere").close(); });
		s.append(ekle, vaz);
		p.replaceChildren(e1, e2, s);
		$("pencere").showModal();
	}

	function kayitPenceresi(k) {
		var p = $("pIcerik");
		if (k.kind === "plan") {
			$("pBaslik").textContent = k.saat;
			var s = el("div", "satir");
			var sil = el("button", "ana", "Planı kaldır");
			sil.addEventListener("click", function () {
				islem({ islem: "iptal", id: k.id }, "Plan kaldırıldı, saat boşa çıktı.").then(function () { $("pencere").close(); });
			});
			var vaz = el("button", "", "Kapat");
			vaz.addEventListener("click", function () { $("pencere").close(); });
			s.append(sil, vaz);
			p.replaceChildren(el("p", "", k.title || "Başlıksız plan"), s);
		} else {
			$("pBaslik").textContent = k.status === "onayli" ? "Onaylı ders" : "Bekleyen talep";
			var kart = talepKarti(k);
			var kapat = el("button", "", "Kapat");
			kapat.addEventListener("click", function () { $("pencere").close(); });
			kart.querySelector(".satir").appendChild(kapat);
			p.replaceChildren(kart);
		}
		$("pencere").showModal();
	}

	function saatSec(deger, min, max) {
		var s = el("select");
		for (var i = min; i <= max; i++) {
			var o = el("option", "", iki(i) + ":00");
			o.value = i;
			if (i === deger) o.selected = true;
			s.appendChild(o);
		}
		return s;
	}

	function haftaFormu() {
		var alan = $("hafta");
		alan.replaceChildren();
		var kontroller = {};
		[1, 2, 3, 4, 5, 6, 0].forEach(function (g) {
			var ar = veri.hafta[g];
			var satir = el("div", "hafta-satir");
			satir.appendChild(el("span", "", GUNLER[g]));
			var bas = saatSec(ar ? ar[0] : 19, 0, 23);
			var bit = saatSec(ar ? ar[1] : 23, 1, 24);
			bas.setAttribute("aria-label", GUNLER[g] + " başlangıç");
			bit.setAttribute("aria-label", GUNLER[g] + " bitiş");
			var etiket = el("label", "");
			var kapali = el("input");
			kapali.type = "checkbox";
			kapali.checked = !ar;
			bas.disabled = bit.disabled = !ar;
			kapali.addEventListener("change", function () { bas.disabled = bit.disabled = kapali.checked; });
			etiket.append(kapali, " Kapalı");
			satir.append(bas, bit, etiket);
			alan.appendChild(satir);
			kontroller[g] = { bas: bas, bit: bit, kapali: kapali };
		});
		var kaydet = el("button", "ana", "Saatleri kaydet");
		kaydet.addEventListener("click", function () {
			var yeni = {};
			Object.keys(kontroller).forEach(function (g) {
				var c = kontroller[g];
				yeni[g] = c.kapali.checked ? null : [Number(c.bas.value), Number(c.bit.value)];
			});
			islem({ islem: "hafta_kaydet", hafta: yeni }, "Haftalık saatler kaydedildi.");
		});
		var s = el("div", "satir");
		s.appendChild(kaydet);
		alan.appendChild(s);
	}

	$("geri").addEventListener("click", function () { hafta--; izgara(); });
	$("ileri").addEventListener("click", function () { hafta++; izgara(); });
	yukle().catch(function (e) { ileti(e.message, true); });
})();
</script>
</body>
</html>
`;
