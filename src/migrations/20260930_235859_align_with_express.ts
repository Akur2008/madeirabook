import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'owner');
  CREATE TABLE "webhook_events" (
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" varchar NOT NULL,
  	"processed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "commission_history" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"property_id" integer NOT NULL,
  	"old_percent" numeric,
  	"new_percent" numeric,
  	"changed_by" varchar NOT NULL,
  	"changed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subscribers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"source" varchar DEFAULT 'website',
  	"telegram_id" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "bookings" RENAME COLUMN "check_in" TO "arrival_date";
  ALTER TABLE "bookings" RENAME COLUMN "check_out" TO "departure_date";
  ALTER TABLE "bookings" RENAME COLUMN "total_price" TO "amount_cents";
  ALTER TABLE "properties" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "properties" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "properties" ALTER COLUMN "price_per_night" DROP NOT NULL;
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'owner' NOT NULL;
  ALTER TABLE "users" ADD COLUMN "stripe_account_id" varchar;
  ALTER TABLE "users" ADD COLUMN "stripe_customer_id" varchar;
  ALTER TABLE "users" ADD COLUMN "rnal" varchar;
  ALTER TABLE "users" ADD COLUMN "onboarding_token" varchar;
  ALTER TABLE "users" ADD COLUMN "telegram_id" numeric;
  ALTER TABLE "users" ADD COLUMN "stripe_subscription_id" varchar;
  ALTER TABLE "users" ADD COLUMN "subscription_status" varchar;
  ALTER TABLE "users" ADD COLUMN "current_period_end" timestamp(3) with time zone;
  ALTER TABLE "properties" ADD COLUMN "smoobu_id" varchar;
  ALTER TABLE "properties" ADD COLUMN "owner_id" integer;
  ALTER TABLE "properties" ADD COLUMN "commission_percent" numeric DEFAULT 12;
  ALTER TABLE "properties" ADD COLUMN "charges_enabled" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "webhook_events_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "commission_history_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subscribers_id" integer;
  ALTER TABLE "commission_history" ADD CONSTRAINT "commission_history_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;
  CREATE INDEX "webhook_events_updated_at_idx" ON "webhook_events" USING btree ("updated_at");
  CREATE INDEX "webhook_events_created_at_idx" ON "webhook_events" USING btree ("created_at");
  CREATE INDEX "commission_history_property_idx" ON "commission_history" USING btree ("property_id");
  CREATE INDEX "commission_history_updated_at_idx" ON "commission_history" USING btree ("updated_at");
  CREATE INDEX "commission_history_created_at_idx" ON "commission_history" USING btree ("created_at");
  CREATE UNIQUE INDEX "subscribers_email_idx" ON "subscribers" USING btree ("email");
  CREATE INDEX "subscribers_telegram_id_idx" ON "subscribers" USING btree ("telegram_id");
  CREATE INDEX "subscribers_updated_at_idx" ON "subscribers" USING btree ("updated_at");
  CREATE INDEX "subscribers_created_at_idx" ON "subscribers" USING btree ("created_at");
  ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_webhook_events_fk" FOREIGN KEY ("webhook_events_id") REFERENCES "public"."webhook_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_commission_history_fk" FOREIGN KEY ("commission_history_id") REFERENCES "public"."commission_history"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subscribers_fk" FOREIGN KEY ("subscribers_id") REFERENCES "public"."subscribers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "users_stripe_account_id_idx" ON "users" USING btree ("stripe_account_id");
  CREATE UNIQUE INDEX "users_onboarding_token_idx" ON "users" USING btree ("onboarding_token");
  CREATE UNIQUE INDEX "users_telegram_id_idx" ON "users" USING btree ("telegram_id");
  CREATE UNIQUE INDEX "users_stripe_subscription_id_idx" ON "users" USING btree ("stripe_subscription_id");
  CREATE UNIQUE INDEX "properties_smoobu_id_idx" ON "properties" USING btree ("smoobu_id");
  CREATE INDEX "properties_owner_idx" ON "properties" USING btree ("owner_id");
  CREATE INDEX "payload_locked_documents_rels_webhook_events_id_idx" ON "payload_locked_documents_rels" USING btree ("webhook_events_id");
  CREATE INDEX "payload_locked_documents_rels_commission_history_id_idx" ON "payload_locked_documents_rels" USING btree ("commission_history_id");
  CREATE INDEX "payload_locked_documents_rels_subscribers_id_idx" ON "payload_locked_documents_rels" USING btree ("subscribers_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "webhook_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "commission_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subscribers" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "webhook_events" CASCADE;
  DROP TABLE "commission_history" CASCADE;
  DROP TABLE "subscribers" CASCADE;
  ALTER TABLE "bookings" RENAME COLUMN "arrival_date" TO "check_in";
  ALTER TABLE "bookings" RENAME COLUMN "departure_date" TO "check_out";
  ALTER TABLE "bookings" RENAME COLUMN "amount_cents" TO "total_price";
  ALTER TABLE "properties" DROP CONSTRAINT "properties_owner_id_users_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_webhook_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_commission_history_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subscribers_fk";
  
  DROP INDEX "users_stripe_account_id_idx";
  DROP INDEX "users_onboarding_token_idx";
  DROP INDEX "users_telegram_id_idx";
  DROP INDEX "users_stripe_subscription_id_idx";
  DROP INDEX "properties_smoobu_id_idx";
  DROP INDEX "properties_owner_idx";
  DROP INDEX "payload_locked_documents_rels_webhook_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_commission_history_id_idx";
  DROP INDEX "payload_locked_documents_rels_subscribers_id_idx";
  ALTER TABLE "properties" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "properties" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "properties" ALTER COLUMN "price_per_night" SET NOT NULL;
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "users" DROP COLUMN "stripe_account_id";
  ALTER TABLE "users" DROP COLUMN "stripe_customer_id";
  ALTER TABLE "users" DROP COLUMN "rnal";
  ALTER TABLE "users" DROP COLUMN "onboarding_token";
  ALTER TABLE "users" DROP COLUMN "telegram_id";
  ALTER TABLE "users" DROP COLUMN "stripe_subscription_id";
  ALTER TABLE "users" DROP COLUMN "subscription_status";
  ALTER TABLE "users" DROP COLUMN "current_period_end";
  ALTER TABLE "properties" DROP COLUMN "smoobu_id";
  ALTER TABLE "properties" DROP COLUMN "owner_id";
  ALTER TABLE "properties" DROP COLUMN "commission_percent";
  ALTER TABLE "properties" DROP COLUMN "charges_enabled";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "webhook_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "commission_history_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "subscribers_id";
  DROP TYPE "public"."enum_users_role";`)
}
