/**
 * Sunucudan Türkiye saatiyle gelen boş/dolu saatleri ziyaretçinin kendi saatine çevirir.
 * Tarayıcının yerel saatiyle çalışır; yaz saati ve yarım saatlik dilimler buradan doğru gelir.
 * Bir saat, ziyaretçide başka güne düşebilir: bu yüzden günler burada yeniden kurulur.
 */
(function (kok) {
	var ADLAR = {
		tr: {
			aylar: ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"],
			gunler: ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"]
		},
		en: {
			aylar: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],
			gunler: ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
		}
	};

	function iki(n) { return String(n).padStart(2, "0"); }
	function an(start) { return new Date(start + ":00+03:00"); }
	function gunAnahtari(d) { return d.getFullYear() + "-" + iki(d.getMonth() + 1) + "-" + iki(d.getDate()); }
	function saatYaz(d) { return iki(d.getHours()) + ":" + iki(d.getMinutes()); }
	function tarihYaz(d, ad) { return ad === ADLAR.en ? ad.aylar[d.getMonth()] + " " + d.getDate() : d.getDate() + " " + ad.aylar[d.getMonth()]; }

	function saatBilgisi(s) {
		var d = an(s.start);
		var bitis = new Date(d.getTime() + 3600000);
		return {
			start: s.start,
			durum: s.durum,
			saat: saatYaz(d),
			aralik: saatYaz(d) + "–" + saatYaz(bitis),
			turkiyeden: d.getTimezoneOffset() !== -180,
			turkiyeYazisi: s.start.slice(11, 16)
		};
	}

	/** @returns gün gün, boş günler dahil kesintisiz liste; ilk gün ziyaretçinin bugünü. dil: "tr" (varsayılan) ya da "en". */
	function grupla(gunler, simdi, dil) {
		var ad = ADLAR[dil] || ADLAR.tr;
		var kovalar = {};
		var son = null;
		gunler.forEach(function (g) {
			g.saatler.forEach(function (s) {
				var d = an(s.start);
				var a = gunAnahtari(d);
				(kovalar[a] = kovalar[a] || []).push({ d: d, s: s });
				if (!son || a > son) son = a;
			});
		});

		var imlec = simdi ? new Date(simdi.getTime()) : new Date();
		imlec = new Date(imlec.getFullYear(), imlec.getMonth(), imlec.getDate(), 12);
		var sonuc = [];
		var enAz = gunler.length;
		for (var i = 0; i < enAz || (son && gunAnahtari(imlec) <= son); i++) {
			var a = gunAnahtari(imlec);
			sonuc.push({
				gun: a,
				ad: ad.gunler[imlec.getDay()],
				tarih: tarihYaz(imlec, ad),
				saatler: (kovalar[a] || [])
					.sort(function (x, y) { return x.d - y.d; })
					.map(function (k) { return saatBilgisi(k.s); })
			});
			imlec = new Date(imlec.getFullYear(), imlec.getMonth(), imlec.getDate() + 1, 12);
		}
		return sonuc;
	}

	function saatDilimi() {
		try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { return ""; }
	}

	var api = { grupla: grupla, saatDilimi: saatDilimi };
	kok.TakvimSaat = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
