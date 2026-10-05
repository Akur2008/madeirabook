import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
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
  
  ALTER TABLE "properties" ADD COLUMN "short_description" varchar;
  ALTER TABLE "properties" ADD COLUMN "size_m2" numeric;
  ALTER TABLE "properties" ADD COLUMN "bedrooms" numeric DEFAULT 1;
  ALTER TABLE "properties" ADD COLUMN "bathrooms" numeric DEFAULT 1;
  ALTER TABLE "properties" ADD COLUMN "max_guests" numeric DEFAULT 2;
  ALTER TABLE "properties" ADD COLUMN "check_in_time" varchar DEFAULT '15:00';
  ALTER TABLE "properties" ADD COLUMN "check_out_time" varchar DEFAULT '11:00';
  ALTER TABLE "properties_amenities_list" ADD CONSTRAINT "properties_amenities_list_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "properties_house_rules" ADD CONSTRAINT "properties_house_rules_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "properties_amenities_list_order_idx" ON "properties_amenities_list" USING btree ("_order");
  CREATE INDEX "properties_amenities_list_parent_id_idx" ON "properties_amenities_list" USING btree ("_parent_id");
  CREATE INDEX "properties_house_rules_order_idx" ON "properties_house_rules" USING btree ("_order");
  CREATE INDEX "properties_house_rules_parent_id_idx" ON "properties_house_rules" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "properties_amenities_list" CASCADE;
  DROP TABLE "properties_house_rules" CASCADE;
  ALTER TABLE "properties" DROP COLUMN "short_description";
  ALTER TABLE "properties" DROP COLUMN "size_m2";
  ALTER TABLE "properties" DROP COLUMN "bedrooms";
  ALTER TABLE "properties" DROP COLUMN "bathrooms";
  ALTER TABLE "properties" DROP COLUMN "max_guests";
  ALTER TABLE "properties" DROP COLUMN "check_in_time";
  ALTER TABLE "properties" DROP COLUMN "check_out_time";`)
}
