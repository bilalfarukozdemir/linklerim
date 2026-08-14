# linklerim

Linktree yerine geçen kişisel link sayfası. Saf HTML + CSS, build step yok,
runtime bağımlılığı sıfır. **Toplam maliyet: $0** (alan adı hariç).

Sayfa ve fonksiyonlar **Vercel**'de barınır; link başına tık sayacı
**Cloudflare D1**'de tutulur ve oraya HTTP API üzerinden yazılır. İkisi de
ücretsiz katman — kurulum için iki hesap gerekiyor, ikisi de bedava.
Nedenini merak edersen: [§10](#10-neden-cloudflare-pages-değil).

Linktree Pro'nun görünen tarafı burada bedava: link başına tık sayısı,
kendi alan adı, özelleştirilebilir görünüm, doğru paylaşım önizlemesi.

Canlı: <https://link.vitrincim.com>

```
linklerim/
├── public/               ← yayınlanan dizin
│   ├── index.html        ← sayfa (CSS gömülü, harici font/JS/CDN yok)
│   ├── links.json        ← CMS'in. Tek düzenlediğin dosya.
│   ├── avatar.jpg        ← profil fotoğrafı
│   ├── icons/            ← link ikonları (yerel kopya, dışarıya istek yok)
│   ├── og.png            ← paylaşım görseli, 1200×630, statik
│   └── 404.html
├── api/                  ← Vercel Edge Function'ları
│   ├── go/[slug].js      ← /go/<slug> → 302 + tık sayacı
│   └── stats.js          ← /stats → parola korumalı istatistik sayfası
├── lib/                  ← ortak mantık (test edilebilir olsun diye ayrı)
│   ├── bots.js           ← bot / önizleme / prefetch filtresi
│   ├── links.js          ← links.json okuma + doğrulama
│   ├── go.js             ← yönlendirme + tık kaydı
│   ├── d1.js             ← Cloudflare D1'e HTTP API istemcisi
│   └── stats.js          ← parola kontrolü + istatistik HTML'i
├── tests/                ← node --test, bağımlılık yok
├── vercel.json           ← rewrite'lar, güvenlik başlıkları, cache
├── wrangler.toml         ← sadece D1 komut satırı işleri için
├── links.example.json    ← fork edenler için şablon
└── schema.sql            ← D1 tabloları
```

---

## 0. Bu repoyu forkladıysan

Kod herkese açık, veri de öyle — çünkü bu sayfanın işi zaten o veriyi
yayınlamak. Kendine uyarlamak için değiştirmen gereken **6 şey**:

| # | Dosya | Ne yapacaksın |
|---|---|---|
| 1 | `public/links.json` | [`links.example.json`](links.example.json) içeriğini üzerine kopyala, kendi adın/bio/linklerinle doldur |
| 2 | `public/avatar.jpg` | Kendi fotoğrafınla değiştir (kare, ~400×400). İstemiyorsan sil ve `links.json`'da `"avatar": ""` yap — baş harflerin çizilir |
| 3 | `public/icons/` | İçindekileri sil. Kendi linklerinin ikonlarını istiyorsan aşağıya bak; istemiyorsan `links.json`'dan `icon` alanlarını çıkar, emoji'ler devreye girer |
| 4 | `public/index.html` | Baştaki meta bloğu: `<title>`, `og:*`, `twitter:*` ve `canonical`. İçinde `link.vitrincim.com` geçen 4 adresi kendi alan adınla değiştir |
| 5 | `public/og.png` | 1200×630 kendi paylaşım görselin |
| 6 | `wrangler.toml` | Kendi D1 veritabanının UUID'si (`npx wrangler d1 list` ile öğrenilir) |

Bunlar dışında hiçbir yerde kişisel veri yok. Parolalar ve API token'ları
repoda değil, Vercel'in ortam değişkenlerinde.

**Link ikonları:** her sitenin kendi favicon'unu indirip `public/icons/`
içine koy — `https://site.com/apple-touch-icon.png` veya
`https://site.com/favicon.ico` çoğunda çalışır. PNG'ye çevir (dosya uzantısı
ile gerçek format uyuşmazsa `nosniff` başlığı yüzünden tarayıcı çizmez),
`links.json`'da `"icon": "/icons/adi.png"` yaz.

