-- ============================================================================
-- Ability Fruit: NEGATE — cancel the last effect that hit you.
-- Run this in the Supabase SQL editor AFTER landwars_bid_effects.sql.
--
-- MECHANIC (design sheet): "When activated, the fruit removes the most recent
-- effect that affected the user and restores their original bid amount."
-- EFFECT: "Negates the effect and restores the user's previous bid amount
-- before the effect was applied."
--
-- So the RPC pops the top of the caller's effect stack (public.bid_effects),
-- flags that entry as negated and puts the bid back. SELF ONLY: the row that
-- moves is always the caller's, read from auth.uid() and never from the
-- request body, so a crafted call cannot rewind anyone else's bid.
--
-- RULES from the sheet:
--   - Only the MOST RECENT effect is undone — one entry per activation.
--   - It does NOT prevent future effects: nothing is shielded afterwards.
--   - Activation is refused when the stack is empty ("no recent effect").
--   - The fruit has a cooldown (15-20s); 20s here, and the client mirrors it
--     from NEGATE_COOLDOWN_S in lib/abilityFruits.ts.
--
-- WHY THE BID IS PUT BACK BY DELTA, NOT BY ASSIGNMENT: the restore is written
-- as current + (bid_before - bid_after). When nothing has touched the bid
-- since the effect landed — the case the sheet draws, frames 4 to 7 — that is
-- exactly bid_before. When the player has raised their bid in between, the
-- raise is kept and only the effect itself is undone, which is what "negates
-- the effect" means.
-- ============================================================================

create or replace function public.negate_bid(p_auction_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id     uuid := auth.uid();
  v_cooldown_s   int  := 20;          -- keep in step with NEGATE_COOLDOWN_S
  v_last_negate  timestamptz;
  v_wait_s       int;
  v_bid          numeric;
  v_effect       record;
  v_new_bid      numeric;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  -- COOLDOWN: the previous activation is itself recorded in the stack, so the
  -- cooldown reads straight off the history.
  select max(created_at) into v_last_negate
    from public.bid_effects
   where auction_id = p_auction_id
     and actor_user_id = v_actor_id
     and effect_type = 'negate';

  if v_last_negate is not null
     and clock_timestamp() - v_last_negate < make_interval(secs => v_cooldown_s) then
    v_wait_s := ceil(v_cooldown_s - extract(epoch from (clock_timestamp() - v_last_negate)));
    raise exception 'Negate Fruit is still cooling down — % more second(s)', greatest(v_wait_s, 1);
  end if;

  -- The activator must be on the table for there to be a bid to restore.
  select "bidAmount" into v_bid
    from public."Bids"
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id
   for update;

  if not found then
    raise exception 'Place a bid on this table before using a fruit';
  end if;

  -- TOP OF THE STACK: the newest effect that hit ME and has not been negated.
  -- 'negate' rows are skipped so a Negate can never undo another Negate.
  select * into v_effect
    from public.bid_effects
   where auction_id = p_auction_id
     and target_user_id = v_actor_id
     and not negated
     and effect_type <> 'negate'
   order by created_at desc, id desc
   limit 1
   for update;

  if not found then
    raise exception 'No recent effect to negate';
  end if;

  v_new_bid := greatest(coalesce(v_bid, 0) + (v_effect.bid_before - v_effect.bid_after), 0);

  update public."Bids"
     set "bidAmount" = v_new_bid
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id;

  -- "Negate removes the last effect ... and clears that entry."
  update public.bid_effects
     set negated = true,
         negated_at = clock_timestamp()
   where id = v_effect.id;

  -- Record the activation itself: it is what the cooldown reads, and it is
  -- flagged negated up front so it can never become a target of another
  -- Negate (and so a Negate is never undone by one).
  insert into public.bid_effects (
    auction_id, target_user_id, actor_user_id, effect_type,
    bid_before, bid_after, negated, negated_at
  )
  values (
    p_auction_id, v_actor_id, v_actor_id, 'negate',
    coalesce(v_bid, 0), v_new_bid, true, clock_timestamp()
  );

  return json_build_object(
    'success',          true,
    'user_id',          v_actor_id,
    'previous_bid',     coalesce(v_bid, 0),
    'bidAmount',        v_new_bid,
    'effect_type',      v_effect.effect_type,
    'effect_actor_id',  v_effect.actor_user_id,
    'effect_before',    v_effect.bid_before,
    'effect_after',     v_effect.bid_after,
    'cooldown_seconds', v_cooldown_s
  );
end;
$$;

revoke all on function public.negate_bid(uuid) from public;
grant execute on function public.negate_bid(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- peek_bid_effect — read-only look at the top of the caller's stack.
--
-- DEV NOTE (design): "Prevent Negate activation if no recent effect exists."
-- The table page calls this BEFORE it plays a single frame, so a player never
-- watches the whole sequence only to be told there was nothing to undo. It
-- also hands back the amount the bid will be restored to, which is what the
-- animation counts up to, and the seconds left on the cooldown.
-- ----------------------------------------------------------------------------
create or replace function public.peek_bid_effect(p_auction_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id    uuid := auth.uid();
  v_cooldown_s  int  := 20;
  v_last_negate timestamptz;
  v_remaining   int  := 0;
  v_bid         numeric;
  v_effect      record;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  select max(created_at) into v_last_negate
    from public.bid_effects
   where auction_id = p_auction_id
     and actor_user_id = v_actor_id
     and effect_type = 'negate';

  if v_last_negate is not null then
    v_remaining := greatest(
      0,
      ceil(v_cooldown_s - extract(epoch from (clock_timestamp() - v_last_negate)))::int
    );
  end if;

  select "bidAmount" into v_bid
    from public."Bids"
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id;

  select * into v_effect
    from public.bid_effects
   where auction_id = p_auction_id
     and target_user_id = v_actor_id
     and not negated
     and effect_type <> 'negate'
   order by created_at desc, id desc
   limit 1;

  if not found then
    return json_build_object(
      'has_effect',        false,
      'on_table',          v_bid is not null,
      'cooldown_remaining', v_remaining
    );
  end if;

  return json_build_object(
    'has_effect',        true,
    'on_table',          v_bid is not null,
    'cooldown_remaining', v_remaining,
    'effect_type',       v_effect.effect_type,
    'effect_actor_id',   v_effect.actor_user_id,
    'effect_before',     v_effect.bid_before,
    'effect_after',      v_effect.bid_after,
    'created_at',        v_effect.created_at,
    'bidAmount',         coalesce(v_bid, 0),
    -- what the bid becomes once the effect is undone (see the delta note above)
    'restored_bid',      greatest(coalesce(v_bid, 0) + (v_effect.bid_before - v_effect.bid_after), 0)
  );
end;
$$;

revoke all on function public.peek_bid_effect(uuid) from public;
grant execute on function public.peek_bid_effect(uuid) to authenticated;
