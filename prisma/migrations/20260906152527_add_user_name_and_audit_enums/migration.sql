/*
  Warnings:

  - Added the required column `name` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'RETRY_REDACT';
ALTER TYPE "AuditAction" ADD VALUE 'GENERATE_BSA_CERT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT NOT NULL;
