-- ============================================================================
-- Seidou: expose usernames for the Land Wars Table leaderboard.
--
-- The `users` table is protected by RLS, so the browser cannot read other
-- users' usernames directly (that is why every card shows "Unknown"). This
-- security-definer RPC returns ONLY (user_id, username) pairs and nothing else,
-- so it is safe to call from the client.
--
-- Run this in the Supabase SQL editor.
-- ============================================================================

create or replace function public.get_public_usernames(user_ids uuid[])
returns table (user_id uuid, username text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select u.id as user_id, u.username
      from public.users u
     where u.id = any(user_ids)
       and u.username is not null;
end;
$$;

revoke all on function public.get_public_usernames(uuid[]) from public;
grant execute on function public.get_public_usernames(uuid[]) to authenticated;
