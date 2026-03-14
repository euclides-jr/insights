-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_schemas" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "schemaDefinition" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "criteria" JSONB NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "lastRefreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_quality_metrics" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "eventsReceived" INTEGER NOT NULL DEFAULT 0,
    "eventsRejected" INTEGER NOT NULL DEFAULT 0,
    "validationFailureRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "duplicateRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completenessRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_quality_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_apiKey_key" ON "applications"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "events_eventId_key" ON "events"("eventId");

-- CreateIndex
CREATE INDEX "events_applicationId_timestamp_idx" ON "events"("applicationId", "timestamp");

-- CreateIndex
CREATE INDEX "events_applicationId_eventName_timestamp_idx" ON "events"("applicationId", "eventName", "timestamp");

-- CreateIndex
CREATE INDEX "events_userId_timestamp_idx" ON "events"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "events_sessionId_idx" ON "events"("sessionId");

-- CreateIndex
CREATE INDEX "events_eventName_idx" ON "events"("eventName");

-- CreateIndex
CREATE INDEX "event_schemas_applicationId_eventName_idx" ON "event_schemas"("applicationId", "eventName");

-- CreateIndex
CREATE UNIQUE INDEX "event_schemas_applicationId_eventName_version_key" ON "event_schemas"("applicationId", "eventName", "version");

-- CreateIndex
CREATE INDEX "segments_applicationId_idx" ON "segments"("applicationId");

-- CreateIndex
CREATE INDEX "data_quality_metrics_applicationId_date_idx" ON "data_quality_metrics"("applicationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "data_quality_metrics_applicationId_date_key" ON "data_quality_metrics"("applicationId", "date");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_schemas" ADD CONSTRAINT "event_schemas_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segments" ADD CONSTRAINT "segments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_quality_metrics" ADD CONSTRAINT "data_quality_metrics_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
