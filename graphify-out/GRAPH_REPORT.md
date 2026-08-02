# Graph Report - C:\Users\Amina\Desktop\seidou  (2026-08-02)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 333 nodes · 627 edges · 17 communities (11 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2a25d602`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- createClient
- dependencies
- CrashGame.tsx
- app/page.tsx
- store.ts
- devDependencies
- compilerOptions
- HomeHeader.tsx
- PageLayout.tsx
- auction/page.tsx
- createClient
- bulk-sanity-algolia-upload.mjs
- store/page.tsx
- profile/wallet/page.tsx
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 31 edges
2. `RootState` - 20 edges
3. `useAuth()` - 18 edges
4. `compilerOptions` - 16 edges
5. `PageLayout()` - 14 edges
6. `Button()` - 11 edges
7. `AudioSystem` - 9 edges
8. `Modal()` - 9 edges
9. `ProductInfo()` - 9 edges
10. `formatCurrency()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `AuctionWalletPage()` --calls--> `useAuth()`  [EXTRACTED]
  app/auction/wallet/page.tsx → hooks/useAuth.tsx
- `ProfilePage()` --calls--> `createClient()`  [EXTRACTED]
  app/profile/page.tsx → lib/supabase/client.ts
- `POST()` --calls--> `createClient()`  [EXTRACTED]
  app/api/auction/bid/route.ts → lib/supabase/server.ts
- `GET()` --calls--> `createClient()`  [EXTRACTED]
  app/api/loyalty-rewards/route.ts → lib/supabase/server.ts
- `POST()` --calls--> `createClient()`  [EXTRACTED]
  app/api/loyalty-rewards/route.ts → lib/supabase/server.ts

## Import Cycles
- None detected.

## Communities (17 total, 6 thin omitted)

### Community 0 - "createClient"
Cohesion: 0.06
Nodes (44): Game, GamesPage(), Bid, LeaderboardPage(), Auction, formatDate(), formatTime(), FreeAuctionPage() (+36 more)

### Community 1 - "dependencies"
Cohesion: 0.06
Nodes (35): algoliasearch, axios, @heroicons/react, lucide-react, motion, next, next-sanity, dependencies (+27 more)

### Community 2 - "CrashGame.tsx"
Cohesion: 0.09
Nodes (9): AudioSystem, CrashGame(), crashGameSlice, CrashGameState, GameState, HistoryItem, initialState, PlayerBet (+1 more)

### Community 3 - "app/page.tsx"
Cohesion: 0.11
Nodes (18): ExploreSearchBar(), searchClient, ProductContainer(), Props, Props, SmallLoader(), WelcomeModal(), WelcomeModalProps (+10 more)

### Community 4 - "store.ts"
Cohesion: 0.18
Nodes (18): CategoryProductsPage(), ProfileLayout(), Cart(), CartItem(), Props, FullScreenLoader(), Props, ProductInfo() (+10 more)

### Community 5 - "devDependencies"
Cohesion: 0.07
Nodes (28): dotenv, eslint, eslint-config-next, devDependencies, dotenv, eslint, eslint-config-next, tailwindcss (+20 more)

### Community 6 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 7 - "HomeHeader.tsx"
Cohesion: 0.10
Nodes (15): inter, metadata, Badge(), Props, Footer(), Props, HomeHeader(), Props (+7 more)

### Community 8 - "PageLayout.tsx"
Cohesion: 0.16
Nodes (7): Category, BigCard(), Props, Header(), Props, PageLayout(), Props

### Community 9 - "auction/page.tsx"
Cohesion: 0.18
Nodes (8): ProfilePage(), ConfettiIcon(), Props, GamepadIcon(), Props, AuctionCategoryCard(), IconListItem(), Props

### Community 10 - "createClient"
Cohesion: 0.52
Nodes (4): POST(), GET(), POST(), createClient()

## Knowledge Gaps
- **116 isolated node(s):** `Game`, `Bid`, `Auction`, `WORDS_BY_THEME`, `Cell` (+111 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RootState` connect `store.ts` to `createClient`, `CrashGame.tsx`, `app/page.tsx`, `HomeHeader.tsx`, `PageLayout.tsx`, `auction/page.tsx`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Why does `createClient()` connect `createClient` to `PageLayout.tsx`, `auction/page.tsx`, `store.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `PageLayout()` connect `PageLayout.tsx` to `createClient`, `auction/page.tsx`, `CrashGame.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `Game`, `Bid`, `Auction` to the rest of the system?**
  _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `createClient` be split into smaller, more focused modules?**
  _Cohesion score 0.06442307692307692 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `CrashGame.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09425287356321839 - nodes in this community are weakly interconnected._