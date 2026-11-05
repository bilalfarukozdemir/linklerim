-- D1 şeması — linklerim
--
-- Saklanan tek şey: slug + zaman damgası + sayaç.
-- IP, user-agent, referrer, cihaz bilgisi HİÇBİR yerde tutulmaz.

-- Link başına toplam sayaç
CREATE TABLE IF NOT EXISTS clicks (
  slug        TEXT PRIMARY KEY,
  count       INTEGER NOT NULL DEFAULT 0,
  first_click TEXT,
  last_click  TEXT
);

-- Günlük kova (UTC). "Son 7 gün" için; tek kayıt tek kişiye bağlanamaz.
CREATE TABLE IF NOT EXISTS clicks_daily (
  slug  TEXT    NOT NULL,
  day   TEXT    NOT NULL,          -- YYYY-MM-DD
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slug, day)
);

CREATE INDEX IF NOT EXISTS idx_clicks_daily_day ON clicks_daily (day);

-- ── Ders takvimi (/takvim) ───────────────────────────────────────────
-- Tık sayacından farklı olarak burada kişisel veri VAR (öğrencinin adı ve
-- telefonu). Yalnız D1'de durur; depoya ve herkese açık uca asla çıkmaz.
-- Herkes yalnız "dolu" görür. Geçmiş talebin kişisel alanları 90 gün sonra silinir.
--
-- `start`: Türkiye yerel saati, "2026-11-06T19:00". Türkiye'de yaz saati yok.
-- Plan: Bilal'in kendi doldurduğu saat (kind='plan', status='onayli').
CREATE TABLE IF NOT EXISTS takvim_kayit (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  start      TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('talep', 'plan')),
  status     TEXT NOT NULL CHECK (status IN ('bekliyor', 'onayli', 'reddedildi', 'iptal')),
  title      TEXT NOT NULL DEFAULT '',
  name       TEXT NOT NULL DEFAULT '',
  phone      TEXT NOT NULL DEFAULT '',
  topic      TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  tz         TEXT NOT NULL DEFAULT '',   -- öğrencinin saat dilimi, örn. Europe/Berlin
  created_at TEXT NOT NULL,
  decided_at TEXT
);

-- Aynı saate iki kişi aynı anda bassa bile yalnız biri alır.
CREATE UNIQUE INDEX IF NOT EXISTS idx_takvim_tek_saat
  ON takvim_kayit (start) WHERE status IN ('bekliyor', 'onayli');

CREATE INDEX IF NOT EXISTS idx_takvim_start ON takvim_kayit (start);

-- Haftalık müsaitlik gibi tek satırlık ayarlar (JSON).
CREATE TABLE IF NOT EXISTS takvim_ayar (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
