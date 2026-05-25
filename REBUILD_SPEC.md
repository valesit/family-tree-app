# Family Tree App — Rebuild Specification

A self-contained spec for an agent rebuilding this product from scratch. Reflects the simplifications agreed during development (see "Design corrections incorporated" below).

---

## 1. Product summary

A **mobile-first, single-family-tree web app** for a real family (the Sithole family) to:

1. **View** the family tree, person details, and historical photos.
2. **Contribute** new people (children, parents, spouses) and grow the tree organically.
3. **Share** photos in a categorized gallery.
4. **Read & write** wiki articles about people and family history.
5. **Claim** their own profile node and contact distant relatives via messages.

The product is **one tree, public read, signed-in write**. There is no concept of multiple unrelated families/trees in the user-facing UI; spouses' parents are added into the **same tree** so it grows horizontally.

Live deployment: Vercel + Supabase Postgres. Domain `sithole.family`.

---

## 2. Tech stack

- **Framework:** Next.js (App Router, server components by default, `'use client'` where needed). Targeting Next.js 16.
- **Language:** TypeScript (strict).
- **Database:** PostgreSQL (Supabase pooler in prod, local Postgres in dev).
- **ORM:** Prisma 7 with `@prisma/adapter-pg` (driver adapters; `node-postgres` pool).
- **Auth:** NextAuth v4 with `@auth/prisma-adapter`. Credentials provider (email+password OR phone+password). `bcryptjs` for hashes.
- **Styling:** Tailwind v4 (`@tailwindcss/postcss`), `clsx` for class composition.
- **UI primitives:** small in-house set in `components/ui` (Button, Input, Select, Textarea, Card, Avatar, Modal). No component library.
- **Icons:** `lucide-react`.
- **Forms:** `react-hook-form` + `@hookform/resolvers` with Zod schemas.
- **Data fetching:** `swr` on the client; route handlers on the server.
- **Validation:** `zod`.
- **Deploy:** Vercel. `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` set via Vercel env vars.

`package.json` scripts:

```
dev:        next dev
build:      prisma generate && next build
typecheck:  tsc --noEmit
start:      next start
lint:       eslint
seed:       npx tsx prisma/seed.ts
postinstall: prisma generate
```

`prisma.config.ts` reads `DATABASE_URL` from `dotenv` so the CLI works locally.

`lib/db.ts` creates a singleton `PrismaClient` wired to a shared `pg.Pool` (max 1 connection on Vercel, max 3 locally; `allowExitOnIdle: true`; SSL with `rejectUnauthorized: false` when not localhost). A lazy-throwing Proxy is used when `DATABASE_URL` is missing at build time so static analysis doesn't crash.

---

## 3. Design corrections incorporated

These are the decisions that emerged during iteration. **The rebuild must honor these.**

### One tree, not many

- The UI exposes **one family tree**. No "switch family", no "primary family", no "Edit family name" surfaces for regular contributors.
- Schema still has a `Family` table (one row per tree, keyed by `rootPersonId`). It can be left in place for forward-compat, but the UI never lists families.

### Root auto-detection (must be robust to stale data)

The home page and `/tree` must always show a usable tree, even when:

- The `Family` table is empty.
- A `Family` record points to a deleted/non-existent person (stale seed data).
- A user has no `FamilyMembership` rows.

**Algorithm for picking the root** when no `rootPersonId` is given:

1. Compute the set of person IDs that appear as `childId` in any `PARENT_CHILD` relationship.
2. "Root candidates" = persons NOT in that set (i.e., no known parent).
3. Sort candidates by: **number of direct children DESC**, then **oldest birth date ASC** as tiebreaker.
4. Pick the first.

This stops isolated seed/test rows (`John Doe 1800` with 0 children) from winning over the real family.

When a `rootId` IS given, always walk **up** to the topmost ancestor before building the tree — so adding a parent above the current root still renders the new top.

### Anyone signed in can contribute

- No "verified member" wall for contribution.
- No approval queue blocking new persons.
- The "Unverified" badge is a **subtle outlined-dot icon** in the card corner with a tooltip, not an orange banner.
- The `/approvals` and `/corrections` workflows can exist for admins but are **not in the main navbar**.

### Spouses grow the tree horizontally in the SAME tree