Google'ın favicon servisi gibi bir üçüncü partiye **bağlanmıyoruz**: hem
harici bağımlılık olurdu hem de sayfanı açan herkesin IP'si o servise
düşerdi. İkonlar yerel dosya.

---

## 1. Vercel'e bağlama

1. Klasörü bir GitHub reposuna at, sonra:

   ```bash
   npx vercel link --yes --project linklerim
   ```

   Bu komut projeyi oluşturur ve GitHub reposunu bağlar. Bundan sonra `main`
   dalına atılan her commit otomatik deploy olur.

2. Build ayarı yok. `vercel.json` gerekli her şeyi söylüyor:
   - `outputDirectory: public` — yayınlanan dizin
   - `rewrites` — `/go/:slug` ve `/stats` adreslerini `api/` altındaki
     fonksiyonlara bağlar
   - `headers` — güvenlik başlıkları ve cache kuralları

3. İlk yayın:

   ```bash
   npx vercel --prod
   ```

---

## 2. Tık sayacı (Cloudflare D1)

Sayaç Cloudflare D1'de duruyor ve oraya HTTP API üzerinden yazılıyor.
Vercel'in ücretsiz katmanında yerleşik bir veritabanı yok; alternatifler
(Upstash, Neon) ayrı birer üçüncü parti hesap demek. D1'in ücretsiz katmanı
bu iş için fazlasıyla yeterli.

**a) Veritabanını oluştur**

Cloudflare dashboard → **Storage & Databases** → **D1** → **Create**
→ ad: `linklerim-clicks`. Sonra `wrangler.toml` içindeki `database_id`
alanına UUID'yi yaz.

**b) Tabloları kur**

```bash
npx wrangler d1 execute linklerim-clicks --remote --file=schema.sql
```

**c) API token'ı üret**

Cloudflare → profil menüsü → **API Tokens** → **Create Custom Token**:

| Alan | Değer |
|---|---|
| Permissions | Account → **D1** → **Edit** |
| Account Resources | Include → kendi hesabın |

**d) Vercel'e üç değişkeni tanıt**

```bash
npx vercel env add CF_ACCOUNT_ID production
npx vercel env add CF_DATABASE_ID production
npx vercel env add CF_API_TOKEN production
```

Sırasıyla: Cloudflare hesap ID'si, D1 veritabanı UUID'si, üstteki token.
Ekledikten sonra yeniden deploy et — ortam değişkenleri yalnızca yeni
deployment'lara işler.

> Üçünden biri eksikse site yine çalışır: linkler yönlenir, sadece sayaç
> yazmaz. Sayaç hiçbir zaman yönlendirmeyi bloklamaz.

---

## 3. /stats parolası

```bash
npx vercel env add STATS_PASSWORD production
```

Komut parolayı soracak, yaz ve enter'la. Sonra yeniden deploy et.

Artık `https://siten/stats` tarayıcıda parola kutusu çıkarır (kullanıcı adı
serbest, sadece parola önemli). Terminalden:

```bash
curl -u :PAROLA https://siten/stats
```

Tanımlı değilse `/stats` 503 döner — açıkta kalmaz.

---

## 4. Web Analytics (ücretsiz, çerezsiz)

Vercel → proje → **Analytics** sekmesi → **Enable**.

`index.html` içindeki script zaten hazır. Script **kendi alan adından**
(`/_vercel/insights/script.js`) geliyor, yani harici bağımlılık bile değil —
CSP'de tek bir dış kaynağa izin vermek gerekmiyor. Çerez yok, kişisel veri
yok, GDPR banner'ı gerekmez.

---

## 5. Kendi alan adını bağlama

```bash
npx vercel domains add link.ornek.com
```

