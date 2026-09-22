-- ============================================================================
-- Ability Fruit: NEGATE — cancel the last effect that hit you.
-- Run this in the Supabase SQL editor AFTER landwars_bid_effects.sql AND
-- landwars_fruit_cooldowns.sql (its cooldown guard calls into that file).
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
-- EXCEPTION — SWAP undoes BOTH halves: a swap moves two bids and writes TWO
-- rows (one per participant, sharing the same transaction created_at). When
-- the top effect is a swap, the RPC also restores the OTHER player, so the
-- swap is fully undone instead of leaving both parties on the swapped-out
-- side at zero.
--
-- PAIRING: the sibling row is matched on (auction_id, actor_user_id,
-- effect_type='swap', created_at) with a different target_user_id. All fruit
-- rows are written inside one security-definer transaction, so the two swap
-- rows always share the identical created_at.
--
-- RULES from the sheet:
--   - Only the MOST RECENT effect is undone — one entry per activation.
--   - It does NOT prevent future effects: nothing is shielded afterwards.
--   - Activation is refused when the stack is empty ("no recent effect").
--   - The fruit has a cooldown (15-20s); 20s here, and the client mirrors it
--     from FRUIT_COOLDOWN_S in lib/abilityFruits.ts. It lives on the shared
--     public.fruit_cooldowns ledger with every other fruit (run
--     landwars_fruit_cooldowns.sql first, then re-run this file).
--
-- SWAP CAN ONLY BE UNDONE ONCE: the pair of swap rows is flagged negated in
-- the SAME shot (this file's partner block marks both), and the stack query
-- only ever surfaces un-negated rows. So after a swap has been negated — by
-- either party — both rows are consumed, that swap vanishes from both stacks,
-- and a SECOND Negate is refused with "No recent effect to negate" instead of
-- re-swapping the pair. A fresh effect (e.g. a Divide aimed at you afterwards)
-- is a brand new stack entry and can be negated normally.
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
  v_cooldown_s   int  := 20;          -- keep in step with FRUIT_COOLDOWN_S
  v_bid          numeric;
  v_effect       record;
  v_partner      record;              -- the OTHER half of my swap, if any
  v_partner_bid  numeric;
  v_partner_new  numeric;
  v_new_bid      numeric;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  -- COOLDOWN: the shared per-fruit ledger (landwars_fruit_cooldowns.sql).
  -- Negate is exempt from the FREEZE guard but NOT from the cooldown.
  perform public.assert_fruit_cooldown(p_auction_id, v_actor_id, 'negate', 'Negate Fruit');

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

  -- SWAP UNDO — the swap wrote TWO rows (one per participant) inside the same
  -- transaction, so both share the same created_at. Undo the OTHER half too:
  -- the partner's bid is put back to what it was before the swap, never left
  -- stranded at the swapped-down value. If the partner already negated their
  -- own half first, skip them (their side is done; only rewrite mine).
  if v_effect.effect_type = 'swap' then
    select * into v_partner
      from public.bid_effects
     where auction_id      = p_auction_id
       and actor_user_id   = v_effect.actor_user_id
       and effect_type     = 'swap'
       and created_at      = v_effect.created_at
       and target_user_id <> v_actor_id
       and not negated
     order by created_at desc, id desc
     limit 1
     for update;

    if found then
      select "bidAmount" into v_partner_bid
        from public."Bids"
       where "auctionId" = p_auction_id
         and "userId" = v_partner.target_user_id;

      v_partner_new := greatest(
        coalesce(v_partner_bid, 0) + (v_partner.bid_before - v_partner.bid_after),
        0
      );

      update public."Bids"
         set "bidAmount" = v_partner_new
       where "auctionId" = p_auction_id
         and "userId" = v_partner.target_user_id;

      update public.bid_effects
         set negated = true,
             negated_at = clock_timestamp()
       where id = v_partner.id;
    end if;
  end if;

  -- Record the activation itself as history (audit trail). It is flagged
  -- negated up front so it can never become the target of another Negate, and
  -- a Negate is never undone by one. The COOLDOWN lives on the shared
  -- public.fruit_cooldowns ledger, NOT on this row.
  insert into public.bid_effects (
    auction_id, target_user_id, actor_user_id, effect_type,
    bid_before, bid_after, negated, negated_at
  )
  values (
    p_auction_id, v_actor_id, v_actor_id, 'negate',
    coalesce(v_bid, 0), v_new_bid, true, clock_timestamp()
  );

  -- Start the cooldown on this fruit (same transaction: any later failure
  -- rolls this row back, so a failed cast never spends the cooldown).
  perform public.bump_fruit_cooldown(p_auction_id, v_actor_id, 'negate');

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

  -- COOLDOWN shared with the commit, so the client countdown never drifts from
  -- what negate_bid enforces.
  v_remaining := public.fruit_cooldown_remaining(p_auction_id, v_actor_id, 'negate');

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
