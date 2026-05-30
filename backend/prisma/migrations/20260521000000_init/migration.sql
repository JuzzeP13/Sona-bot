-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager');

-- CreateEnum
CREATE TYPE "SofaModel" AS ENUM ('ELVIS_B', 'MARK', 'BERGEN', 'PAULA', 'RIO_KIDS', 'MALTA');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'in_work', 'contacted', 'waiting_client', 'success', 'failed', 'archived');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'manager',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SofaLead" (
    "id" TEXT NOT NULL,
    "selectedModel" "SofaModel" NOT NULL,
    "phone" TEXT NOT NULL,
    "normalizedPhone" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "assignedManagerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'sofa-bot',
    "clientName" TEXT,
    "adminComment" TEXT,
    "managerComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SofaLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivityLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");
CREATE INDEX "SofaLead_assignedManagerId_idx" ON "SofaLead"("assignedManagerId");
CREATE INDEX "SofaLead_createdAt_idx" ON "SofaLead"("createdAt");
CREATE INDEX "SofaLead_normalizedPhone_idx" ON "SofaLead"("normalizedPhone");
CREATE INDEX "SofaLead_selectedModel_idx" ON "SofaLead"("selectedModel");
CREATE INDEX "SofaLead_status_idx" ON "SofaLead"("status");
CREATE INDEX "LeadActivityLog_leadId_createdAt_idx" ON "LeadActivityLog"("leadId", "createdAt");
CREATE INDEX "LeadActivityLog_userId_idx" ON "LeadActivityLog"("userId");

-- AddForeignKey
ALTER TABLE "SofaLead" ADD CONSTRAINT "SofaLead_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LeadActivityLog" ADD CONSTRAINT "LeadActivityLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SofaLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivityLog" ADD CONSTRAINT "LeadActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
