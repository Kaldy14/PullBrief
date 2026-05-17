import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { PullBriefReport, PullRequestContext } from "@/lib/reports/types";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("account_user_id_idx").on(table.userId),
    uniqueIndex("account_provider_account_uidx").on(table.providerId, table.accountId),
  ],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  defaultRetentionDays: integer("default_retention_days").default(30).notNull(),
  ...timestamps,
});

export const tenantMembers = pgTable(
  "tenant_members",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["admin", "reviewer", "viewer"] }).default("reviewer").notNull(),
    ...timestamps,
  },
  (table) => [
    index("tenant_members_tenant_id_idx").on(table.tenantId),
    index("tenant_members_user_id_idx").on(table.userId),
    uniqueIndex("tenant_members_tenant_user_uidx").on(table.tenantId, table.userId),
  ],
);

export const githubInstallStates = pgTable(
  "github_install_states",
  {
    id: text("id").primaryKey(),
    state: text("state").notNull(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    returnPath: text("return_path").default("/settings/github").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    githubInstallationId: text("github_installation_id"),
    setupAction: text("setup_action"),
    oauthState: text("oauth_state"),
    oauthVerifiedAt: timestamp("oauth_verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("github_install_states_state_uidx").on(table.state),
    uniqueIndex("github_install_states_oauth_state_uidx").on(table.oauthState),
    index("github_install_states_tenant_id_idx").on(table.tenantId),
    index("github_install_states_user_id_idx").on(table.userId),
  ],
);

export const githubInstallations = pgTable(
  "github_installations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    githubInstallationId: text("github_installation_id").notNull(),
    githubAppId: text("github_app_id"),
    accountLogin: text("account_login").notNull(),
    accountType: text("account_type").notNull(),
    targetId: text("target_id"),
    targetType: text("target_type"),
    repositorySelection: text("repository_selection").default("selected").notNull(),
    permissionsJson: jsonb("permissions_json").$type<Record<string, unknown>>().default({}).notNull(),
    eventsJson: jsonb("events_json").$type<string[]>().default([]).notNull(),
    settingsJson: jsonb("settings_json").$type<Record<string, unknown>>().default({}).notNull(),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("github_installations_tenant_id_idx").on(table.tenantId),
    uniqueIndex("github_installations_installation_uidx").on(table.githubInstallationId),
  ],
);

export const repositories = pgTable(
  "repositories",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    installationId: text("installation_id").references(() => githubInstallations.id, { onDelete: "set null" }),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name"),
    githubRepositoryId: text("github_repository_id"),
    githubNodeId: text("github_node_id"),
    defaultBranch: text("default_branch"),
    htmlUrl: text("html_url"),
    private: boolean("private").default(false).notNull(),
    fork: boolean("fork").default(false).notNull(),
    archived: boolean("archived").default(false).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    settingsJson: jsonb("settings_json").$type<Record<string, unknown>>().default({}).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("repositories_tenant_id_idx").on(table.tenantId),
    index("repositories_installation_id_idx").on(table.installationId),
    uniqueIndex("repositories_tenant_owner_name_uidx").on(table.tenantId, table.owner, table.name),
  ],
);

export const pullRequests = pgTable(
  "pull_requests",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    authorLogin: text("author_login").notNull(),
    baseRef: text("base_ref").notNull(),
    headRef: text("head_ref").notNull(),
    headSha: text("head_sha").notNull(),
    state: text("state").notNull(),
    htmlUrl: text("html_url").notNull(),
    githubCreatedAt: timestamp("github_created_at", { withTimezone: true }),
    githubUpdatedAt: timestamp("github_updated_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("pull_requests_tenant_id_idx").on(table.tenantId),
    index("pull_requests_repository_id_idx").on(table.repositoryId),
    uniqueIndex("pull_requests_repository_number_uidx").on(table.repositoryId, table.number),
  ],
);

export const prReports = pgTable(
  "pr_reports",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    pullRequestId: text("pull_request_id")
      .notNull()
      .references(() => pullRequests.id, { onDelete: "cascade" }),
    headSha: text("head_sha").notNull(),
    status: text("status", { enum: ["ready", "failed"] }).notNull(),
    modelProvider: text("model_provider"),
    modelName: text("model_name"),
    contextJson: jsonb("context_json").$type<PullRequestContext>().notNull(),
    reportJson: jsonb("report_json").$type<PullBriefReport>(),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [
    index("pr_reports_tenant_id_idx").on(table.tenantId),
    index("pr_reports_pull_request_id_idx").on(table.pullRequestId),
    uniqueIndex("pr_reports_pull_request_head_uidx").on(table.pullRequestId, table.headSha),
  ],
);

