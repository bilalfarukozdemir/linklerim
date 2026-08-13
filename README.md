# linklerim

Linktree yerine geçen kişisel link sayfası. Saf HTML + CSS, build step yok,
Cloudflare Pages'in ücretsiz katmanında çalışır. **Toplam maliyet: $0**
(kendi alan adını bağlarsan ~$10/yıl).

Linktree Pro'nun görünen tarafı burada bedava: link başına tık sayısı,
kendi alan adı, özelleştirilebilir görünüm, doğru paylaşım önizlemesi.

```
linklerim/
├── public/               ← Cloudflare Pages'in yayınladığı dizin
│   ├── index.html        ← sayfa (CSS gömülü, harici bağımlılık yok)
│   ├── links.json        ← CMS'in. Tek düzenlediğin dosya.
│   ├── avatar.jpg        ← profil fotoğrafı
│   ├── icons/            ← link ikonları (yerel kopya, dışarıya istek yok)
│   ├── og.png            ← paylaşım görseli, 1200×630, statik
│   └── _headers          ← güvenlik + cache başlıkları
├── functions/            ← Cloudflare Pages Functions (repo kökünde olmalı)
│   ├── go/[slug].js      ← /go/<slug> → 302 + tık sayacı
│   └── stats.js          ← /stats → parola korumalı istatistik sayfası
├── lib/                  ← ortak mantık (test edilebilir olsun diye ayrı)
│   ├── bots.js           ← bot / önizleme / prefetch filtresi
│   ├── links.js          ← links.json okuma + doğrulama
│   ├── go.js             ← yönlendirme + D1 kaydı
│   └── stats.js          ← parola kontrolü + istatistik HTML'i
├── tests/                ← node --test, bağımlılık yok
├── links.example.json    ← fork edenler için şablon
└── schema.sql            ← D1 tabloları
```

---

## 0. Bu repoyu forkladıysan

Kod herkese açık, veri de öyle — çünkü bu sayfanın işi zaten o veriyi
yayınlamak. Kendine uyarlamak için değiştirmen gereken **5 şey**:

| # | Dosya | Ne yapacaksın |
|---|---|---|
| 1 | `public/links.json` | [`links.example.json`](links.example.json) içeriğini üzerine kopyala, kendi adın/bio/linklerinle doldur |
| 2 | `public/avatar.jpg` | Kendi fotoğrafınla değiştir (kare, ~400×400). İstemiyorsan sil ve `links.json`'da `"avatar": ""` yap — baş harflerin çizilir |
| 3 | `public/icons/` | İçindekileri sil. Kendi linklerinin ikonlarını istiyorsan aşağıya bak; istemiyorsan `links.json`'dan `icon` alanlarını çıkar, emoji'ler devreye girer |
| 4 | `public/index.html` | Baştaki meta bloğu: `<title>`, `og:*`, `twitter:*` ve `canonical`. İçinde `link.vitrincim.com` geçen 4 adresi kendi alan adınla değiştir |
| 5 | `public/og.png` | 1200×630 kendi paylaşım görselin |

Bunlar dışında hiçbir yerde kişisel veri yok. Parolalar ve veritabanı
kimlikleri zaten repoda değil (Cloudflare dashboard'da).

**Link ikonları:** her sitenin kendi favicon'unu indirip `public/icons/`
içine koy — `https://site.com/apple-touch-icon.png` veya
`https://site.com/favicon.ico` çoğunda çalışır. PNG'ye çevir (dosya uzantısı
ile gerçek format uyuşmazsa `nosniff` header'ı yüzünden tarayıcı çizmez),
`links.json`'da `"icon": "/icons/adi.png"` yaz.

Google'ın favicon servisi gibi bir üçüncü partiye **bağlanmıyoruz**: hem
harici bağımlılık olurdu hem de sayfanı açan herkesin IP'si o servise
düşerdi. İkonlar yerel dosya.

---

## 1. Cloudflare Pages'e bağlama

1. Bu klasörü bir GitHub reposuna at (private olabilir):
   ```bash
   git init && git add . && git commit -m "linklerim" && git branch -M main
   ```
   Sonra GitHub'da boş bir repo açıp `git remote add origin ...` + `git push -u origin main`.

2. [dash.cloudflare.com](https://dash.cloudflare.com) → **Compute (Workers & Pages)**
   → **Create** → **Pages** → **Connect to Git** → repoyu seç.

3. Build ayarları — **hepsi bu**:

   | Alan | Değer |
   |---|---|
   | Framework preset | **None** |
   | Build command | **boş bırak** |
   | Build output directory | `public` |
   | Root directory | `/` |

   > Build command'ı boş bırakmak önemli. `package.json` sadece test scriptleri
   > için var, bağımlılığı yok; Pages hiçbir şey derlemeyecek.
   > `functions/` dizini repo kökünde durur (`public/` içinde değil) —
   > Cloudflare onu otomatik bulur.

4. **Save and Deploy**. ~30 saniye sonra site `<proje>.pages.dev` adresinde.

Bundan sonra `main` dalına atılan her commit otomatik deploy olur.

---

## 2. D1 veritabanı (tık sayacı)

**a) Veritabanını oluştur**

Dashboard → **Storage & Databases** → **D1 SQL Database** → **Create**
→ ad: `linklerim-clicks`.

**b) Tabloları kur**