Alan adının DNS'i Vercel'deyse kayıt otomatik oluşur. Başka bir sağlayıcıdaysa
Vercel sana eklemen gereken kaydı söyler.

**Alan adını değiştirirsen** `public/index.html` içindeki meta bloğunda geçen
4 adresi de güncelle (`canonical`, `og:url`, `og:image`, `twitter:image`).
Bu adresler mutlak olmak zorunda, yoksa paylaşım önizlemesi çalışmaz.

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
| `credit.label` / `credit.url` | – | Footer'daki "… tarafından yapıldı" satırı. Blok silinirse satır da kaybolur |
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

**İsim veya bio'yu değiştirirsen** `index.html` içindeki meta tag'leri ve
`og.png` görselini de elle güncelle. Paylaşım önizlemesini çeken botlar
JavaScript çalıştırmaz.

---

## 7. OG görseli

`public/og.png` — 1200×630 statik PNG. Otomatik üretim yok. Değiştirmek için
aynı ölçüde bir PNG ile üzerine yaz.

> Dosyayı **~50 KB altında tut**. Düz renk ve gradyan ağırlıklı bu tasarımda
> 256 renkli palet gözle fark edilmeyen bir kayıpla dosyayı üçte birine
> indiriyor (137 KB → 47 KB). Paylaşım önizlemesi o kadar hızlı açılır.

Test için:

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

**Gizlilik:** veritabanına sadece `slug + zaman damgası + sayaç` yazılır.
Ham IP, user-agent, referrer hiçbir yerde loglanmaz veya saklanmaz.
Bunu doğrulayan bir test var (`tests/go.test.js`).

Sayaç `waitUntil()` ile arka planda yazılır: yönlendirmeyi geciktirmez,
veritabanı çökse bile link çalışmaya devam eder.

---

## 9. Yerelde çalıştırma

```bash
npx vercel env pull .env.local   # ortam değişkenlerini indir (repoya girmez)
npx vercel dev                   # http://localhost:3000
npm test                         # 30 test, bağımlılık yok
```

Veritabanına bakmak:

```bash
npx wrangler d1 execute linklerim-clicks --remote --command "SELECT * FROM clicks"
```

---

## 10. Neden Cloudflare Pages değil

Proje ilk olarak Cloudflare Pages üzerine kurulmuştu ve orada sorunsuz
çalışıyordu. Taşınma sebebi teknik değil: **`pages.dev` Türkiye'de DNS
seviyesinde engelli.** Türk Telekom çözümleyicisi apex için engel sayfasının
IP'sini (`195.175.254.2`) döndürüyor, alt alanları hiç çözmüyor — 8.8.8.8 veya
1.1.1.1 sorulsa bile, çünkü düz DNS trafiği araya giriliyor. Sadece şifreli
DNS (DoH) kullananlar siteye ulaşabiliyordu.

Özel alan adı bir CNAME ile `pages.dev`'e bağlandığı için engel zincire
yansıyordu. Denenen ve işe yaramayan yollar:

- **ALIAS kaydı** (sunucu tarafında düzleştirilmiş CNAME): engeli aşıyordu
  ama Cloudflare'in özel alan adı doğrulaması gerçek bir CNAME aradığı için
  domain hiç aktifleşmedi.
- **Alt alan zone devri**: Cloudflare bunu ücretsiz planda kabul etmiyor.
- **Tüm alan adını Cloudflare'e taşımak**: e-posta kayıtlarını riske atıyordu.

Vercel'de barınmak zinciri tamamen ortadan kaldırıyor. Sayaç yine D1'de,
sadece artık HTTP API üzerinden yazılıyor.

---

## 11. Kapsam dışı — bilinçli olarak yok

VPS/Docker/nginx yok, build pipeline yok, framework yok, hesap sistemi/admin
paneli yok, üçüncü parti analytics yok, e-posta toplama yok, otomatik OG
üretimi yok.

Toplam runtime bağımlılığı: **sıfır**.
