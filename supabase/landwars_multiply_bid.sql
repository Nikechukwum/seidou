-- ============================================================================
-- Ability Fruit: MULTIPLY — atomic bid-multiply RPC
-- Run this in the Supabase SQL editor.
--
-- SELF ONLY: a player may only multiply their OWN bid. The row that gets
-- multiplied is always the caller's, taken from auth.uid() and never from the
-- request body, so a crafted call cannot touch anyone else's bid.
--
-- Multiplies the caller's bid in an auction by a factor, capped at
-- maxBidLimit (same cap the UI applies). Realtime on "Bids" keeps every client
-- in sync after the RPC commits.
-- ============================================================================

create or replace function public.multiply_bid(
  p_auction_id uuid,
  p_target_user_id uuid default null,   -- kept for call compatibility; must be the caller
  p_factor numeric default 2,
  p_max_bid_limit numeric default 50000000
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id  uuid := auth.uid();
  v_existing  record;
  v_new_bid   numeric;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  -- SELF ONLY: reject any attempt to aim this at another player.
  if p_target_user_id is not null and p_target_user_id <> v_actor_id then
    raise exception 'You can only multiply your own bid';
  end if;

  -- Design spec: default x2, upgradeable to x3 / x4 / x5.
  if p_factor is null or p_factor < 2 or p_factor > 5 then
    raise exception 'Invalid multiply factor';
  end if;

  -- Always the caller's own row.
  select id, "bidAmount" into v_existing
    from public."Bids"
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id
   for update;

  if not found then
    raise exception 'Place a bid on this table before using a fruit';
  end if;

  -- Cap the result at the max bid limit (mirrors the UI rule)
  v_new_bid := least(floor(v_existing."bidAmount" * p_factor), p_max_bid_limit);

  update public."Bids"
     set "bidAmount" = v_new_bid
   where id = v_existing.id;

  return json_build_object(
    'success',          true,
    'target_user_id',   v_actor_id,
    'previous_bid',     v_existing."bidAmount",
    'bidAmount',        v_new_bid,
    'factor',           p_factor
  );
end;
$$;

revoke all on function public.multiply_bid(uuid, uuid, numeric, numeric) from public;
grant execute on function public.multiply_bid(uuid, uuid, numeric, numeric) to authenticated;
