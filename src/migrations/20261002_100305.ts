import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "flight_routes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"route_slug" varchar NOT NULL,
  	"title" varchar NOT NULL,
  	"origin_city" varchar NOT NULL,
  	"origin_iata" varchar NOT NULL,
  	"destination_iata" varchar DEFAULT 'FNC' NOT NULL,
  	"min_price" numeric NOT NULL,
  	"currency" varchar DEFAULT '€',
  	"affiliate_link" varchar,
  	"is_indexable" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "flight_routes_id" integer;
  CREATE UNIQUE INDEX "flight_routes_route_slug_idx" ON "flight_routes" USING btree ("route_slug");
  CREATE INDEX "flight_routes_updated_at_idx" ON "flight_routes" USING btree ("updated_at");
  CREATE INDEX "flight_routes_created_at_idx" ON "flight_routes" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_flight_routes_fk" FOREIGN KEY ("flight_routes_id") REFERENCES "public"."flight_routes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_flight_routes_id_idx" ON "payload_locked_documents_rels" USING btree ("flight_routes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "flight_routes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "flight_routes" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_flight_routes_fk";
  
  DROP INDEX "payload_locked_documents_rels_flight_routes_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "flight_routes_id";`)
}
