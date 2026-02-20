-- CreateTable
CREATE TABLE "Oshi" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "image" TEXT,
    "agency" TEXT,
    "unit" TEXT,
    "mainGenre" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Oshi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" SERIAL NOT NULL,
    "oshiId" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentType" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "tagScores" JSONB NOT NULL DEFAULT '{}',
    "lastSurveyAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interests" TEXT[],

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Oshi_id_userEmail_key" ON "Oshi"("id", "userEmail");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userEmail_key" ON "UserPreference"("userEmail");

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_oshiId_fkey" FOREIGN KEY ("oshiId") REFERENCES "Oshi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
