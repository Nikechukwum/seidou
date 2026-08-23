# Seidou Social

A video app — feed, watch, upload, comments, subscriptions — mounted inside
Seidou at `/app-center/apps/seidou-social`.

It is a port of a standalone YouTube clone ("new-tube", in `../Youtube-clone`).
The clone's feature logic and UI are kept; every service it used that clashed
with Seidou's stack was stripped and replaced.

---

## Progress

| Stage | What | Status |
|---|---|---|
| M0 | Dependencies, session middleware, Tailwind v4 tokens | ✅ Done |
| M1 | Database schema + migration | ✅ Done — applied to production |
| M2 | tRPC API layer + Supabase auth context | ✅ Done |
| M3 | Video feed | ✅ Done |
| M4 | Watch page + Mux playback | ✅ Done |
| M5 | Upload + creator studio + Mux webhook | ✅ Done — upload verified end-to-end |
| M6 | Comments, reactions, views, subscriptions | ✅ Done |
| M7 | Search, channel pages, trending/subscribed feeds | ✅ Done |
| M8 | Thumbnail + banner uploads (Supabase Storage) | 🟡 Next |
| M9 | Polish | ⬜ Not started |

Work happens on the `seidou-social` branch.

---

## What ships in v1

- **Feeds** — home, trending, and a subscribed feed, with infinite scroll and
  category filtering.
- **Watch page** — adaptive HLS playback via Mux, view counting, suggested
  videos.
- **Upload + creator studio** — upload straight to Mux, edit title,
  description, category, visibility and thumbnail; see per-video view, like
  and comment counts.
- **Comments** — one level of replies, with likes and dislikes.
- **Reactions** — like/dislike on videos.
- **Subscriptions** — subscribe to a channel, see subscriber counts.
- **Channel pages** — a creator's videos, banner and avatar.
- **Search** — by video title, narrowable by category.

## Deferred, and why

Ordered by what is worth doing next.

1. **Playlists, watch history, liked videos.** Ports cleanly — the underlying
   `video_reactions` and `video_views` tables are already populated by v1, so
   this is mostly UI plus two more tables. No new third-party service.
   Highest-value next increment.
2. **Rate limiting.** There is none today. The upstream project used Upstash
   Redis; a Postgres-backed limiter avoids adding a vendor, since Postgres is
   already here. `protectedProcedure` is the single place to add it.
3. **AI title / description / thumbnail generation.** Needs Upstash Workflow,
   QStash, an OpenAI key and a publicly reachable callback URL. Two upstream
   bugs should be fixed first: the transcript step never awaits its response
   body, and the thumbnail step deletes the old image before the new one
   finishes uploading.
4. **Anonymous view tracking.** `video_views` is keyed on
   `(user_id, video_id)`, so signed-out views are not counted at all.
5. **Guaranteeing the profile row exists.** `public.users` rows are created
   from the browser at signup. If that insert fails, the account exists with
   no profile row, and social features reject it permanently with no repair
   path. A `SECURITY DEFINER` trigger on `auth.users AFTER INSERT` would make
   the database guarantee it, and would also cover OAuth signups. Deferred
   until there is a staging environment to test signup flows against —
   note it requires removing the client-side insert, which would otherwise
   fail on a duplicate primary key.
6. **Dark mode.** Ported components carry `dark:` classes that are currently
   disabled on purpose — see "Styling" below.
7. **Desktop layout.** Seidou is a `max-w-md` mobile shell; the creator studio
   is the surface most likely to want more room.

---

## Architecture decisions

### What was stripped, and what replaced it

| Clone used | Replaced with | Why |
|---|---|---|
| Clerk (auth) | Supabase auth | Seidou already runs Supabase auth |
| Neon (Postgres host) | Supabase Postgres | Same database as the rest of Seidou |
| UploadThing (file storage) | Supabase Storage | Overlapped Supabase; its Tailwind plugin is v3-only |
| Upstash Redis (rate limiting) | *(deferred)* | Extra vendor, not needed for v1 |
| Upstash Workflow + OpenAI | *(deferred)* | Optional feature |
| sonner (toasts) | Seidou's existing Redux toast | Avoids a second toast system |
| vaul (drawer) | Seidou's `DrawerModal` | Already exists |
| embla (carousel) | Seidou's existing scrolling chip row | Already exists |
| shadcn sidebar | Seidou's `PageLayout` + `Header` + `Footer` | Desktop sidebar makes no sense in a mobile shell |

### What was kept

