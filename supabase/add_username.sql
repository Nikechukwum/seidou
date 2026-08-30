-- ============================================================================
-- Seidou: add username column to the users table (My Details update)
-- Run this in the Supabase SQL editor (or via migration).
--
-- The app stores user profiles on the existing `users` table. The address
-- fields (address_line1, address_line2, state) already exist there from the
-- old Address Book page, so only `username` is added here.
-- ============================================================================

alter table public.users
  add column if not exists username text;

-- Usernames must be unique (when set). Partial index keeps multiple NULLs legal.
create unique index if not exists users_username_unique_key
  on public.users (username)
  where username is not null;
