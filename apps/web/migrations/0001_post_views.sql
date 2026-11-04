-- D1 `brighttv-web-views` (binding VIEWS_DB): hourly page views per story.
-- Apply: npx wrangler d1 migrations apply brighttv-web-views --remote
CREATE TABLE IF NOT EXISTS post_views (
  post_id INTEGER NOT NULL,
  hour INTEGER NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, hour)
);
CREATE INDEX IF NOT EXISTS post_views_hour ON post_views (hour);