- A spouse card shows an **"Add parents"** pill above it.
- Clicking it routes to `/add-person?childId=<spouseId>` and the new parents become part of the same tree.
- There is **no** separate "birth family" sub-tree, no "née" badge that opens a different tree. `née <maidenName>` is a quiet non-interactive label.

### Add Person UX (rewritten)

Two steps, top-to-bottom on mobile:

1. **Step 1 — Relationship:** three big buttons: **Child of…**, **Parent of…**, **Spouse of…**. Below: a **type-ahead search** to pick the existing related person. (No relationship-subtype enum: every add is `PARENT_CHILD` or `SPOUSE`.)
2. **Step 2 — Details:** the person form (name, dates, optional photo, etc.).

Exception: if the tree has **zero** persons, the relationship step is hidden — the contributor is creating the very first person.

The "No relationship" mode does **not** exist anymore; every new person anchors to an existing person.

### Mobile-first

- All headers compact on small screens, full on `lg+`.
- Tree pages use `100dvh` so the iOS address bar doesn't crop them.
- **Tree canvas** supports pinch-to-zoom (two fingers), single-finger pan, mouse wheel zoom on desktop.
- **Fit-to-screen** button + automatic re-fit when:
  - tree data loads,
  - a branch is expanded or collapsed,
  - the viewport resizes (rotation, address bar, keyboard).
- Use `scrollWidth/scrollHeight` for intrinsic measurement; use two nested `requestAnimationFrame` calls before measuring so React has committed the new DOM.
- Tap targets ≥ **44×44 px** for controls; explicit `aria-label` on every icon-only button; decorative SVG connectors are `aria-hidden`.
- A floating **page scroll bubble** (up/down chevrons) is shown on mobile pages where a tall interactive canvas would otherwise trap users (home page). It disables itself at the page edges and respects `safe-area-inset-bottom`.

### Gallery

- **Below the tree** on the home page (not above).
- 5 fixed categories with curated stock images: `Generations`, `Celebrations`, `Heritage & roots`, `Everyday moments`, `Milestones`. Horizontally scrollable filter pills with counts. An extra `Your family's` pill appears once uploads exist.
- Authenticated users can upload (4 MB max, JPEG/PNG/GIF/WebP). Image is stored as a `data:` URL in the DB (cheap dev) — for production a real blob/object store should replace this. Caption is optional; edit/delete is allowed for the uploader or system admin.

### Accessibility / landmarks

- Every top-level page wraps content in a single `<main aria-label="…">`.
- Use `100dvh` for fullscreen views.
- `role="toolbar"` on the tree zoom controls cluster, `aria-live="polite"` on the zoom %.

---

## 4. Data model (Prisma)

The full schema is at `prisma/schema.prisma`. Highlights:

### Core models

**`User`**
- Auth identity. `email?` and `phone?` (either or both unique), `password` (bcrypt), `name`, `image`.
- `role: UserRole` — `ADMIN | MEMBER | VIEWER` (system-wide).
- 1:1 with `Person` via `linkedPerson` (a user "claims" a person).
- Owns: `personsAdded`, `personsVerified`, `wikiArticles`, `wikiComments`, `notableNominations`, `familyMemberships`, `familiesCreated`, etc.

**`Person`**
- Free-standing family tree node. Does not require a user account.
- Fields: name parts (`firstName`, `lastName`, `middleName?`, `maidenName?`, `nickname?`), `gender?`, `birthDate/Place?`, `deathDate/Place?`, `biography?`, `facts?` (JSON-string), contact fields (`email`, `phone`, `address`), `occupation?`, `isLiving`, `isPrivate`, `birthFamilyRootPersonId?` (legacy; unused in UI now).
- `isVerified: Boolean` with `verifiedAt`, `verifiedById` (soft signal only).
- `addedById` (User who created the node).
- `profileImage` → `PersonImage`, plus a `images[]` gallery.
- Self-relations via `Relationship` (parent/child/spouse).

**`Relationship`**
- One row per edge. `type: RelationshipType` (`PARENT_CHILD | SPOUSE | SIBLING | ADOPTED | STEP_PARENT | STEP_CHILD | FOSTER`). In simplified mode only `PARENT_CHILD` and `SPOUSE` are created from UI.
- For parent/child: `parentId`, `childId`.
- For spouse: `spouse1Id`, `spouse2Id`, plus `startDate` (marriage), `endDate` (divorce), `notes`.