Veritabanı sayfasındaki **Console** sekmesine [`schema.sql`](schema.sql)
içeriğini yapıştırıp çalıştır. Ya da terminalden:

```bash
npx wrangler d1 execute linklerim-clicks --remote --file=schema.sql
```

**c) Pages projesine bağla**

Pages projesi → **Settings** → **Bindings** → **Add** → **D1 database**:

| Alan | Değer |
|---|---|
| Variable name | `DB` |
| D1 database | `linklerim-clicks` |

Kaydet, sonra **Deployments** → son deployment → **Retry deployment**.
Binding'ler ancak yeni bir deploy ile devreye girer.

> Binding yoksa site yine çalışır: linkler yönlenir, sadece sayaç yazmaz.
> Sayaç hiçbir zaman yönlendirmeyi bloklamaz.

---

## 3. /stats parolası

Pages projesi → **Settings** → **Variables and Secrets** → **Add**:

| Alan | Değer |
|---|---|
| Type | **Secret** (Text değil) |
| Name | `STATS_PASSWORD` |
| Value | uzun ve rastgele bir parola |

Kaydet + yeniden deploy et. Artık `https://siten/stats` adresi tarayıcıda
parola kutusu çıkarır (kullanıcı adı serbest, sadece parola önemli).

Terminalden bakmak için:

```bash
curl -u :PAROLA https://siten/stats
```

Secret repoda durmaz, dashboard'da şifreli tutulur. Tanımlı değilse `/stats`
503 döner — açıkta kalmaz.

---

## 4. Cloudflare Web Analytics (ücretsiz, çerezsiz)

Pages projesi → **Analytics** sekmesi → **Web Analytics** → **Enable**.

