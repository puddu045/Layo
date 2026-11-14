-- AlterTable
ALTER TABLE "Connection" ADD COLUMN     "matchCategory" TEXT,
ADD COLUMN     "matchAirportIata" TEXT,
ADD COLUMN     "matchFlightNumber" TEXT,
ADD COLUMN     "matchOverlapStartUtc" TIMESTAMP(3),
ADD COLUMN     "matchOverlapEndUtc" TIMESTAMP(3);
