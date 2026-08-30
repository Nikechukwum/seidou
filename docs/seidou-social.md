# Seidou Social

A video app — feed, watch, upload, comments, playlists, subscriptions —
mounted inside Seidou at `/app-center/apps/seidou-social`.

It is a port of a standalone YouTube clone ("new-tube", in `../Youtube-clone`).
The clone's feature logic and UI are kept; every service it used that clashed
with Seidou's stack was stripped and replaced.

---

## Progress

| Stage | What | Status |
|---|---|---|
| M0 | Dependencies, session middleware, Tailwind v4 tokens | ✅ Done |
| M1 | Database schema + migration | ✅ Done |
| M2 | tRPC API layer + Supabase auth context | ✅ Done |
| M3 | Video feed | ✅ Done |
| M4 | Watch page + Mux playback | ✅ Done |
| M5 | Upload + creator studio | ✅ Done |
| M6 | Comments, reactions, views, subscriptions | ✅ Done |
| M7 | Search, channel pages, trending/subscribed feeds | ✅ Done |
| M8 | Playlists, liked videos, watch history | ✅ Done |
| M9 | Custom thumbnails + channel banners | ✅ Done |
| M10 | Polish | ✅ Done |

Work happened on the `seidou-social` branch.

### Migrations to run

In `social/db/migrations/`, applied by pasting into the Supabase SQL editor.
**Never run `drizzle-kit push` against a live database** — it diffs
declared-vs-actual and can propose dropping commerce columns from
`public.users`.

| File | Adds | Applied |
|---|---|---|
| `0000_seidou_social.sql` | 7 social tables, users columns, RLS | ✅ |
| `0001_playlists.sql` | `playlists`, `playlist_videos`, RLS | ⬜ **pending** |
| `0002_storage.sql` | `social` storage bucket + policies | ⬜ **pending** |

Until `0001` runs, the Playlists pages error; Liked and History still work,
because they read `video_reactions` and `video_views` rather than the new
tables. Until `0002` runs, thumbnail and banner uploads fail.

---

## Routes

```
/app-center/apps/seidou-social
  /                          home feed
  /feed/trending             ordered by view count
  /feed/subscribed           channels you follow          (auth)
  /search?query=&categoryId= title search + category filter
  /videos/[videoId]          watch page
  /users/[userId]            channel
  /users/current             redirects to your own channel (auth)
  /playlists                 your playlists                (auth)
  /playlists/[playlistId]    one playlist                  (auth)
  /playlists/liked           liked videos                  (auth)
  /playlists/history         watch history                 (auth)
  /studio                    your videos                   (auth)
  /studio/videos/[videoId]   edit a video                  (auth)

/api/social/trpc/[trpc]      the API
/api/social/videos/webhook   Mux processing callbacks
```

## What it does

- **Feeds** — home, trending, subscribed; infinite scroll; category chips.
- **Watch** — adaptive HLS via Mux, view counting, suggested videos,
  like/dislike, subscribe, threaded comments one level deep with their own
  reactions.
- **Upload + studio** — upload straight to Mux, edit title, description,
  category, visibility and thumbnail; per-video view, like and comment counts.
- **Playlists** — create, add, remove, delete. Plus liked videos and watch
  history, which own no rows: they are derived from reactions and views.
- **Channels** — a creator's public videos, avatar, banner, subscriber count.
- **Search** — by title, narrowable by category.

## Still deferred

1. **Rate limiting.** There is none. The upstream project used Upstash Redis;
   a Postgres-backed limiter avoids adding a vendor. `protectedProcedure` is
   the single place to add it.
2. **AI title / description / thumbnail generation.** Needs Upstash Workflow,
   QStash, an OpenAI key and a public callback URL. Fix two upstream bugs
   first: the transcript step never awaits its response body, and the
   thumbnail step deletes the old image before the new one finishes uploading.
3. **Anonymous view tracking.** `video_views` is keyed on
   `(user_id, video_id)`, so signed-out views are not counted.
4. **Guaranteeing the profile row exists.** `public.users` rows are created
   from the browser at signup. If that insert fails, the account exists with
   no profile row and social features reject it permanently. A
   `SECURITY DEFINER` trigger on `auth.users AFTER INSERT` would make the
   database guarantee it and would also cover OAuth signups. Note it requires
   removing the client-side insert, which would otherwise fail on a duplicate
   primary key.
5. **Stranded uploads.** The video row is created when a file is selected, so
   closing the tab mid-upload leaves a row stuck at `waiting`. A cleanup job
   for rows waiting beyond an hour would settle it.
6. **Dark mode.** Ported components carry `dark:` classes that are currently
   disabled on purpose — see "Styling".
7. **Desktop layout.** Seidou is a `max-w-md` mobile shell; the creator studio
   is the surface most likely to want more room.
8. **`npm run lint` is broken** — and was before this work started.
   `eslint-config-next@^0.2.4` (a 2020 release) is paired with Next 16, so
   `core-web-vitals` does not resolve. Bumping it to `^16` will likely surface
   lint errors across the commerce pages, so it deserves its own pass.

---

## Architecture decisions

### What was stripped, and what replaced it

