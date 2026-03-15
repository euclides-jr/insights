-- DropIndex
DROP INDEX "user_profiles_attributes_gin_idx";

-- CreateTable
CREATE TABLE "webhook_alerts" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "minLevel" TEXT NOT NULL DEFAULT 'error',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTriggeredAt" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_alerts_applicationId_idx" ON "webhook_alerts"("applicationId");

-- AddForeignKey
ALTER TABLE "webhook_alerts" ADD CONSTRAINT "webhook_alerts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
