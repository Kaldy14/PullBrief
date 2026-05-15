ALTER TABLE "github_install_states" ADD COLUMN "oauth_state" text;--> statement-breakpoint
ALTER TABLE "github_install_states" ADD COLUMN "oauth_verified_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "github_install_states_oauth_state_uidx" ON "github_install_states" USING btree ("oauth_state");