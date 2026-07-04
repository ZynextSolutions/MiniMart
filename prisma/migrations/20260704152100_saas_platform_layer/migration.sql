-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "PlatformUserRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'BILLING');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'PAYPAL', 'MANUAL');
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- AlterTable organizations
ALTER TABLE "organizations" ADD COLUMN "slug" TEXT;
UPDATE "organizations" SET "slug" = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g')) WHERE "slug" IS NULL;
UPDATE "organizations" SET "slug" = 'org-' || LEFT(id::text, 8) WHERE "slug" IS NULL OR "slug" = '';
ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "organizations" ADD COLUMN "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "organizations" ADD COLUMN "onboarding_completed_at" TIMESTAMP(3);
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- AlterTable product_barcodes
ALTER TABLE "product_barcodes" ADD COLUMN "organization_id" UUID;
UPDATE "product_barcodes" pb SET "organization_id" = p."organization_id"
FROM "products" p WHERE pb."product_id" = p."id";
ALTER TABLE "product_barcodes" ALTER COLUMN "organization_id" SET NOT NULL;
DROP INDEX IF EXISTS "product_barcodes_code_key";
CREATE UNIQUE INDEX "product_barcodes_organization_id_code_key" ON "product_barcodes"("organization_id", "code");
CREATE INDEX "product_barcodes_organization_id_idx" ON "product_barcodes"("organization_id");

-- CreateTable platform_users
CREATE TABLE "platform_users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "PlatformUserRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateTable platform_audit_logs
CREATE TABLE "platform_audit_logs" (
    "id" UUID NOT NULL,
    "platform_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "organization_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "platform_audit_logs_created_at_idx" ON "platform_audit_logs"("created_at");
CREATE INDEX "platform_audit_logs_entity_type_entity_id_idx" ON "platform_audit_logs"("entity_type", "entity_id");
CREATE INDEX "platform_audit_logs_organization_id_idx" ON "platform_audit_logs"("organization_id");
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable plans
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "billing_interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "trial_days" INTEGER NOT NULL DEFAULT 14,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "features" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");

-- CreateTable subscriptions
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "trial_ends_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscriptions_organization_id_key" ON "subscriptions"("organization_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable subscription_events
CREATE TABLE "subscription_events" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscription_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "subscription_events_subscription_id_created_at_idx" ON "subscription_events"("subscription_id", "created_at");
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable payment_provider_customers
CREATE TABLE "payment_provider_customers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL,
    "external_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_provider_customers_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_provider_customers_organization_id_key" ON "payment_provider_customers"("organization_id");
CREATE INDEX "payment_provider_customers_provider_external_id_idx" ON "payment_provider_customers"("provider", "external_id");
ALTER TABLE "payment_provider_customers" ADD CONSTRAINT "payment_provider_customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable organization_invites
CREATE TABLE "organization_invites" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "invited_by_id" UUID,
    "accepted_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "organization_invites_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_invites_token_key" ON "organization_invites"("token");
CREATE INDEX "organization_invites_organization_id_email_idx" ON "organization_invites"("organization_id", "email");
CREATE INDEX "organization_invites_token_idx" ON "organization_invites"("token");
ALTER TABLE "organization_invites" ADD CONSTRAINT "organization_invites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable announcements
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "organization_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "announcements_is_active_starts_at_ends_at_idx" ON "announcements"("is_active", "starts_at", "ends_at");
CREATE INDEX "announcements_organization_id_idx" ON "announcements"("organization_id");

-- CreateTable support_tickets
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "SupportTicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "created_by_email" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "assigned_to_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_tickets_organization_id_status_idx" ON "support_tickets"("organization_id", "status");
CREATE INDEX "support_tickets_status_priority_idx" ON "support_tickets"("status", "priority");
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable support_ticket_messages
CREATE TABLE "support_ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "is_from_platform" BOOLEAN NOT NULL DEFAULT false,
    "author_email" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "platform_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "support_ticket_messages_ticket_id_created_at_idx" ON "support_ticket_messages"("ticket_id", "created_at");
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable feature_flags
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateTable feature_flag_overrides
CREATE TABLE "feature_flag_overrides" (
    "id" UUID NOT NULL,
    "feature_flag_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "is_enabled" BOOLEAN NOT NULL,
    CONSTRAINT "feature_flag_overrides_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feature_flag_overrides_feature_flag_id_organization_id_key" ON "feature_flag_overrides"("feature_flag_id", "organization_id");
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_feature_flag_id_fkey" FOREIGN KEY ("feature_flag_id") REFERENCES "feature_flags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feature_flag_overrides" ADD CONSTRAINT "feature_flag_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
