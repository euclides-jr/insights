-- CreateEnum
CREATE TYPE "AttributeValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "lastEventName" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_attribute_history" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_attribute_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_attribute_schemas" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "valueType" "AttributeValueType" NOT NULL,
    "description" TEXT,
    "isIndexed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_attribute_schemas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_profiles_applicationId_idx" ON "user_profiles"("applicationId");

-- CreateIndex
CREATE INDEX "user_profiles_applicationId_lastSeen_idx" ON "user_profiles"("applicationId", "lastSeen");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_applicationId_userId_key" ON "user_profiles"("applicationId", "userId");

-- CreateIndex
CREATE INDEX "user_attribute_history_applicationId_userId_idx" ON "user_attribute_history"("applicationId", "userId");

-- CreateIndex
CREATE INDEX "user_attribute_history_applicationId_userId_attributeKey_ch_idx" ON "user_attribute_history"("applicationId", "userId", "attributeKey", "changedAt");

-- CreateIndex
CREATE INDEX "user_attribute_schemas_applicationId_idx" ON "user_attribute_schemas"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_attribute_schemas_applicationId_attributeKey_key" ON "user_attribute_schemas"("applicationId", "attributeKey");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_attribute_history" ADD CONSTRAINT "user_attribute_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_attribute_schemas" ADD CONSTRAINT "user_attribute_schemas_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (GIN — not expressible in Prisma SDL, added manually)
-- Enables fast JSONB containment queries: attributes @> '{"plan": "pro"}'
CREATE INDEX "user_profiles_attributes_gin_idx" ON "user_profiles" USING gin ("attributes" jsonb_path_ops);
