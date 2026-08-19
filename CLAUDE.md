# linklerim

Linktree yerine geçen kişisel link sayfası. **Açık kaynak**, canlı:
<https://link.vitrincim.com>

Saf HTML + CSS. Sayfa ve fonksiyonlar Vercel'de, tık sayacı Cloudflare D1'de.
Mimari gerekçeler `README.md`'de yazılı (özellikle §10: neden Cloudflare Pages değil)
— kod yazmadan önce oku.

## Bu projenin kuralları

Bunlar bilinçli kararlar, eksiklik değil:

- **Build adımı yok, runtime bağımlılığı yok.** Derleyici, bundler, framework
  eklenmeyecek. `package.json` sadece test ve dağıtım için var.
- **Maliyet $0 kalmalı** (alan adı hariç). Vercel ve Cloudflare'in ücretsiz
  katmanlarını aşacak bir çözüm önerme.
- Koyu/açık tema `prefers-color-scheme` ile otomatik — elle tema düğmesi eklenmeyecek.

## Yapı

| Yol | Ne |
|---|---|
| `api/` | Vercel fonksiyonları — tık sayacı yazımı |
| `lib/` | Ortak yardımcılar |
| `schema.sql` | Cloudflare D1 tablo şeması |
| `links.example.json` | Link listesi şablonu. Gerçek `links.json` bunun kopyası |
| `tests/` | Testler |

## Kırmızı çizgiler

- **Cloudflare ve Vercel token'larını okuma veya yazdırma.** `.wrangler/` ve
  `.vercel/` klasörleri yerel kimlik bilgisi tutar, commit'e girmemeli.
- **Canlı sayaç verisini silme veya sıfırlama.** D1'deki tık geçmişi geri gelmez.
- Depo herkese açık — commit geçmişine kişisel veri veya anahtar girmesin.