export const reviewJobs = pgTable(
  "review_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").references(() => repositories.id, { onDelete: "set null" }),
    pullRequestId: text("pull_request_id").references(() => pullRequests.id, { onDelete: "set null" }),
    reportId: text("report_id").references(() => prReports.id, { onDelete: "set null" }),
    requestedByUserId: text("requested_by_user_id").references(() => user.id, { onDelete: "set null" }),
    githubDeliveryId: text("github_delivery_id"),
    owner: text("owner").notNull(),
    repo: text("repo").notNull(),
    number: integer("number").notNull(),
    headSha: text("head_sha"),
    trigger: text("trigger", { enum: ["manual", "webhook", "rerun", "comment"] }).default("manual").notNull(),
    status: text("status", { enum: ["queued", "running", "ready", "failed", "cancelled"] }).default("queued").notNull(),
    priority: integer("priority").default(0).notNull(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("review_jobs_tenant_id_idx").on(table.tenantId),
    index("review_jobs_repository_id_idx").on(table.repositoryId),
    index("review_jobs_pull_request_id_idx").on(table.pullRequestId),
    index("review_jobs_queue_idx").on(table.status, table.runAt, table.priority),
    index("review_jobs_locked_idx").on(table.status, table.lockedAt),
    uniqueIndex("review_jobs_dedupe_uidx").on(table.tenantId, table.owner, table.repo, table.number, table.headSha, table.trigger),
  ],
);

export const githubReportWritebacks = pgTable(
  "github_report_writebacks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reportId: text("report_id")
      .notNull()
      .references(() => prReports.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").references(() => repositories.id, { onDelete: "set null" }),
    pullRequestId: text("pull_request_id").references(() => pullRequests.id, { onDelete: "set null" }),
    kind: text("kind", { enum: ["check_run", "sticky_comment", "pull_request_review"] }).notNull(),
    githubDatabaseId: text("github_database_id"),
    githubNodeId: text("github_node_id"),
    githubHtmlUrl: text("github_html_url"),
    status: text("status", { enum: ["pending", "published", "failed"] }).default("pending").notNull(),
    bodyHash: text("body_hash"),
    errorMessage: text("error_message"),
    ...timestamps,
  },
  (table) => [
    index("github_report_writebacks_tenant_id_idx").on(table.tenantId),
    index("github_report_writebacks_report_id_idx").on(table.reportId),
    uniqueIndex("github_report_writebacks_report_kind_uidx").on(table.reportId, table.kind),
  ],
);

export const reviewDrafts = pgTable(
  "review_drafts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    reportId: text("report_id")
      .notNull()
      .references(() => prReports.id, { onDelete: "cascade" }),
    repositoryId: text("repository_id").references(() => repositories.id, { onDelete: "set null" }),
    pullRequestId: text("pull_request_id").references(() => pullRequests.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    status: text("status", { enum: ["draft", "submitted", "abandoned"] }).default("draft").notNull(),
    reviewEvent: text("review_event", { enum: ["COMMENT", "REQUEST_CHANGES", "APPROVE"] }).default("COMMENT").notNull(),
    body: text("body").notNull(),
    githubReviewId: text("github_review_id"),
    githubNodeId: text("github_node_id"),
    githubHtmlUrl: text("github_html_url"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("review_drafts_tenant_id_idx").on(table.tenantId),
    index("review_drafts_report_id_idx").on(table.reportId),
    index("review_drafts_user_id_idx").on(table.userId),
    uniqueIndex("review_drafts_report_user_uidx").on(table.reportId, table.userId),
  ],
);

export const reviewDraftComments = pgTable(
  "review_draft_comments",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    draftId: text("draft_id")
      .notNull()
      .references(() => reviewDrafts.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    side: text("side", { enum: ["LEFT", "RIGHT"] }).default("RIGHT").notNull(),
    line: integer("line"),
    startLine: integer("start_line"),
    startSide: text("start_side", { enum: ["LEFT", "RIGHT"] }),
    body: text("body").notNull(),
    source: text("source", { enum: ["manual", "ai_suggested"] }).default("manual").notNull(),
    status: text("status", { enum: ["draft", "published", "deleted"] }).default("draft").notNull(),
    githubCommentId: text("github_comment_id"),
    ...timestamps,
  },
  (table) => [
    index("review_draft_comments_tenant_id_idx").on(table.tenantId),
    index("review_draft_comments_draft_id_idx").on(table.draftId),
  ],
);

export const githubWebhookDeliveries = pgTable(
  "github_webhook_deliveries",
  {
    id: text("id").primaryKey(),
    githubDeliveryId: text("github_delivery_id").notNull(),
    event: text("event").notNull(),
    action: text("action"),
    githubInstallationId: text("github_installation_id"),
    githubRepositoryId: text("github_repository_id"),
    tenantId: text("tenant_id").references(() => tenants.id, { onDelete: "set null" }),
    status: text("status", { enum: ["accepted", "ignored", "failed"] }).notNull(),
    errorMessage: text("error_message"),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("github_webhook_deliveries_delivery_uidx").on(table.githubDeliveryId),
    index("github_webhook_deliveries_installation_idx").on(table.githubInstallationId),
    index("github_webhook_deliveries_tenant_idx").on(table.tenantId),
  ],
);

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  tenantMemberships: many(tenantMembers),
  githubInstallStates: many(githubInstallStates),
  requestedReviewJobs: many(reviewJobs),
}));

