import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" ADD COLUMN "wp_fields" jsonb;
  ALTER TABLE "_posts_v" ADD COLUMN "version_wp_fields" jsonb;
  ALTER TABLE "programs" ADD COLUMN "wp_fields" jsonb;
  ALTER TABLE "_programs_v" ADD COLUMN "version_wp_fields" jsonb;
  ALTER TABLE "lotteries" ADD COLUMN "wp_fields" jsonb;
  ALTER TABLE "_lotteries_v" ADD COLUMN "version_wp_fields" jsonb;
  ALTER TABLE "pages" ADD COLUMN "wp_fields" jsonb;
  ALTER TABLE "_pages_v" ADD COLUMN "version_wp_fields" jsonb;
  ALTER TABLE "categories" ADD COLUMN "wp_fields" jsonb;
  ALTER TABLE "users" ADD COLUMN "wp_fields" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "posts" DROP COLUMN "wp_fields";
  ALTER TABLE "_posts_v" DROP COLUMN "version_wp_fields";
  ALTER TABLE "programs" DROP COLUMN "wp_fields";
  ALTER TABLE "_programs_v" DROP COLUMN "version_wp_fields";
  ALTER TABLE "lotteries" DROP COLUMN "wp_fields";
  ALTER TABLE "_lotteries_v" DROP COLUMN "version_wp_fields";
  ALTER TABLE "pages" DROP COLUMN "wp_fields";
  ALTER TABLE "_pages_v" DROP COLUMN "version_wp_fields";
  ALTER TABLE "categories" DROP COLUMN "wp_fields";
  ALTER TABLE "users" DROP COLUMN "wp_fields";`)
}
