-- ============================================================================
-- Ability Fruit: DIVIDE — atomic bid-divide RPC
-- Run this in the Supabase SQL editor.
--
-- The DIVIDE fruit ALWAYS hits whoever currently holds FIRST POSITION on the
-- leaderboard. The target is derived inside the RPC from the highest bid on
-- the auction — it is never taken from the request body, so a crafted call
-- cannot aim it at an arbitrary player.
--
-- Divides the #1 bid by a factor (÷2, ÷3, ÷4) and ROUNDS DOWN. Clamps the
-- result so it can never drop below 1. Realtime on "Bids" keeps every client
-- in sync after the RPC commits.
-- ============================================================================

create or replace function public.divide_bid(
  p_auction_id uuid,
  p_factor numeric default 2
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id  uuid := auth.uid();
  v_target    record;
  v_new_bid   numeric;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  -- Design spec: default ÷2, upgradeable to ÷3 / ÷4.
  if p_factor is null or p_factor < 2 or p_factor > 4 then
    raise exception 'Invalid divide factor';
  end if;

  -- ALWAYS first position: the row with the highest bid, locked for update.
  select "userId", "bidAmount" into v_target
    from public."Bids"
   where "auctionId" = p_auction_id
   order by "bidAmount" desc
   limit 1
   for update;

  if not found then
    raise exception 'No bids on this table yet';
  end if;

  -- Round down, and never let a bid fall below 1.
  v_new_bid := greatest(floor(v_target."bidAmount" / p_factor), 1);

  update public."Bids"
     set "bidAmount" = v_new_bid
   where "auctionId" = p_auction_id
     and "userId" = v_target."userId";

  return json_build_object(
    'success',          true,
    'target_user_id',   v_target."userId",
    'previous_bid',     v_target."bidAmount",
    'bidAmount',        v_new_bid,
    'factor',           p_factor
  );
end;
$$;

revoke all on function public.divide_bid(uuid, numeric) from public;
grant execute on function public.divide_bid(uuid, numeric) to authenticated;