**`Family`**
- One row per tree, keyed by `rootPersonId` (unique). Holds tree-level metadata (`name`, `description?`, `motto?`, `crestImage?`). Created automatically when seeding; not surfaced as a switcher.

**`FamilyMembership`**
- User ↔ Family with `role: FamilyRole` (`ADMIN | MEMBER | PENDING`). Used to scope notifications.

**`GalleryPhoto`**
- `rootPersonId` (the family the photo belongs to), `url` (data: URL today), `label`, `sortOrder`, `uploadedById?`.

### Supporting models (preserve, but UI is light)

- `PersonImage` — photo gallery on a person.
- `WikiArticle`, `WikiComment`, `WikiTag` — family wiki.
- `NotableNomination`, `NotableImage` — admin-curated "notable" badge on a Person (gives `isNotable`, `notableTitle`, `notableDescription`).
- `CorrectionRequest` — public request for an edit.
- `PendingChange`, `Approval` — generic approvals pipeline (admin-only screens).
- `AdminRemovalRequest` — system-admin tool.
- `Message`, `Conversation`, `ConversationParticipant` — direct messaging.
- `Notification` — typed user notifications (see `NotificationType`).
- `Activity` — append-only activity log (`PERSON_ADDED`, `RELATIONSHIP_ADDED`, etc.).

### Enums

`UserRole`, `FamilyRole`, `Gender`, `RelationshipType`, `ChangeType`, `ApprovalStatus`, `NotificationType`, `ActivityType`.

> The original schema had `PendingChange`, `Approval`, `CorrectionRequest`, `AdminRemovalRequest`, and `FamilyRole.PENDING` — these have **all been dropped** in the simplified schema (PR/branch `cursor/fix-tree-mobile-layout`). Don't reintroduce them. The `Person.birthFamilyRootPersonId` column was also dropped (the spouse-grows-tree-horizontally flow uses ordinary `PARENT_CHILD` relationships). The `NotificationType` enum has been pruned to remove approval/correction/admin-removal variants.

---

## 5. Routes & pages

All under Next.js App Router.

### Public

- `app/page.tsx` — **Home**. Hero, the tree (read-only, `FamilyTree` with `readOnly`), key stats, gallery section (below the tree), founder card, CTAs.
- `app/(auth)/login/page.tsx` — sign in (email or phone + password).
- `app/(auth)/register/page.tsx` — register.
- `app/(main)/tree/page.tsx` — **Main tree**. Compact mobile header (back button, family name, member count). Two-panel layout: tree (primary) + collapsible overview (founding ancestor card, stats, birthdays this month, notable members, quick links). On `lg+` they sit side-by-side; on small screens the overview is below the tree, behind a chevron toggle. Includes a "Family switcher" only if a user has multiple memberships (rare; otherwise hidden).
- `app/(main)/tree/[familyId]/page.tsx` — Alternate split view used from `/?family=…` deep links. Same simplified mobile rules.
- `app/(main)/person/[id]/page.tsx` — Person detail. Shows bio, vitals, relations, claim profile button if logged in and unlinked.
- `app/(main)/wiki/page.tsx`, `wiki/[slug]/page.tsx`, `wiki/new/page.tsx` — Wiki list/article/new.
- `app/(main)/gallery/page.tsx` — Full gallery, same categories as the home embed.

### Signed-in only

- `app/(main)/add-person/page.tsx` — **Rewritten Add Person**. Two-step UX described above.
- `app/(main)/person/[id]/edit/page.tsx` — Edit a person.
- `app/(main)/profile/page.tsx` — Profile settings + password change.
- `app/(main)/messages/page.tsx` — Inbox / 1:1 messaging.
- `app/(main)/corrections/page.tsx`, `corrections/new/page.tsx` — Correction requests.
- `app/(main)/approvals/page.tsx` — Approvals queue (admin-only, not in navbar).

### Layout

- `app/layout.tsx` — root layout, fonts, providers, Tailwind global.
- `app/(main)/layout.tsx` — wraps signed-in/public navigation (`Navbar`) and is `<main>`-landmark friendly.

