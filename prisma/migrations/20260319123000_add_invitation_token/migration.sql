ALTER TABLE "invitations"
ADD COLUMN "token" TEXT;

CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");
