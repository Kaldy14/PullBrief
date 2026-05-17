ALTER TABLE "review_jobs" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD COLUMN "max_attempts" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD COLUMN "run_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD COLUMN "locked_by" text;--> statement-breakpoint
ALTER TABLE "review_jobs" ADD COLUMN "last_heartbeat_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "review_jobs_queue_idx" ON "review_jobs" USING btree ("status","run_at","priority");--> statement-breakpoint
CREATE INDEX "review_jobs_locked_idx" ON "review_jobs" USING btree ("status","locked_at");