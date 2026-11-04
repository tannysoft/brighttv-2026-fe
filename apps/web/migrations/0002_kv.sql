-- Last good copies of outside data (e.g. the lottery result), served when the
-- source is down.
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
