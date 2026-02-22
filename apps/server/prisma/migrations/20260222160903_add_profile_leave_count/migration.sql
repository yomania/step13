-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "Profile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT NOT NULL,
    "avatarKey" TEXT NOT NULL DEFAULT 'default',
    "bio" TEXT,
    "leaveCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedFromId" TEXT,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WsTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ticketHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WsTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "endedAt" DATETIME NOT NULL,
    "totalRounds" INTEGER NOT NULL,
    "winnerUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchSummary_winnerUserId_fkey" FOREIGN KEY ("winnerUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchParticipantSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "userId" TEXT,
    "playerId" TEXT NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "scoreDelta" INTEGER NOT NULL,
    "isWinner" BOOLEAN NOT NULL,
    "opponentType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchParticipantSummary_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "MatchSummary" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchParticipantSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_nickname_key" ON "Profile"("nickname");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WsTicket_ticketHash_key" ON "WsTicket"("ticketHash");

-- CreateIndex
CREATE INDEX "WsTicket_userId_idx" ON "WsTicket"("userId");

-- CreateIndex
CREATE INDEX "WsTicket_expiresAt_idx" ON "WsTicket"("expiresAt");

-- CreateIndex
CREATE INDEX "MatchSummary_endedAt_idx" ON "MatchSummary"("endedAt");

-- CreateIndex
CREATE INDEX "MatchSummary_winnerUserId_idx" ON "MatchSummary"("winnerUserId");

-- CreateIndex
CREATE INDEX "MatchParticipantSummary_matchId_idx" ON "MatchParticipantSummary"("matchId");

-- CreateIndex
CREATE INDEX "MatchParticipantSummary_userId_idx" ON "MatchParticipantSummary"("userId");