Koda hiçbir şey eklemene gerek yok: Cloudflare beacon'ı kenarda kendisi
enjekte eder. Çerez yok, kişisel veri yok, GDPR banner'ı gerekmez.
(`_headers` içindeki CSP bu beacon'a zaten izin veriyor.)

---

## 5. Kendi alan adını bağlama

Pages projesi → **Custom domains** → **Set up a domain** → alan adını yaz.

**Alan adı zaten Cloudflare'daysa:** DNS kaydını Cloudflare otomatik ekler,
başka bir şey yapman gerekmez.

**Alan adı başka bir kayıt firmasındaysa** şu kayıtları ekle:

**Bu projede kullanılan: `link.vitrincim.com`** (alt alan adı — ek maliyet yok)

| Tip | Ad | İçerik | Proxy | TTL |
|---|---|---|---|---|
| CNAME | `link` | `<proje>.pages.dev` | Proxied (turuncu bulut) | Auto |

Kök alan adını (`ornek.com`) kullanacaksan:

| Tip | Ad | İçerik | Proxy | TTL |
|---|---|---|---|---|
| CNAME | `@` | `<proje>.pages.dev` | Proxied | Auto |
| CNAME | `www` | `<proje>.pages.dev` | Proxied | Auto |

> Apex (`@`) için CNAME'e izin vermeyen sağlayıcılarda ya alan adını
> Cloudflare nameserver'larına taşı (ücretsiz, CNAME flattening yapar)
> ya da sadece `www` kullan. Alt alan adında (`link.`) bu sorun hiç yok.

SSL sertifikası otomatik gelir, birkaç dakika sürebilir.

**Alan adını değiştirirsen** `public/index.html` içindeki meta bloğunda geçen
4 adresi de güncelle (`canonical`, `og:url`, `og:image`, `twitter:image`) ve
commit at. Bu adresler mutlak olmak zorunda, yoksa paylaşım önizlemesi
çalışmaz. Şu an hepsi `https://link.vitrincim.com/` olarak ayarlı.

> Alt alan adı (`link.vitrincim.com` gibi) kullanmak ücretsizdir — elindeki
> alan adına tek bir CNAME kaydı eklemen yeter, ayrı alan adı almana gerek yok.

---

## 6. links.json — telefondan düzenleme

Sayfadaki her şey `public/links.json`'dan gelir. Telefondan:

1. GitHub uygulaması / tarayıcıda repoya gir
2. `public/links.json` → **kalem** simgesi
3. Düzenle → **Commit changes**
4. ~30 saniye sonra site güncellenmiş olur

```json
{
  "profile": {
    "name": "Adın Soyadın",
    "bio": "Tek cümlelik bio.",
    "avatar": "/avatar.jpg",
    "accent": "#4f7cff"
  },
  "credit": {
    "label": "vitrincim.com",
    "url": "https://vitrincim.com"
  },
  "links": [
    {
      "slug": "github",
      "title": "GitHub",
      "url": "https://github.com/kullaniciadin",
      "icon": "/icons/github.png",
      "emoji": "💻",
      "featured": true
    }
  ]
}
```

| Alan | Zorunlu | Not |
|---|---|---|
| `profile.name` | – | Boşsa avatar baş harfi `?` olur |
| `profile.bio` | – | Boşsa satır hiç çizilmez |
| `profile.avatar` | – | Boş bırakırsan baş harfler gösterilir. Dolduracaksan dosyayı `public/` içine koy ve `"/avatar.jpg"` yaz — **dış URL çalışmaz**, CSP engeller |
| `profile.accent` | – | `#rrggbb`. Avatar, odak halkası ve öne çıkan link kenarlığı |
| `credit.label` / `credit.url` | – | Footer'daki "… tarafından yapıldı" satırı. Blok komple silinirse satır da kaybolur |
| `links[].slug` | ✅ | Küçük harf/rakam/`-`. `/go/<slug>` adresi ve sayaç anahtarı bu |
| `links[].title` | ✅ | Butonda görünen yazı |
| `links[].url` | ✅ | `http`, `https`, `mailto` veya `tel` |
| `links[].icon` | – | `public/` içindeki yerel dosya, `/` ile başlamalı. Dış URL kabul edilmez. Dosya yoksa emoji'ye düşer |
| `links[].emoji` | – | İkon yoksa (veya yüklenemezse) solda görünen simge |
| `links[].featured` | – | `true` → accent zemin + kalın kenarlık |

Linklerin **sırası** dosyadaki sıradır. Geçersiz kayıtlar (eksik alan,
`javascript:` gibi şema) sessizce atlanır — sayfa bozulmaz.

> **Slug'ı değiştirirsen** sayacı sıfırlanır; eski slug `/stats` içinde
> "arşiv" olarak görünmeye devam eder.

**İsim veya bio'yu değiştirirsen** `index.html` içindeki meta tag'leri
(`og:title`, `og:description`, `<title>`) ve `og.png` görselini de elle
güncelle. Paylaşım önizlemesini çeken botlar JavaScript çalıştırmaz.

---

## 7. OG görseli

`public/og.png` — 1200×630 statik PNG. Otomatik üretim yok (Satori/resvg
kurmuyoruz; içerik nadiren değişiyor). Değiştirmek için aynı ölçüde bir PNG
ile üzerine yaz. Değişikliğin görünmesi için paylaşım botlarının cache'i
birkaç saat sürebilir; test etmek için:

- X: <https://cards-dev.twitter.com/validator>
- Facebook/WhatsApp: <https://developers.facebook.com/tools/debug/>
- LinkedIn: <https://www.linkedin.com/post-inspector/>

---

## 8. Tık sayımı nasıl çalışıyor

Her link `/go/<slug>` üzerinden gider ve 302 ile hedefe yönlenir.

**Sayılmayanlar** (`lib/bots.js`):
- WhatsApp, Slack, Discord, Telegram, X, iMessage/Applebot, LinkedIn,
  Facebook ve ~60 önizleme botu/crawler'ı
- `curl`, `wget`, `python-requests`, headless tarayıcılar, izleme servisleri
- Tarayıcı prefetch/prerender istekleri (`purpose: prefetch`)
- `HEAD` istekleri ve iframe içi yüklemeler (`sec-fetch-dest`)
- User-agent göndermeyen istekler

Bu filtre olmadan sayılar 2–3 kat şişer: bir linki WhatsApp'ta paylaşman
bile tek başına birkaç "tık" yaratır.

**Gizlilik:** D1'e sadece `slug + zaman damgası + sayaç` yazılır.
Ham IP, user-agent, referrer hiçbir yerde loglanmaz veya saklanmaz.
Bunu doğrulayan bir test var (`tests/go.test.js`).

Sayaç `waitUntil()` ile arka planda yazılır: yönlendirmeyi geciktirmez,
D1 çökse bile link çalışmaya devam eder.

---

## 9. Yerelde çalıştırma

Yerel geliştirme için repo kökünde bir `wrangler.toml` gerekiyor.
**Bu dosya `.gitignore`'da ve öyle kalmalı** — Pages, repoda wrangler config
dosyası görürse dashboard'daki binding ve secret'ları yok sayar.

```toml
name = "linklerim"
compatibility_date = "2026-08-01"
pages_build_output_dir = "./public"

[[d1_databases]]
binding = "DB"
database_name = "linklerim-clicks"
database_id = "00000000-0000-0000-0000-000000000000"

[vars]
STATS_PASSWORD = "yerel-test-parolasi"
```

```bash
npm run db:local     # yerel D1'e tabloları kur (bir kez)
npm run dev          # http://127.0.0.1:8788
npm test             # bot filtresi + sayaç + parola testleri
```

Yerel D1'e bakmak:

```bash
npx wrangler d1 execute linklerim-clicks --local --command "SELECT * FROM clicks"
```

---

## 10. Kapsam dışı — bilinçli olarak yok

VPS/Docker/nginx yok (ücretsiz CDN'i parayla+bakımla değiştirmek olurdu),
build pipeline yok, framework yok, hesap sistemi/admin paneli yok,
üçüncü parti analytics yok, e-posta toplama yok, otomatik OG üretimi yok.

Toplam runtime bağımlılığı: **sıfır**.
