-- ============================================================================
-- CATALOGUE CATEGORIES — extra shop categories for imported products
-- ----------------------------------------------------------------------------
-- Products imported from ASOS, Temu and SHEIN (table catalogue_products) are
-- put in categories by keywords in their title (lib/catalogue.ts). Most fit an
-- existing Sanity category. The ones Sanity has no category for live here, in
-- Supabase, so Sanity is not changed.
--
-- Each row sits under a parent: a Sanity category slug (e.g. 'men-s-tops') or
-- another row here. The app shows these next to the Sanity sub-categories on
-- /explore/<parent> and includes them in the Home category tabs.
--
-- To add a category: insert a row here, then add a keyword rule for its slug
-- in lib/catalogue.ts (RULES or MEN_RULES).
--
-- Run once in the Supabase SQL editor. Safe to run again.
-- ============================================================================

begin;

create table if not exists public.catalogue_categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  parent_slug text,                 -- Sanity category slug or another slug here
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.catalogue_categories enable row level security;

drop policy if exists "Catalogue categories are publicly readable" on public.catalogue_categories;
create policy "Catalogue categories are publicly readable"
  on public.catalogue_categories
  for select
  using (true);

drop policy if exists "Service role can manage catalogue categories" on public.catalogue_categories;
create policy "Service role can manage catalogue categories"
  on public.catalogue_categories
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- The categories imported products needed that Sanity does not have
-- (25 Nov 2026). Existing rows are left as they are.
insert into public.catalogue_categories (slug, title, parent_slug, sort_order) values
  ('short-sleeve-shirts',      'Short Sleeve Shirts',          'men-s-tops',          10),
  ('scarves-gloves-headbands', 'Scarves, Gloves & Headbands',  'women-s-accessories', 10),
  ('women-s-belts',            'Belts (W)',                    'women-s-accessories', 20),
  ('jumpsuits',                'Jumpsuits',                    'women-s-tops',        10),
  ('lingerie',                 'Lingerie',                     'fashion-women',       10)
on conflict (slug) do nothing;

commit;
