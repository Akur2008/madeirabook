import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "login_token" varchar;
  ALTER TABLE "users" ADD COLUMN "login_token_expires_at" timestamp(3) with time zone;
  CREATE UNIQUE INDEX "users_login_token_idx" ON "users" USING btree ("login_token");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "users_login_token_idx";
  ALTER TABLE "users" DROP COLUMN "login_token";
  ALTER TABLE "users" DROP COLUMN "login_token_expires_at";`)
}