- **Drizzle ORM** — the clone's server layer is ~1,370 lines of it, including
  9 CTEs and 38 correlated subqueries. Rewriting it would not remove that SQL,
  only relocate it into hand-written Postgres functions, with no type safety.
  Repointed from Neon to Supabase — same database the commerce app uses, just
  reached over the Postgres wire protocol instead of the HTTP API.
- **tRPC + React Query** — the entire ported UI is built on it.
- **Mux** — video transcoding, adaptive streaming, thumbnails and captions.
  Nothing in Seidou conflicted with it.
- **Radix / shadcn UI primitives** — a ~5-package subset. Seidou has no UI kit.

### Database access and security

Two paths reach the same Supabase Postgres:

```
supabase-js  ──HTTPS──▶  PostgREST  ──▶  Postgres   (commerce)
Drizzle      ──TCP───────────────────▶  Postgres   (social)
```

Drizzle connects as the service role, which bypasses row-level security. To
stop that becoming an accidental hole, **the 7 social tables have RLS enabled
with zero policies** — so anything arriving via `supabase-js` or PostgREST is
denied outright, and the tRPC layer is provably the only way in.

Authorization lives in `protectedProcedure`, by explicit design rather than by
omission. `public.users` is shared with the commerce app and keeps its own
existing policies.

### The `users` table

Social does **not** get its own user table. Seidou's existing `public.users`
was extended, because `users.id` is already the Supabase auth id and every
social table keys off it.

Two details worth knowing before touching `social/db/schema.ts`:

1. **Every commerce column is declared there**, even though social never reads
   them. `drizzle-kit` diffs the declared schema against the live database, so
   a partial declaration would make it generate
   `ALTER TABLE users DROP COLUMN cash_balance, cart_items, ...`.
   **Never run `drizzle-kit push` against a live database.** Generate the SQL,
   read it, apply it by hand.
2. **Only `socialUserColumns` may be sent to the browser.** Several procedures
   spread the whole user row into their response; with commerce columns now
   declared, that would leak `email`, `phone`, `dob` and `cash_balance` into
   the public video feed.

### Styling

Seidou uses Tailwind v4 (CSS-first, no config file); the clone used v3. Ported
components reference semantic classes (`bg-background`, `border-border`) that
Seidou never used.

- Tokens live in `social/social.css`. A `@theme` block only *generates* utility
  classes, so adding them changes nothing for existing pages.
- shadcn's base layer is **not** global — it is scoped to `[data-social]`,
  which is set on the social route's wrapper. Applied globally it would repaint
  all 20+ commerce pages.
- `dark:` utilities carried in from shadcn are deliberately neutralized. In
  Tailwind v4 `dark:` defaults to `prefers-color-scheme`, so without this every
  ported component would darken on a phone in dark mode while the rest of
  Seidou stayed light.

### Routing

Everything is mounted under `/app-center/apps/seidou-social`. The clone's links
were written for a site root, so all internal navigation goes through
`socialPath()` / `socialUrl()` in `social/constants.ts` — the single place to
change if the mount point ever moves.

---

## Layout

`social/` holds everything that is not a route, quarantined so it cannot
collide with Seidou's own flat `components/`, `lib/` and `hooks/` folders.

```
social/
  constants.ts        route helpers, DEFAULT_LIMIT
  social.css          design tokens, scoped base layer
  db/                 schema, connection, migrations
  trpc/               API layer
  lib/                utils, mux, toast shim
  hooks/              useViewer, intersection observer
  components/         ui/ primitives + shared components
  modules/            one folder per feature
app/app-center/apps/seidou-social/   routes only (thin)
app/api/social/                      tRPC handler + Mux webhook
```

---

## Setup

Environment variables beyond Seidou's existing set:

| Variable | Needed for | Where to get it |
|---|---|---|
| `DATABASE_URL` | Drizzle (M2 onward) | Supabase → Connect → Transaction pooler |
| `NEXT_PUBLIC_APP_URL` | Share links | Your own origin |
| `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` | Upload + playback (M5) | Mux dashboard |
| `MUX_WEBHOOK_SECRET` | Processing callbacks (M5) | Mux dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Thumbnail/banner uploads (M8) | Supabase → API settings |

`DATABASE_URL` is a Postgres connection string, **not** the
`NEXT_PUBLIC_SUPABASE_URL` gateway. Different host, port and protocol:

```
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

Running the migration: open `social/db/migrations/0000_seidou_social.sql`,
read it, then paste it into the Supabase SQL editor. It is wrapped in a
transaction, so a partial failure rolls back.

Mux webhooks need a publicly reachable URL — in development, tunnel with
`ngrok http 3000` and point the Mux webhook at
`<tunnel>/api/social/videos/webhook`.
