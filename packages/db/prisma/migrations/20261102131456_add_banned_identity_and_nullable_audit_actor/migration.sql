-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorAdminId_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "actorAdminId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "BannedIdentity" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bannedByAdminId" TEXT,

    CONSTRAINT "BannedIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BannedIdentity_email_key" ON "BannedIdentity"("email");

-- AddForeignKey
ALTER TABLE "BannedIdentity" ADD CONSTRAINT "BannedIdentity_bannedByAdminId_fkey" FOREIGN KEY ("bannedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