| Clone used | Replaced with | Why |
|---|---|---|
| Clerk (auth) | Supabase auth | Seidou already runs Supabase auth |
| Neon (Postgres host) | Supabase Postgres | Same database as the rest of Seidou |
| UploadThing | Supabase Storage | Overlapped Supabase; its Tailwind plugin is v3-only |
| Upstash Redis | *(deferred)* | Extra vendor, not needed yet |
| Upstash Workflow + OpenAI | *(deferred)* | Optional feature |
| sonner (toasts) | Seidou's Redux toast | Avoids a second toast system |
| vaul (drawer) | Seidou's `DrawerModal` | Already exists |
| embla (carousel) | Seidou's scrolling chip row | Already exists |
| shadcn sidebar | `PageLayout` + `Header` + `Footer` + `SocialTabs` | A desktop sidebar makes no sense in a mobile shell |
| Radix DropdownMenu | Bottom sheet | A dropdown anchored to a small icon is awkward on touch |

### What was kept

- **Drizzle ORM** — the clone's server layer is ~1,900 lines of it, including
  CTEs and correlated subqueries. Rewriting would not remove that SQL, only
  relocate it into hand-written Postgres functions, with no type safety.
  Repointed from Neon to Supabase — the same database the commerce app uses,
  reached over the Postgres wire protocol instead of the HTTP API.
- **tRPC + React Query** — the entire ported UI is built on it.
- **Mux** — transcoding, adaptive streaming, thumbnails, captions.
- **Radix / shadcn primitives** — a small subset. Seidou has no UI kit.

### Database access and security

Two paths reach the same Supabase Postgres:

```
supabase-js  ──HTTPS──▶  PostgREST  ──▶  Postgres   (commerce)
Drizzle      ──TCP───────────────────▶  Postgres   (social)
```

Drizzle connects as the service role, which bypasses row-level security. To
stop that becoming an accidental hole, **the social tables have RLS enabled
with zero policies** — anything arriving via `supabase-js` or PostgREST is
denied, so the tRPC layer is provably the only way in. Authorization lives in
`protectedProcedure`, by explicit design rather than omission.

**Storage is the exception.** Images are uploaded by the browser using the
signed-in user's own session, so no service-role key exists in the app at all.
There the bucket policies *are* the access control: every write is confined to
a folder named after the writer's user id. Which video or profile the uploaded
file gets attached to is still checked server-side in tRPC.

`public.users` is shared with the commerce app and keeps its own policies.

### The `users` table

Social does not get its own user table. Seidou's existing `public.users` was
extended, because `users.id` is already the Supabase auth id and every social
table keys off it. Two things to know before touching `social/db/schema.ts`:

1. **Every commerce column is declared there**, even though social never reads
   them, so `drizzle-kit` cannot propose dropping them.
2. **Only `socialUserColumns` may be sent to the browser.** Procedures spread
   the user row into their responses; the full row carries `email`, `phone`,
   `dob` and `cash_balance`.

### Styling

Seidou uses Tailwind v4 (CSS-first, no config); the clone used v3.

- Tokens live in `social/social.css`. A `@theme` block only *generates*
  utility classes, so adding them changed nothing for existing pages.
- shadcn's base layer is scoped to `[data-social]`, set on the social route's
  wrapper. Applied globally it would repaint all 20+ commerce pages.
- `dark:` utilities are deliberately neutralized. In Tailwind v4 `dark:`
  defaults to `prefers-color-scheme`, so without this every ported component
  would darken on a phone in dark mode while the rest of Seidou stayed light.
- `tw-animate-css` redefines the `delay-*` utility to mean `animation-delay`.
  `WordSearch.tsx` uses an explicit `[transition-delay:1.5s]` because of it.

### Two patterns worth knowing

**ErrorBoundary wraps Suspense, never the other way round.** Nested inside, it
cannot catch an error thrown by the suspending component.

**Protected pages resolve access before rendering.** A rejected
fire-and-forget `void trpc.x.prefetch()` aborts the streamed render and leaves
a blank shell — the page renders nothing but the nav. Every protected route
awaits its query first and then redirects or 404s.

### Routing

Everything is mounted under `/app-center/apps/seidou-social`, so all internal
navigation goes through `socialPath()` / `socialUrl()` in
`social/constants.ts` — the single place to change if the mount point moves.

---

## Layout

```
social/
  constants.ts        route helpers, DEFAULT_LIMIT
  social.css          design tokens, scoped base layer
  db/                 schema, connection, migrations
  trpc/               API layer
  lib/                utils, mux, storage, toast shim
  hooks/              useViewer, intersection observer
  components/         ui/ primitives + shared components
  modules/            one folder per feature
app/app-center/apps/seidou-social/   routes only (thin)
app/api/social/                      tRPC handler + Mux webhook
```

---

## Setup

| Variable | Needed for | Where |
|---|---|---|
| `DATABASE_URL` | Everything | Supabase → Connect → Transaction pooler |
| `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` | Upload + playback | Mux → Access Tokens |
| `MUX_WEBHOOK_SECRET` | Instant processing updates | Mux → Webhooks (optional, see below) |
| `NEXT_PUBLIC_APP_URL` | Share links, upload CORS | Your origin |

`DATABASE_URL` is a Postgres connection string, **not** the
`NEXT_PUBLIC_SUPABASE_URL` gateway — different host, port and protocol:

```
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

No service-role key is required.

### The Mux webhook is optional

Mux calls `/api/social/videos/webhook` when a video finishes transcoding.
Without it nothing breaks: the studio polls `videos.getStatus`, which asks Mux
directly while a video is non-terminal and stops once it is ready. The webhook
makes updates instant and removes the polling traffic.

In production the URL is just your domain. In development it needs a tunnel
(`ngrok http 3000`), which is why polling exists — so local work needs no
tunnel at all.
