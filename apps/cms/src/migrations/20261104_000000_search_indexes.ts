import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Indexes for 170k+ stories that Payload doesn't create on its own:
 *  - trigram indexes so `like` search on title/excerpt (ILIKE '%…%') doesn't scan
 *    every row — Thai has no spaces, so word-based full-text search doesn't fit;
 *  - list queries: newest published first, per category / tag;
 *  - the admin list (reads the latest version of each story).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX IF NOT EXISTS posts_title_trgm_idx ON posts USING gin (title gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS posts_excerpt_trgm_idx ON posts USING gin (excerpt gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS posts_status_published_idx ON posts (_status, published_at DESC);
    CREATE INDEX IF NOT EXISTS posts_rels_categories_parent_idx ON posts_rels (categories_id, parent_id) WHERE path = 'categories';
    CREATE INDEX IF NOT EXISTS posts_rels_tags_parent_idx ON posts_rels (tags_id, parent_id) WHERE path = 'tags';
    CREATE INDEX IF NOT EXISTS _posts_v_latest_published_idx ON _posts_v (version_published_at DESC) WHERE latest;
    CREATE INDEX IF NOT EXISTS _posts_v_title_trgm_idx ON _posts_v USING gin (version_title gin_trgm_ops) WHERE latest;
    CREATE INDEX IF NOT EXISTS tags_name_trgm_idx ON tags USING gin (name gin_trgm_ops);
    CREATE INDEX IF NOT EXISTS media_filename_trgm_idx ON media USING gin (filename gin_trgm_ops);
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS posts_title_trgm_idx;
    DROP INDEX IF EXISTS posts_excerpt_trgm_idx;
    DROP INDEX IF EXISTS posts_status_published_idx;
    DROP INDEX IF EXISTS posts_rels_categories_parent_idx;
    DROP INDEX IF EXISTS posts_rels_tags_parent_idx;
    DROP INDEX IF EXISTS _posts_v_latest_published_idx;
    DROP INDEX IF EXISTS _posts_v_title_trgm_idx;
    DROP INDEX IF EXISTS tags_name_trgm_idx;
    DROP INDEX IF EXISTS media_filename_trgm_idx;
  `)
}
