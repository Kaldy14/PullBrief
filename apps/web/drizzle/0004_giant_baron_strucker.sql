CREATE TABLE "review_draft_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"draft_id" text NOT NULL,
	"path" text NOT NULL,
	"side" text DEFAULT 'RIGHT' NOT NULL,
	"line" integer,
	"start_line" integer,
	"start_side" text,
	"body" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"github_comment_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"report_id" text NOT NULL,
	"repository_id" text,
	"pull_request_id" text,
	"user_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"review_event" text DEFAULT 'COMMENT' NOT NULL,
	"body" text NOT NULL,
	"github_review_id" text,
	"github_node_id" text,
	"github_html_url" text,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_draft_comments" ADD CONSTRAINT "review_draft_comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_draft_comments" ADD CONSTRAINT "review_draft_comments_draft_id_review_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."review_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_drafts" ADD CONSTRAINT "review_drafts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_drafts" ADD CONSTRAINT "review_drafts_report_id_pr_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."pr_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_drafts" ADD CONSTRAINT "review_drafts_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_drafts" ADD CONSTRAINT "review_drafts_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_drafts" ADD CONSTRAINT "review_drafts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_draft_comments_tenant_id_idx" ON "review_draft_comments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "review_draft_comments_draft_id_idx" ON "review_draft_comments" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "review_drafts_tenant_id_idx" ON "review_drafts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "review_drafts_report_id_idx" ON "review_drafts" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "review_drafts_user_id_idx" ON "review_drafts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_drafts_report_user_uidx" ON "review_drafts" USING btree ("report_id","user_id");