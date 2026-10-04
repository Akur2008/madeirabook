import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_guides_target_intent" AS ENUM('where_to_stay', 'comparison', 'guide', 'faq', 'area');
  CREATE TYPE "public"."enum_guides_schema_type" AS ENUM('TouristDestination', 'FAQPage', 'Article');
  CREATE TYPE "public"."enum_guides_status" AS ENUM('draft', 'published');
  CREATE TABLE "guides_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "guides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"ai_summary" varchar NOT NULL,
  	"target_intent" "enum_guides_target_intent" DEFAULT 'guide' NOT NULL,
  	"content" varchar,
  	"schema_type" "enum_guides_schema_type" DEFAULT 'Article',
  	"status" "enum_guides_status" DEFAULT 'draft' NOT NULL,
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "guides_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"properties_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "guides_id" integer;
  ALTER TABLE "guides_faqs" ADD CONSTRAINT "guides_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "guides_rels" ADD CONSTRAINT "guides_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "guides_rels" ADD CONSTRAINT "guides_rels_properties_fk" FOREIGN KEY ("properties_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "guides_faqs_order_idx" ON "guides_faqs" USING btree ("_order");
  CREATE INDEX "guides_faqs_parent_id_idx" ON "guides_faqs" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "guides_slug_idx" ON "guides" USING btree ("slug");
  CREATE INDEX "guides_updated_at_idx" ON "guides" USING btree ("updated_at");
  CREATE INDEX "guides_created_at_idx" ON "guides" USING btree ("created_at");
  CREATE INDEX "guides_rels_order_idx" ON "guides_rels" USING btree ("order");
  CREATE INDEX "guides_rels_parent_idx" ON "guides_rels" USING btree ("parent_id");
  CREATE INDEX "guides_rels_path_idx" ON "guides_rels" USING btree ("path");
  CREATE INDEX "guides_rels_properties_id_idx" ON "guides_rels" USING btree ("properties_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_guides_fk" FOREIGN KEY ("guides_id") REFERENCES "public"."guides"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_guides_id_idx" ON "payload_locked_documents_rels" USING btree ("guides_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "guides_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "guides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "guides_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "guides_faqs" CASCADE;
  DROP TABLE "guides" CASCADE;
  DROP TABLE "guides_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_guides_fk";
  
  DROP INDEX "payload_locked_documents_rels_guides_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "guides_id";
  DROP TYPE "public"."enum_guides_target_intent";
  DROP TYPE "public"."enum_guides_schema_type";
  DROP TYPE "public"."enum_guides_status";`)
}
