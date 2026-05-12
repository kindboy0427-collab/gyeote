/*
  Warnings:

  - Added the required column `updatedAt` to the `Subscription` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "customerKey" TEXT,
ADD COLUMN     "lastPaidAt" TIMESTAMP(3),
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'TOSS',
ADD COLUMN     "sid" TEXT,
ADD COLUMN     "tid" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "plan" SET DEFAULT 'monthly',
ALTER COLUMN "price" SET DEFAULT 4900;
