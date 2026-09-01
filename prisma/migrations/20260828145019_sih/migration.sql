-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'INVESTIGATOR', 'FORENSIC_EXPERT', 'COURT_CLERK');

-- CreateEnum
CREATE TYPE "Department" AS ENUM ('GENERAL_DUTY', 'CYBER_CELL', 'NARCOTICS', 'HOMICIDE', 'ECONOMIC_OFFENCES', 'FORENSICS_LAB');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('UPLOAD', 'VIEW', 'DELETE', 'SHARE', 'REDACT');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('REDACTED', 'PENDING_REDACTION', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('FIR_COPY', 'WITNESS_STATEMENT', 'SEIZURE_MEMO', 'FORENSIC_REPORT', 'CHARGE_SHEET', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('OPEN', 'UNDER_INVESTIGATION', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "department" "Department" NOT NULL,
    "refreshToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cases" (
    "id" TEXT NOT NULL,
    "caseNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CaseStatus" NOT NULL,
    "leadInvestigator" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Documents" (
    "id" TEXT NOT NULL,
    "documentReference" TEXT,
    "type" "DocumentType" NOT NULL,
    "caseId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "originalFilePath" TEXT NOT NULL,
    "redactedFilePath" TEXT,
    "fileHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "deviceMetaData" JSONB NOT NULL,
    "status" "DocumentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit_Logs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "previousHash" TEXT,
    "currentHash" TEXT NOT NULL,
    "timeStamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" "AuditAction" NOT NULL,

    CONSTRAINT "Audit_Logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Secure_Shares" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "maxViews" INTEGER NOT NULL,
    "currentViews" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Secure_Shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Documents_idempotencyKey_key" ON "Documents"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "Cases" ADD CONSTRAINT "Cases_leadInvestigator_fkey" FOREIGN KEY ("leadInvestigator") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documents" ADD CONSTRAINT "Documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Documents" ADD CONSTRAINT "Documents_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit_Logs" ADD CONSTRAINT "Audit_Logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit_Logs" ADD CONSTRAINT "Audit_Logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secure_Shares" ADD CONSTRAINT "Secure_Shares_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Secure_Shares" ADD CONSTRAINT "Secure_Shares_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