The **navbar** for authenticated users contains exactly: `Family Tree`, `Wiki`, `Gallery`, `Messages`. Approvals / Corrections are not in the navbar. Add Person is a primary CTA button.

---

## 6. API surface (route handlers)

All under `app/api/*/route.ts`. JSON. Standard response envelope:

```ts
type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };
```

### Auth

- `POST /api/auth/register` — Body: `{ email?, phone?, password, confirmPassword, name }`. Validates with `registerSchema` (must have email OR phone; password ≥ 8 chars with upper/lower/digit). Hashes with `bcryptjs`. Creates a `User` row. Optional welcome notification + activity log.
- `[...nextauth]` — credentials provider (`signIn` accepts `email` or `phone` + `password`).

### Tree & people (public reads, signed-in writes)

- `GET /api/persons` — List/search. Query: `query?`, `page=1`, `limit=50`. Returns `{ items, total, page, pageSize, totalPages }`. Includes `profileImage` and minimal relations.
- `POST /api/persons` — Signed-in. Body validated with `personSchema`. Optional `relatedPersonId` (used to detect family) and `familyId`. Creates the person, auto-verifies if creator is `ADMIN` or family admin, otherwise inserts as `isVerified: false`. Auto-adds creator as `FamilyMembership` to the inferred family. Logs `Activity`.
- `GET /api/persons/[id]` — Person detail with `profileImage`, parent/child/spouse relations, linked user.
- `PATCH /api/persons/[id]` — Update.
- `DELETE /api/persons/[id]` — Delete (admin only).
- `POST /api/persons/[id]/claim` — Link a user account to a person (`Person.userId`). Idempotent; rejects if already linked to someone else.
- `POST /api/persons/[id]/verify` — Mark verified.

- `GET /api/relationships` — List, filterable by `personId`.
- `POST /api/relationships` — Body: `{ type, person1Id, person2Id, startDate?, endDate?, notes? }`. For `PARENT_CHILD`, person1 is parent, person2 is child. For `SPOUSE`, ordering is symmetric.
- `DELETE /api/relationships/[id]` — admin only.

- `GET /api/tree` — Build the tree.
  - Query: `rootPersonId?` or `rootId?`, `direction = ancestors | descendants | both`, `maxDepth=10`.
  - If a root is given, **walk up** to topmost ancestor first.
  - If no root is given, apply the **root auto-detection** algorithm above.
  - Returns `{ tree: TreeNode | null, stats, rootPersonId, familyName, foundingAncestor }`.
  - Stats are **scoped to this tree** only (filter persons & relationships by `collectTreeNodeIds(tree)`).

- `GET /api/families` — Home page summary endpoint.
  - Try the `Family` table first; **filter out stale rows whose `rootPersonId` points to a missing Person**.
  - If the filtered set is **empty**, fall through to **auto-detection** (sort roots by descendant count → oldest birth date → take top) and return synthetic families derived from those roots.
  - Stats: total members, living/deceased counts, gender split, marriages, oldest member, youngest living.
  - Picks `primaryFamilyId` as the largest family or the one containing `sithole` in the name.

- `GET /api/families/search?surname=…` — Search families by surname.

### Families & memberships (kept for admin tools / future)

- `GET/POST /api/family` — set/update Family metadata (name, description, motto, crest).
- `GET/POST/DELETE /api/family/members` — list/add/remove `FamilyMembership` rows.
- `GET/POST /api/family/admins` — Family Admin management.
- `POST /api/family/admins/removal-request` — Request removal of a family admin (system-admin approval).
- `GET /api/user/families` — Current user's families. **Must fall back to the same auto-detection root algorithm** when no membership exists, so a logged-in user without an explicit `FamilyMembership` still gets a sensible `defaultFamilyId`.

### Approvals & corrections

- `GET/POST /api/approvals`, `GET/PATCH /api/approvals/[id]` — Approval flow for pending changes. Not surfaced in main navbar.
- `GET/POST /api/corrections`, `GET/PATCH /api/corrections/[id]` — Correction requests.

### Wiki

- `GET/POST /api/wiki` — list / create article.
- `GET/PATCH/DELETE /api/wiki/[id]` — read / update / delete.
- `GET/POST /api/wiki/[id]/comments` — threaded comments.

