CREATE TYPE "TelegramSegment" AS ENUM ('base', 'standard', 'new', 'all');

CREATE TABLE "TelegramUserSession" (
    "id" TEXT NOT NULL,
    "telegramUserId" TEXT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "segment" "TelegramSegment" NOT NULL DEFAULT 'all',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramUserSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramUserSession_telegramUserId_key" ON "TelegramUserSession"("telegramUserId");
CREATE INDEX "TelegramUserSession_segment_idx" ON "TelegramUserSession"("segment");
