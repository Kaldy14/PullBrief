CREATE TABLE "github_install_states" (
	"id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"return_path" text DEFAULT '/settings/github' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"github_installation_id" text,
	"setup_action" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_report_writebacks" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"report_id" text NOT NULL,
	"repository_id" text,
	"pull_request_id" text,
	"kind" text NOT NULL,
	"github_database_id" text,
	"github_node_id" text,
	"github_html_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"body_hash" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"github_delivery_id" text NOT NULL,
	"event" text NOT NULL,
	"action" text,
	"github_installation_id" text,
	"github_repository_id" text,
	"tenant_id" text,
	"status" text NOT NULL,
	"error_message" text,
	"payload_json" jsonb,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"repository_id" text,
	"pull_request_id" text,
	"report_id" text,
	"requested_by_user_id" text,
	"github_delivery_id" text,
	"owner" text NOT NULL,
	"repo" text NOT NULL,
	"number" integer NOT NULL,
	"head_sha" text,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "github_app_id" text;--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "target_type" text;--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "permissions_json" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "events_json" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_installations" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "github_node_id" text;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "html_url" text;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "fork" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "repositories" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "github_install_states" ADD CONSTRAINT "github_install_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_install_states" ADD CONSTRAINT "github_install_states_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_report_writebacks" ADD CONSTRAINT "github_report_writebacks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_report_writebacks" ADD CONSTRAINT "github_report_writebacks_report_id_pr_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."pr_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_report_writebacks" ADD CONSTRAINT "github_report_writebacks_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_report_writebacks" ADD CONSTRAINT "github_report_writebacks_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_webhook_deliveries" ADD CONSTRAINT "github_webhook_deliveries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD CONSTRAINT "review_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD CONSTRAINT "review_jobs_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD CONSTRAINT "review_jobs_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD CONSTRAINT "review_jobs_report_id_pr_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."pr_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD CONSTRAINT "review_jobs_requested_by_user_id_user_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "github_install_states_state_uidx" ON "github_install_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "github_install_states_tenant_id_idx" ON "github_install_states" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "github_install_states_user_id_idx" ON "github_install_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "github_report_writebacks_tenant_id_idx" ON "github_report_writebacks" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "github_report_writebacks_report_id_idx" ON "github_report_writebacks" USING btree ("report_id");--> statement-breakpoint
CREATE UNIQUE INDEX "github_report_writebacks_report_kind_uidx" ON "github_report_writebacks" USING btree ("report_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "github_webhook_deliveries_delivery_uidx" ON "github_webhook_deliveries" USING btree ("github_delivery_id");--> statement-breakpoint
CREATE INDEX "github_webhook_deliveries_installation_idx" ON "github_webhook_deliveries" USING btree ("github_installation_id");--> statement-breakpoint
CREATE INDEX "github_webhook_deliveries_tenant_idx" ON "github_webhook_deliveries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "review_jobs_tenant_id_idx" ON "review_jobs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "review_jobs_repository_id_idx" ON "review_jobs" USING btree ("repository_id");--> statement-breakpoint
CREATE INDEX "review_jobs_pull_request_id_idx" ON "review_jobs" USING btree ("pull_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_jobs_dedupe_uidx" ON "review_jobs" USING btree ("tenant_id","owner","repo","number","head_sha","trigger");