### Gallery

- `GET /api/gallery?rootPersonId=…` — Returns `{ stock: StockGalleryItem[], uploads: UploadRow[] }`. `stock` is from `lib/gallery-stock.ts` and is **categorized**.
- `POST /api/gallery` — Multipart upload (`image`, `label?`, `rootPersonId`). Stores as data URL in `GalleryPhoto.url`. 4 MB max. Allowed: `image/jpeg|png|gif|webp`.
- `PATCH /api/gallery/[id]` — edit `label`.
- `DELETE /api/gallery/[id]` — uploader or system admin only.

### Messaging & notifications

- `GET/POST /api/messages` — list/send (1:1 or in a `Conversation`).
- `GET/PATCH /api/notifications` — list/mark-read.

### Notable

- `GET/POST /api/notable` — list approved notable persons, submit a nomination.
- `GET/PATCH /api/notable/[id]` — view / approve a nomination (admin).

### Misc

- `GET /api/relatives` — BFS over the user's linked person's tree to suggest distant relatives to message.
- `POST /api/upload` — Upload a profile image (multipart). Stores as a data URL on `PersonImage` and sets it as the person's `profileImage`.

---

## 7. Tree rendering (the core piece)

### Components

- `components/tree/FamilyTree.tsx` — the interactive canvas (pinch, pan, fit, zoom).
- `components/tree/TreeNode.tsx` — recursive node + spouses + children.
- `components/tree/TreeControls.tsx` — floating zoom/fit/reset buttons.
- `components/tree/TreeViewContext.tsx` — small context for suppressing clicks during a pan.
- `components/tree/ExpandedTreeView.tsx` — full-screen modal version (optional).

### Behavior

- Two-finger **pinch-to-zoom** anchored at the finger midpoint. Single-finger **pan**. Mouse wheel zoom on desktop.
- **Fit-to-screen** uses `contentRef.scrollWidth/scrollHeight` (pre-transform intrinsic). Pad with 24 px. Center horizontally and vertically if the tree fits; pin to top with padding if it's taller.
- Re-fit on: data change, `expandedNodes` change (any expand/collapse), and `ResizeObserver` on the canvas container.
- Defer fits with **two nested `requestAnimationFrame`** so React commits and paints first.
- Initially expand the first two generations (`depth < 2`) so the user sees something useful immediately.

### TreeNode visuals

- A person card is a `button` with avatar, name, dob/dod years, and a small **outlined-dot "recently added" icon** in the corner when `isVerified === false`.
- Spouses sit beside the main person, connected by a heart icon. Each spouse card has an "**Add parents**" pill above it (when not `readOnly`).
- "Add child" appears as a small button anchored to the card's right edge.
- "Add spouse" appears as a dashed placeholder to the right of the couple (large if no spouses yet, tiny otherwise).
- Expanding/collapsing children is via a 32px circular chevron pill below the couple.
- Maiden name shows as a quiet `née <maidenName>` chip — **not** a link to a separate tree.
- All decorative SVG connectors are `aria-hidden`; interactive buttons have explicit `aria-label`.

### Click-vs-pan handling

Tap on the card opens a person detail modal. To prevent panning from firing a click, `FamilyTree` tracks the pointer movement distance; if it crosses ~6 px the gesture switches to pan and a `TreeViewContext` flag suppresses the next click on a card.

---

## 8. Add Person flow (must implement exactly like this)

**Page:** `app/(main)/add-person/page.tsx`. Wrapped in `<main>`.

**Layout:**

- Mobile: single column, two sections stacked.
- `lg+`: two columns, 2/5 + 3/5 (Step 1 left, Step 2 right). When the tree is empty, the form occupies all 5 columns and Step 1 is hidden.

**Step 1 — Relationship (only shown if persons exist):**

- Three big mode buttons: `Child of…`, `Parent of…`, `Spouse of…`.
- Initial mode comes from query params:
  - `?parentId=<id>` → `child_of`, prefill that parent
  - `?childId=<id>` → `parent_of`, prefill that child
  - `?spouseId=<id>` → `spouse_of`, prefill that spouse
  - else default `child_of`
- Type-ahead search (`<input type="search">`) filters the loaded `/api/persons?limit=500` result client-side; show up to 30 matches.
- Selected person preview card with a one-line caption like "Will be the new person's parent".

