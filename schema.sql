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
