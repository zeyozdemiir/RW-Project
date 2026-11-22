CREATE TYPE "public"."alert_resolution" AS ENUM('linked', 'created', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('unregistered_portfolio');--> statement-breakpoint
CREATE TYPE "public"."deal_status" AS ENUM('active', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."deal_type" AS ENUM('rent', 'sale');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('rent', 'sale');--> statement-breakpoint
CREATE TYPE "public"."portfolio_status" AS ENUM('available', 'deposit', 'rented', 'sold', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('platform_admin', 'manager', 'leader', 'agent');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'active', 'disabled', 'rejected');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"office_id" uuid NOT NULL,
	"actor_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"type" "alert_type" NOT NULL,
	"deal_id" uuid NOT NULL,
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"resolution" "alert_resolution",
	"resolution_note" text,
	"resolved_by_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"ref_no" integer NOT NULL,
	"type" "deal_type" NOT NULL,
	"status" "deal_status" DEFAULT 'active' NOT NULL,
	"portfolio_id" uuid,
	"city" text,
	"district" text NOT NULL,
	"neighborhood" text,
	"complex_name" text NOT NULL,
	"block" text,
	"unit_no" text NOT NULL,
	"match_key" text NOT NULL,
	"contract_date" date NOT NULL,
	"price" bigint NOT NULL,
	"commission" bigint NOT NULL,
	"closing_agent_id" uuid NOT NULL,
	"closing_team_id" uuid,
	"listing_agent_id" uuid,
	"listing_team_id" uuid,
	"listing_share_pct" integer DEFAULT 0 NOT NULL,
	"closing_agent_revenue" bigint NOT NULL,
	"listing_agent_revenue" bigint DEFAULT 0 NOT NULL,
	"closing_agent_rate_pct" integer NOT NULL,
	"listing_agent_rate_pct" integer DEFAULT 0 NOT NULL,
	"closing_agent_earning" bigint NOT NULL,
	"listing_agent_earning" bigint DEFAULT 0 NOT NULL,
	"office_earning" bigint NOT NULL,
	"customer_name" text,
	"notes" text,
	"was_unregistered" boolean DEFAULT false NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancelled_by_id" uuid,
	"cancel_reason" text,
	CONSTRAINT "deals_office_id_id_uq" UNIQUE("office_id","id"),
	CONSTRAINT "deals_office_ref_uq" UNIQUE("office_id","ref_no")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_domains" (
	"domain" text PRIMARY KEY NOT NULL,
	"office_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"agent_rate_pct" integer DEFAULT 50 NOT NULL,
	"listing_share_pct" integer DEFAULT 50 NOT NULL,
	"portfolio_seq" integer DEFAULT 0 NOT NULL,
	"deal_seq" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"ref_no" integer NOT NULL,
	"agent_id" uuid NOT NULL,
	"listing_type" "listing_type" NOT NULL,
	"status" "portfolio_status" DEFAULT 'available' NOT NULL,
	"property_type" text DEFAULT 'daire' NOT NULL,
	"title" text NOT NULL,
	"city" text NOT NULL,
	"district" text NOT NULL,
	"neighborhood" text,
	"complex_name" text NOT NULL,
	"block" text,
	"floor" text,
	"unit_no" text NOT NULL,
	"rooms" text,
	"gross_m2" integer,
	"net_m2" integer,
	"building_age" integer,
	"furnished" boolean DEFAULT false NOT NULL,
	"price" bigint NOT NULL,
	"owner_name" text,
	"owner_phone" text,
	"listing_url" text,
	"notes" text,
	"match_key" text NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status_changed_by_id" uuid,
	"status_note" text,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolios_office_id_id_uq" UNIQUE("office_id","id"),
	CONSTRAINT "portfolios_office_ref_uq" UNIQUE("office_id","ref_no")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_office_id_id_uq" UNIQUE("office_id","id"),
	CONSTRAINT "teams_office_name_uq" UNIQUE("office_id","name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"office_id" uuid,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'agent' NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"team_id" uuid,
	"agent_rate_pct" integer,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"approved_by_id" uuid,
	"approved_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_office_id_id_uq" UNIQUE("office_id","id")
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_deal_fk" FOREIGN KEY ("office_id","deal_id") REFERENCES "public"."deals"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_portfolio_fk" FOREIGN KEY ("office_id","portfolio_id") REFERENCES "public"."portfolios"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_closing_agent_fk" FOREIGN KEY ("office_id","closing_agent_id") REFERENCES "public"."users"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_listing_agent_fk" FOREIGN KEY ("office_id","listing_agent_id") REFERENCES "public"."users"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "office_domains" ADD CONSTRAINT "office_domains_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_agent_fk" FOREIGN KEY ("office_id","agent_id") REFERENCES "public"."users"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_office_id_offices_id_fk" FOREIGN KEY ("office_id") REFERENCES "public"."offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_team_fk" FOREIGN KEY ("office_id","team_id") REFERENCES "public"."teams"("office_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_entity_idx" ON "activity_log" USING btree ("office_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "alerts_office_status_idx" ON "alerts" USING btree ("office_id","status");--> statement-breakpoint
CREATE INDEX "deals_office_date_idx" ON "deals" USING btree ("office_id","contract_date");--> statement-breakpoint
CREATE INDEX "deals_office_portfolio_idx" ON "deals" USING btree ("office_id","portfolio_id");--> statement-breakpoint
CREATE INDEX "login_attempts_email_idx" ON "login_attempts" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "office_domains_office_idx" ON "office_domains" USING btree ("office_id");--> statement-breakpoint
CREATE INDEX "portfolios_office_type_status_idx" ON "portfolios" USING btree ("office_id","listing_type","status");--> statement-breakpoint
CREATE INDEX "portfolios_office_match_idx" ON "portfolios" USING btree ("office_id","match_key");--> statement-breakpoint
CREATE INDEX "portfolios_office_agent_idx" ON "portfolios" USING btree ("office_id","agent_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "users_office_status_idx" ON "users" USING btree ("office_id","status");