**Step 2 — Details:**

- Standard `PersonForm` (`components/person/PersonForm.tsx`).
- Submit button label changes with the mode (`Save child`, `Save parent`, `Save spouse`).

**Submission sequence:**

1. `POST /api/persons` with `{ ...form, relatedPersonId: selectedPersonId }` (omit `relatedPersonId` when tree is empty).
2. If `selectedPersonId`, `POST /api/relationships`:
   - `child_of` → `{ type: 'PARENT_CHILD', person1Id: selectedPersonId, person2Id: newId }`
   - `parent_of` → `{ type: 'PARENT_CHILD', person1Id: newId, person2Id: selectedPersonId }`
   - `spouse_of` → `{ type: 'SPOUSE', person1Id: selectedPersonId, person2Id: newId }`
3. If a `profileImage` File was selected, `POST /api/upload` with multipart `{ image, personId: newId }`.
4. Redirect to `/tree`.

**Validation/UX:**

- If the tree has people and no related person is selected, the form must surface "Pick an existing family member above before saving" beneath the submit button.
- Errors render in a small rose card at the top of the page.

---

## 9. Home page composition

`app/page.tsx`. Wrapped in a custom branded nav bar (logo + Wiki/Stories/Gallery/Full tree chips) and `<main>` content.

1. **Hero** — family name (gradient), founding ancestor strapline, primary CTAs ("View full tree", "Sign up to edit", "Read stories").
2. **Tree section** — header (TreePine icon + label, mobile-only "Open full" chip, desktop hint text). Tree canvas has explicit `h-[min(62dvh,560px)]` mobile → `h-[min(70dvh,720px)]` sm → `h-[min(82vh,960px)]` lg. The canvas uses `readOnly`.
3. **Sidebar stats** on lg+, below tree on mobile. "Family at a glance" card with FactCards (Members, Generations, Marriages, Notable), oldest ancestor, link to wiki.
4. **Gallery section** (below the tree) — `FamilyGallerySection` with categories.
5. **CTA for unauthenticated** — "Join the family" + "Sign in".
6. **Footer**.
7. **PageScrollNav** — floating mobile bubble in the bottom-right that scrolls the page up/down by ~80% of the viewport. Disabled at edges. Hidden on `lg+`. Respects `safe-area-inset-bottom`.
8. **Person detail modal** — opens when you tap a node, with close button, vitals, biography, spouse/children chips, and a "Open Full Tree" action.

---

## 10. Validation rules (Zod, `lib/validators.ts`)

- `personSchema`: required `firstName`, `lastName`; optional name parts, gender, birth/death (ISO date string), bio, contact fields, occupation, `isLiving`, `isPrivate`. Cross-field: deathDate must be after birthDate when both set.
- `relationshipSchema`: `type`, `person1Id`, `person2Id`, optional dates and notes. Forbid `person1Id === person2Id`.
- `registerSchema`: email or phone (one required), strong password (≥ 8 chars, upper/lower/digit), confirm matches, name ≥ 2 chars.
- `loginSchema`, `correctionSchema`, `messageSchema`, `approvalSchema`, `searchSchema`, `profileSchema`, `passwordChangeSchema`, `changeRequestSchema`.

---

## 11. Theming & visual language

- Color palette is **maroon** as primary (Tailwind: brand `maroon-50…maroon-900` defined in CSS), slate for text and surfaces, amber for soft warnings, rose for errors, emerald for "living".
- Font: serif for hero titles, system UI for everything else.
- Cards: rounded-2xl, subtle ring/border, soft shadows.
- All interactive controls have visible focus states and hover/active states; no relying on hover.

---

## 12. Auth and permissions

- `User.role`: `ADMIN | MEMBER | VIEWER`.
- `FamilyMembership.role`: `ADMIN | MEMBER | PENDING`.

**Helper functions** in `lib/family-membership.ts`:

