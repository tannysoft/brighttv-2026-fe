-- One row per draw. `data` = normalized JSON (see src/glo.ts LottoDraw).
CREATE TABLE IF NOT EXISTS lotto_draws (
  date TEXT PRIMARY KEY,            -- YYYY-MM-DD (Gregorian)
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL       -- ms since epoch
);
