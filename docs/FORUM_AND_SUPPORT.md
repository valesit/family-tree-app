# Forum and family support

The Forum (`/forum`) and Support a Family Business/Cause (`/support`) use the same primary family as the existing gallery. Both are publicly readable.

- Guests enter a name to post or reply. They are labelled Guest. Their browser receives an opaque HttpOnly cookie allowing them to remove their own contributions on that browser.
- Signed-in authors use their saved account name; a submitted name cannot override it.
- Posts accept text, photos, or both. Up to four JPEG, PNG, GIF or WebP photos may be included, with a combined limit of 4 MB. Publishing creates the post and gallery records in one database transaction. Failed publishing cleans up new Blob uploads.
- Forum photos use the new `forum/<stable family id>/` Blob path. The existing gallery renders their `Posted Images` category automatically. There is no gallery upload or profile upload code change.
- Removing a forum post removes its replies and mirrored gallery records. Removing an image separately through the gallery does not delete the original forum post or its image.
- Businesses and causes require an account to create. Contact name, description, how to help, and at least one contact method are required. All entered contact details are public. Owners can edit or remove their listings. Family and platform admins can remove posts/replies and manage listings.
- Writes are limited to 20 per ten-minute bucket per account or guest IP. IPs and guest tokens are stored only as keyed hashes. Data APIs use private/no-store responses because management controls depend on the viewer.

## Additive database setup

This repository predates a Prisma migration history. `scripts/ensure-community-schema.cjs` runs during the existing build, using `DATABASE_URL`. It takes a transaction lock and creates only the five new community tables from `prisma/community/001_forum_and_support.sql`. It skips a database with all five tables already present, fails safely on a partial setup, and skips CI builds without a database. It never alters, resets, or migrates existing family, account, relationship, or photo tables. A preview sharing the production database adds these empty tables before release; existing code continues to work.

The feature uses the existing `NEXTAUTH_SECRET` and `BLOB_READ_WRITE_TOKEN` (or `FAMILY_BLOB_READ_WRITE_TOKEN`). No new service or dependency is required.

## Scope and checks

Existing source edits are limited to navigation, additive Prisma relations/models, and the build setup command. Tree components, family synchronization, person/profile pages, personal photo components, and every existing photo endpoint are unchanged.

Run `npm test`, `npm run typecheck`, and `npm run build`. Community tests exercise public access, attribution, ownership and moderation, invalid inputs, gallery transactions, upload cleanup, and rate limiting using isolated storage/session adapters. Verify the preview's guest posting and public directory, including mobile navigation, before merging.
