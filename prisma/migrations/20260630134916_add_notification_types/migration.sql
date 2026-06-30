-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'NEW_PURCHASE_ARRIVAL';
ALTER TYPE "NotificationType" ADD VALUE 'DAILY_SALES_SUMMARY';
ALTER TYPE "NotificationType" ADD VALUE 'CASH_DRAWER_NOT_CLOSED';
ALTER TYPE "NotificationType" ADD VALUE 'LARGE_DISCOUNT';
ALTER TYPE "NotificationType" ADD VALUE 'SUSPICIOUS_TRANSACTION';
