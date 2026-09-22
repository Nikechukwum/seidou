-- ============================================================================
-- Ability Fruit: STEAL BIDDING CURRENCY — atomic multi-target steal RPC
-- Run this in the Supabase SQL editor (replaces the old single-take version).
--
-- The fruit requires NO targeting. Two-step drain, mirroring the 60s visual:
--   1) p_per_second BC is taken from EVERY other player each tick (the UI
--      ticks 60 times, so a full drain is p_per_second * p_seconds per player).
--   2) Once p_seconds has elapsed, the pooled total lands on the activator's
--      OWN bid, all at once.
-- Anyone whose balance is exhausted mid-countdown simply loses the rest (the
-- take is capped by their balance). All rows are locked and updated in one
-- transaction so the board stays consistent. Realtime on "Bids" keeps every
-- client in sync.
--
-- EFFECT HISTORY: every bid this fruit moves is recorded in public.bid_effects
-- so the NEGATE fruit can undo it. Run supabase/landwars_bid_effects.sql first,
-- then re-run this file.
--
-- COOLDOWN: every fruit shares the negate-style cooldown. Run
-- landwars_fruit_cooldowns.sql first, then re-run this file so this RPC's
-- cooldown guard resolves.
-- ============================================================================

create or replace function public.steal_bids(
  p_auction_id uuid,
  p_per_second numeric default 1000,
  p_seconds int default 60
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id   uuid := auth.uid();
  v_actor_bid  numeric := 0;
  v_target     record;
  v_rate       numeric;
  v_take       numeric;
  v_total      numeric := 0;
  v_out        json[] := array[]::json[];
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  -- COOLDOWN GUARD: a fruit cannot be cast again within 20s of its last cast.
  perform public.assert_fruit_cooldown(p_auction_id, v_actor_id, 'thief', 'Steal Bidding Currency');

  if p_per_second is null or p_per_second <= 0 then
    raise exception 'Invalid steal rate';
  end if;

  if p_seconds is null or p_seconds <= 0 then
    raise exception 'Invalid steal duration';
  end if;

  -- FROZEN GUARD (Freeze Fruit): a frozen player cannot use a fruit. Run
  -- landwars_freeze_bid.sql first, then re-run this file so the guard resolves.
  if public.is_freeze_active(p_auction_id, v_actor_id) then
    raise exception 'You are currently frozen — wait for the Freeze Fruit to wear off before using a fruit';
  end if;

  -- The activator must actually be on the table to collect the stolen BC.
  select "bidAmount" into v_actor_bid
    from public."Bids"
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id
   for update;

  if not found then
    raise exception 'Place a bid on this table before using a fruit';
  end if;

  v_rate := p_per_second * p_seconds;

  -- Drain every other player. The take is capped by their balance, so a
  -- player who runs out mid-countdown is never pushed below zero.
  for v_target in
    select "userId" as u, "bidAmount" as b
      from public."Bids"
     where "auctionId" = p_auction_id
       and "userId" <> v_actor_id
       and "bidAmount" > 0
     for update
  loop
    v_take := least(v_rate, v_target.b);

    update public."Bids"
       set "bidAmount" = v_target.b - v_take
     where "auctionId" = p_auction_id
       and "userId" = v_target.u;

    -- Each drained player gets their own stack entry (value before the drain).
    perform public.record_bid_effect(
      p_auction_id, v_target.u, v_actor_id, 'thief',
      v_target.b, v_target.b - v_take
    );

    v_total := v_total + v_take;
    v_out := array_append(v_out, json_build_object(
      'user_id',   v_target.u,
      'previous',  v_target.b::numeric,
      'new',       (v_target.b - v_take)::numeric
    ));
  end loop;

  if v_total = 0 then
    raise exception 'No one on this table has bidding currency to steal';
  end if;

  -- Pool everything onto the activator's bid, all at once.
  update public."Bids"
     set "bidAmount" = v_actor_bid + v_total
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id;

  -- ...and the pooled gain lands on the thief's own stack.
  perform public.record_bid_effect(
    p_auction_id, v_actor_id, v_actor_id, 'thief',
    v_actor_bid, v_actor_bid + v_total
  );

  -- Start the cooldown on this fruit (same transaction: any later failure
  -- rolls this row back, so a failed cast never spends the cooldown).
  perform public.bump_fruit_cooldown(p_auction_id, v_actor_id, 'thief');

  return json_build_object(
    'success',       true,
    'actor_id',      v_actor_id,
    'actor_previous', v_actor_bid,
    'actor_new',     v_actor_bid + v_total,
    'total_stolen',  v_total,
    'targets',       v_out
  );
end;
$$;

revoke all on function public.steal_bids(uuid, numeric, int) from public;
grant execute on function public.steal_bids(uuid, numeric, int) to authenticated;