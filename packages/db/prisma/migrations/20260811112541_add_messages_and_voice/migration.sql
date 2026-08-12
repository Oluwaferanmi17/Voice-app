-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENDING', 'DELIVERED', 'FAILED');

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoicePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL DEFAULT 'af_heart',
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoicePreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_callId_createdAt_idx" ON "Message"("callId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE UNIQUE INDEX "VoicePreference_userId_key" ON "VoicePreference"("userId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoicePreference" ADD CONSTRAINT "VoicePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
