import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "house_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "properties_amenities_list" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "properties_house_rules" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "properties_amenities_list" CASCADE;
  DROP TABLE "properties_house_rules" CASCADE;
  ALTER TABLE "properties_rels" ADD COLUMN "house_rules_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "house_rules_id" integer;
  CREATE UNIQUE INDEX "house_rules_name_idx" ON "house_rules" USING btree ("name");
  CREATE INDEX "house_rules_updated_at_idx" ON "house_rules" USING btree ("updated_at");
  CREATE INDEX "house_rules_created_at_idx" ON "house_rules" USING btree ("created_at");
  ALTER TABLE "properties_rels" ADD CONSTRAINT "properties_rels_house_rules_fk" FOREIGN KEY ("house_rules_id") REFERENCES "public"."house_rules"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_house_rules_fk" FOREIGN KEY ("house_rules_id") REFERENCES "public"."house_rules"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "properties_rels_house_rules_id_idx" ON "properties_rels" USING btree ("house_rules_id");
  CREATE INDEX "payload_locked_documents_rels_house_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("house_rules_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "properties_amenities_list" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL
  );
  
  CREATE TABLE "properties_house_rules" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  ALTER TABLE "house_rules" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "house_rules" CASCADE;
  ALTER TABLE "properties_rels" DROP CONSTRAINT "properties_rels_house_rules_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_house_rules_fk";
  
  DROP INDEX "properties_rels_house_rules_id_idx";
  DROP INDEX "payload_locked_documents_rels_house_rules_id_idx";
  ALTER TABLE "properties_amenities_list" ADD CONSTRAINT "properties_amenities_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_house_rules" ADD CONSTRAINT "properties_house_rules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "properties_amenities_list_order_idx" ON "properties_amenities_list" USING btree ("_order");
  CREATE INDEX "properties_amenities_list_parent_id_idx" ON "properties_amenities_list" USING btree ("_parent_id");
  CREATE INDEX "properties_house_rules_order_idx" ON "properties_house_rules" USING btree ("_order");
  CREATE INDEX "properties_house_rules_parent_id_idx" ON "properties_house_rules" USING btree ("_parent_id");
  ALTER TABLE "properties_rels" DROP COLUMN "house_rules_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "house_rules_id";`)
}
