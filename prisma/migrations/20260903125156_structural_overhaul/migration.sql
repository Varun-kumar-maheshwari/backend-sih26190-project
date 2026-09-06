/*
  Warnings:

  - A unique constraint covering the columns `[caseNumber]` on the table `Cases` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `district` to the `Cases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `policeStation` to the `Cases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `Cases` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `Documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `district` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `policeStation` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Rank" AS ENUM ('CONSTABLE', 'SUB_INSPECTOR', 'INSPECTOR', 'DSP', 'SP', 'CIVILIAN_EXPERT');

-- AlterTable
ALTER TABLE "Cases" ADD COLUMN     "district" TEXT NOT NULL,
ADD COLUMN     "policeStation" TEXT NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Documents" ADD COLUMN     "classifiedData" JSONB,
ADD COLUMN     "extractedText" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "deviceMetaData" SET DEFAULT '{}',
ALTER COLUMN "status" SET DEFAULT 'PENDING_REDACTION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "district" TEXT NOT NULL,
ADD COLUMN     "isSHO" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "policeStation" TEXT NOT NULL,
ADD COLUMN     "rank" "Rank" NOT NULL DEFAULT 'SUB_INSPECTOR',
ADD COLUMN     "state" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "_CaseAssignments" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CaseAssignments_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CaseAssignments_B_index" ON "_CaseAssignments"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Cases_caseNumber_key" ON "Cases"("caseNumber");

-- AddForeignKey
ALTER TABLE "_CaseAssignments" ADD CONSTRAINT "_CaseAssignments_A_fkey" FOREIGN KEY ("A") REFERENCES "Cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CaseAssignments" ADD CONSTRAINT "_CaseAssignments_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