export const tenantRelations = relations(tenants, ({ many }) => ({
  members: many(tenantMembers),
  githubInstallStates: many(githubInstallStates),
  installations: many(githubInstallations),
  repositories: many(repositories),
  pullRequests: many(pullRequests),
  reports: many(prReports),
  reviewJobs: many(reviewJobs),
  githubReportWritebacks: many(githubReportWritebacks),
  githubWebhookDeliveries: many(githubWebhookDeliveries),
}));

export const tenantMemberRelations = relations(tenantMembers, ({ one }) => ({
  tenant: one(tenants, { fields: [tenantMembers.tenantId], references: [tenants.id] }),
  user: one(user, { fields: [tenantMembers.userId], references: [user.id] }),
}));

export const githubInstallStateRelations = relations(githubInstallStates, ({ one }) => ({
  tenant: one(tenants, { fields: [githubInstallStates.tenantId], references: [tenants.id] }),
  user: one(user, { fields: [githubInstallStates.userId], references: [user.id] }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));

export const githubInstallationRelations = relations(githubInstallations, ({ one, many }) => ({
  tenant: one(tenants, { fields: [githubInstallations.tenantId], references: [tenants.id] }),
  repositories: many(repositories),
}));

export const repositoryRelations = relations(repositories, ({ one, many }) => ({
  tenant: one(tenants, { fields: [repositories.tenantId], references: [tenants.id] }),
  installation: one(githubInstallations, {
    fields: [repositories.installationId],
    references: [githubInstallations.id],
  }),
  pullRequests: many(pullRequests),
}));

export const pullRequestRelations = relations(pullRequests, ({ one, many }) => ({
  tenant: one(tenants, { fields: [pullRequests.tenantId], references: [tenants.id] }),
  repository: one(repositories, { fields: [pullRequests.repositoryId], references: [repositories.id] }),
  reports: many(prReports),
}));

export const prReportRelations = relations(prReports, ({ one, many }) => ({
  tenant: one(tenants, { fields: [prReports.tenantId], references: [tenants.id] }),
  pullRequest: one(pullRequests, { fields: [prReports.pullRequestId], references: [pullRequests.id] }),
  writebacks: many(githubReportWritebacks),
}));

export const reviewJobRelations = relations(reviewJobs, ({ one }) => ({
  tenant: one(tenants, { fields: [reviewJobs.tenantId], references: [tenants.id] }),
  repository: one(repositories, { fields: [reviewJobs.repositoryId], references: [repositories.id] }),
  pullRequest: one(pullRequests, { fields: [reviewJobs.pullRequestId], references: [pullRequests.id] }),
  report: one(prReports, { fields: [reviewJobs.reportId], references: [prReports.id] }),
  requestedByUser: one(user, { fields: [reviewJobs.requestedByUserId], references: [user.id] }),
}));

export const githubReportWritebackRelations = relations(githubReportWritebacks, ({ one }) => ({
  tenant: one(tenants, { fields: [githubReportWritebacks.tenantId], references: [tenants.id] }),
  report: one(prReports, { fields: [githubReportWritebacks.reportId], references: [prReports.id] }),
  repository: one(repositories, { fields: [githubReportWritebacks.repositoryId], references: [repositories.id] }),
  pullRequest: one(pullRequests, { fields: [githubReportWritebacks.pullRequestId], references: [pullRequests.id] }),
}));

export const githubWebhookDeliveryRelations = relations(githubWebhookDeliveries, ({ one }) => ({
  tenant: one(tenants, { fields: [githubWebhookDeliveries.tenantId], references: [tenants.id] }),
}));