- `isSystemAdmin(userId)` — `User.role === 'ADMIN'`.
- `isFamilyAdmin(userId, familyId)`.
- `canManageTree(userId, familyId)` — system admin OR family admin.
- `isVerifiedMember(userId, familyId)` — has membership, role ≠ `PENDING`.
- `getUserDefaultFamily(userId)` — linked person's family root → first membership → `null`.
- `findPersonFamilyRoot(personId)` — walks up parent edges; returns the topmost person who is the `rootPersonId` of some `Family` row.
- `addUserToFamily`, `promoteToFamilyAdmin`, `getFamilyAdmins`, `getVerifiedFamilyMembers`, `notifyFamilyAdmins`, `notifyVerifiedMembers`.

**Permission rules in the simplified product:**

- Browsing the tree, persons, wiki, gallery: **public**.
- Adding/editing persons & relationships, uploading photos, posting wiki: **any signed-in user**.
- Deleting persons/relationships, family-name editing, approvals, family admin removal: **system admin** (and optionally family admin).
- Claim profile: any signed-in user, only one Person per User.

---

## 13. Notifications, activity, messaging (light, optional)

- Show a small badge on the user's bell in the navbar when `Notification.isRead = false`.
- Notification types are listed in the enum; the rebuild may slim this down to: `WELCOME`, `NEW_FAMILY_MEMBER`, `PROFILE_CLAIMED`, `NEW_MESSAGE`.
- `Message` 1:1 between linked-person owners.
- `Activity` log is append-only; surfaced as an optional "Recent activity" widget on the profile or admin pages.

---

## 14. Gallery & content

- `lib/gallery-stock.ts` exports:
  - `GALLERY_CATEGORIES: GalleryCategory[]` (5 entries, fixed order).
  - `STOCK_GALLERY: StockGalleryItem[]` (2 per category) with stable IDs.
- The Gallery component:
  - Horizontally scrollable filter pills (`All`, the 5 categories, optional `Your family's`).
  - 2-col grid on mobile, 3 on md, 4 on lg.
  - Auto-jump to `Your family's` after an upload succeeds.
  - Inline upload form appears only after a file is chosen; cancel button to abandon.

---

## 15. Seed data

`prisma/seed.ts` creates:

- A system admin user `admin@familytree.com` (password is set; bcrypt-hashed).
- A 4-generation Sithole family of 12+ persons (great-grandparents → grandparents → parents/uncle → children/cousin) with realistic relationships.
- One `Family` record pointing to the great-grandfather.
- One example `WikiArticle`.
- A few `GalleryPhoto` rows.

> The seed should make **a working home page from a clean DB** without needing any other data.

---

## 16. Specific bug fixes already applied (must keep)

1. **`/api/families` falls through to auto-detection** when the `Family` table only contains stale records (rootPersonId pointing to a deleted Person).
2. **`/api/tree` root selection** prefers persons with the most direct children, with birth date as tiebreaker.
3. **`/api/user/families` `defaultFamilyId`** falls back to the same algorithm when the user has no `FamilyMembership`.
4. **Tree always auto-fits** to the screen on data load, expand/collapse, and resize.
5. **Tree pages use `<main aria-label="…">`** and `100dvh`.
6. **Icon-only buttons** (`Maximize2`, `Pencil`, `X`) carry `aria-label`. Decorative SVGs are `aria-hidden`.

---

## 17. Out of scope (don't rebuild)

- Multi-language i18n.
- Real object storage for photos (data URLs are fine for v1).
- Phone OTP (passwords only).
- SSE / WebSocket live updates (SWR with `revalidateOnFocus: false` is enough).
- Public sharing links / SEO meta beyond the basics.
- A11y audit beyond the items listed in §3.

---

## 18. Acceptance checklist

A successful rebuild must satisfy all of these:

- [ ] Home page renders the tree from a fresh DB **even with no `Family` records** (auto-detection picks the largest connected root).
- [ ] Adding a person from a node's "Add child" button creates the person AND the parent-child relationship in one user-facing action, then redirects to `/tree` showing the new node.
- [ ] Clicking "Add parents" above a spouse routes to `/add-person?childId=<spouseId>`, the form arrives pre-set to "Parent of …", and submitting grows **this same tree** (not a separate tree).
- [ ] Pinch-to-zoom and fit-to-screen work on a real iOS Safari device.
- [ ] Expanding any branch auto-fits the tree so the whole tree stays visible.
- [ ] Mobile home page can be scrolled past the tree to the gallery (PageScrollNav helps).
- [ ] The "Unverified" indicator is a small corner dot, not an orange banner.
- [ ] Anyone signed in can add a person; no approval queue blocks them.
- [ ] Navbar has only `Family Tree`, `Wiki`, `Gallery`, `Messages`, plus the Add Person CTA.
- [ ] `npm run build` succeeds on a fresh checkout once `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET` are set.
- [ ] `npm run seed` populates a usable family that the home page renders.

