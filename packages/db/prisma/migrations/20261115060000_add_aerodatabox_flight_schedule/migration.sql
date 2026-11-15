-- AlterEnum
ALTER TYPE "FlightDataSource" ADD VALUE 'AERODATABOX';

-- CreateTable
CREATE TABLE "FlightScheduleCache" (
    "id" TEXT NOT NULL,
    "departureAirportIata" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlightScheduleCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiUsageCounter" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "unitsUsed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiUsageCounter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FlightScheduleCache_departureAirportIata_date_key" ON "FlightScheduleCache"("departureAirportIata", "date");

-- CreateIndex
CREATE INDEX "FlightScheduleCache_expiresAt_idx" ON "FlightScheduleCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsageCounter_provider_periodKey_key" ON "ApiUsageCounter"("provider", "periodKey");
