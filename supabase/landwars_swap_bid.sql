-- ============================================================================
-- Ability Fruit: POSITION SWAP — atomic two-bid swap RPC
-- Run this in the Supabase SQL editor.
--
-- The fruit requires NO targeting. It locks onto the player who currently
-- holds FIRST position on the auction, then the two bid AMOUNTS change hands:
--   - the activator takes the leader's bid (jumping straight to #1), and
--   - the former leader takes whatever the activator had bid.
-- Their usernames and rows stay put; only the monetary values move.
-- The activator cannot swap when they already hold (or tie for) first place —
-- the RPC rejects that with a friendly message, mirroring the UI toast.
-- Both rows are locked and updated in one transaction, so the board stays
-- consistent. Realtime on "Bids" keeps every client in sync.
--
-- EFFECT HISTORY: every bid this fruit moves is recorded in public.bid_effects
-- so the NEGATE fruit can undo it. Run supabase/landwars_bid_effects.sql first,
-- then re-run this file.
-- ============================================================================

create or replace function public.swap_positions(p_auction_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id   uuid := auth.uid();
  v_actor_bid  numeric;
  v_target     record;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  -- The activator must actually be on the table to trade bids.
  select "bidAmount" into v_actor_bid
    from public."Bids"
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id
   for update;

  if not found then
    raise exception 'Place a bid on this table before using a fruit';
  end if;

  -- Lock whoever holds the top bid on the table (the activator included, so
  -- that the "already first" check below is trivially correct).
  select "userId" as u, "bidAmount" as b
    into v_target
    from public."Bids"
   where "auctionId" = p_auction_id
   order by "bidAmount" desc
   limit 1
   for update;

  if not found then
    raise exception 'No bids on this table yet';
  end if;

  -- Already (or tied for) first position means there is nothing to swap for.
  if v_target.u = v_actor_id or v_target.b = v_actor_bid then
    raise exception 'You are already in first place';
  end if;

  -- Trade the two bid amounts.
  update public."Bids"
     set "bidAmount" = v_target.b
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id;

  update public."Bids"
     set "bidAmount" = v_actor_bid
   where "auctionId" = p_auction_id
     and "userId" = v_target.u;

  -- A swap moves TWO bids, so BOTH players get an entry on their stack: the
  -- player who was swapped out of first place can Negate their way back.
  perform public.record_bid_effect(
    p_auction_id, v_actor_id, v_actor_id, 'swap', v_actor_bid, v_target.b
  );
  perform public.record_bid_effect(
    p_auction_id, v_target.u, v_actor_id, 'swap', v_target.b, v_actor_bid
  );

  return json_build_object(
    'success',        true,
    'actor_id',       v_actor_id,
    'actor_previous', v_actor_bid,
    'actor_new',      v_target.b,
    'leader_id',      v_target.u,
    'leader_previous', v_target.b,
    'leader_new',     v_actor_bid
  );
end;
$$;

revoke all on function public.swap_positions(uuid) from public;
grant execute on function public.swap_positions(uuid) to authenticated;