---

## 19. File map (target structure)

```
app/
  layout.tsx
  page.tsx                              # Home
  globals.css
  (auth)/
    login/page.tsx
    register/page.tsx
  (main)/
    layout.tsx
    add-person/page.tsx                 # ← rewritten 2-step UX
    approvals/page.tsx                  # admin-only, not in navbar
    corrections/page.tsx
    corrections/new/page.tsx
    gallery/page.tsx
    messages/page.tsx
    person/[id]/page.tsx
    person/[id]/edit/page.tsx
    profile/page.tsx
    tree/page.tsx                       # one-tree main view
    tree/[familyId]/page.tsx            # split view (deep-linked)
    wiki/page.tsx
    wiki/new/page.tsx
    wiki/[slug]/page.tsx
  api/
    auth/[...nextauth]/route.ts
    auth/register/route.ts
    persons/route.ts
    persons/[id]/route.ts
    persons/[id]/claim/route.ts
    persons/[id]/verify/route.ts
    relationships/route.ts
    tree/route.ts
    families/route.ts                   # falls through when Family table is stale
    families/search/route.ts
    family/route.ts
    family/members/route.ts
    family/admins/route.ts
    family/admins/removal-request/route.ts
    gallery/route.ts
    gallery/[id]/route.ts
    upload/route.ts
    wiki/route.ts
    wiki/[id]/route.ts
    wiki/[id]/comments/route.ts
    notable/route.ts
    notable/[id]/route.ts
    messages/route.ts
    notifications/route.ts
    corrections/route.ts
    corrections/[id]/route.ts
    approvals/route.ts
    approvals/[id]/route.ts
    relatives/route.ts
    user/families/route.ts              # fallback root algorithm

components/
  ui/                                   # Button, Input, Select, Textarea, Card, Avatar, Modal
  shared/
    navbar.tsx                          # 4 nav items only
    NotificationBell.tsx
    PageScrollNav.tsx                   # mobile-only floating scroll bubble
  tree/
    FamilyTree.tsx                      # pinch + fit + auto re-fit
    TreeNode.tsx                        # spouse "Add parents" pill, soft Unverified dot
    TreeControls.tsx                    # ≥44px buttons, aria-labels
    TreeViewContext.tsx
    ExpandedTreeView.tsx
    index.ts
  person/
    PersonForm.tsx                      # used by Add Person and Edit Person
    PersonCard.tsx
    index.ts
  gallery/
    FamilyGallerySection.tsx            # 5 categories + filter pills
    index.ts
  wiki/...
  approval/...
  messages/...
  notable/...

lib/
  auth.ts                               # NextAuth options
  auth-context.tsx
  db.ts                                 # singleton PrismaClient + pg.Pool
  family-membership.ts
  gallery-stock.ts                      # categories + curated images
  tree-utils.ts                         # buildFamilyTree, collectTreeNodeIds, getAncestors, etc.
  validators.ts                         # Zod schemas

prisma/
  schema.prisma
  seed.ts
  migrations/...

types/
  index.ts                              # TreeNode, SpouseNode, PersonWithRelations, SessionUser, etc.
```

---

## 20. Hand-off notes for the next agent

- **Start by reading this file in full**, then read `prisma/schema.prisma`, `lib/db.ts`, `lib/tree-utils.ts`, `app/api/tree/route.ts`, `app/api/families/route.ts`, `components/tree/FamilyTree.tsx`, and `app/(main)/add-person/page.tsx` — these capture 90% of the product.
- The mobile UX is the make-or-break: build the tree canvas with pinch + auto-fit **first**, then the Add Person flow, then everything else.
- **Never** ship multi-tree UI to regular users. One tree, period.
- **Never** block contributions on a verification queue. The "Unverified" badge is decorative.
- The product's success metric is "a non-technical relative can open the site on their phone, find their photo, claim it, add their spouse, add their kids, and upload a wedding photo — without help."
