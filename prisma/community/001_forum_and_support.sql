-- Additive community schema. Does not alter genealogy, accounts, or photo tables.
CREATE TABLE "ForumPost" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "familyId" TEXT NOT NULL REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "authorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "authorName" TEXT NOT NULL,
  "isGuest" BOOLEAN NOT NULL DEFAULT false,
  "guestKey" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ForumPost_familyId_createdAt_id_idx" ON "ForumPost"("familyId", "createdAt", "id");
CREATE INDEX "ForumPost_authorId_idx" ON "ForumPost"("authorId");

CREATE TABLE "ForumImage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT NOT NULL REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "url" TEXT NOT NULL,
  "galleryPhotoId" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "ForumImage_galleryPhotoId_key" ON "ForumImage"("galleryPhotoId");
CREATE INDEX "ForumImage_postId_idx" ON "ForumImage"("postId");

CREATE TABLE "ForumComment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT NOT NULL REFERENCES "ForumPost"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "authorId" TEXT REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "authorName" TEXT NOT NULL,
  "isGuest" BOOLEAN NOT NULL DEFAULT false,
  "guestKey" TEXT,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ForumComment_postId_createdAt_id_idx" ON "ForumComment"("postId", "createdAt", "id");
CREATE INDEX "ForumComment_authorId_idx" ON "ForumComment"("authorId");

CREATE TABLE "BusinessListing" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "familyId" TEXT NOT NULL REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL CHECK ("kind" IN ('BUSINESS', 'CAUSE')),
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "location" TEXT NOT NULL DEFAULT '',
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "website" TEXT NOT NULL DEFAULT '',
  "supportDetails" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "BusinessListing_familyId_createdAt_id_idx" ON "BusinessListing"("familyId", "createdAt", "id");
CREATE INDEX "BusinessListing_ownerId_idx" ON "BusinessListing"("ownerId");

CREATE TABLE "CommunityRateLimit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "CommunityRateLimit_expiresAt_idx" ON "CommunityRateLimit"("expiresAt");
