-- ============================================================================
-- Ability Fruit: COPY FRUIT — copy any one of the last 3 ability fruits used
-- on this table. Run this in the Supabase SQL editor AFTER
-- landwars_bid_effects.sql (history source) AND landwars_fruit_cooldowns.sql
-- (cooldown helpers), and after landwars_freeze_bid.sql (frozen guard).
--
-- MECHANIC (master prompt + video): when the player activates the Copy Fruit a
-- picker opens listing the last 3 ability fruits used by ANY player BEFORE the
-- fruit was used. Choosing one copies it into the player's abilities.
--
-- Two RPCs:
--   peek_copy_history — read-only: the last 3 DISTINCT ability fruits used on
--                       the auction (each fruit once, most recent use), drawn
--                       from public.bid_effects activations, plus how many
--                       seconds ago. The picker renders this.
--   copy_ability      — the commit: validates the target, starts the fruit's
--                       cooldown, and returns success. The client then grants
--                       the copied ability in its own per-auction ledger.
--
-- COPPABLE SET: every playable fruit EXCEPT Copy Fruit itself (the prompt's
-- edge case: "Cannot copy another Copy Fruit"). Keep in step with
-- COPYABLE_FRUIT_IDS in lib/abilityFruits.ts. 'restore' is included because it
-- is a playable fruit, though it never writes a bid_effects row so it will not
-- actually show up in the history until it does.
--
-- RECENCY WINDOW: only activations from the last 10 minutes count, so a stale
-- table from an earlier session does not hand out ancient abilities.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- peek_copy_history — the last 3 distinct coppable fruits used on the auction.
-- Clients can only call this read-only; granted to authenticated.
-- ----------------------------------------------------------------------------
create or replace function public.peek_copy_history(p_auction_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_row      record;
  v_out      json[] := array[]::json[];
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  for v_row in
    select effect_type,
           max(created_at) as last_used
      from public.bid_effects
     where auction_id = p_auction_id
       and effect_type = any (
         array['multiply','divide','swap','freeze','thief','negate','restore']
       )
       and created_at >= clock_timestamp() - interval '10 minutes'
     group by effect_type
     order by max(created_at) desc
     limit 3
  loop
    v_out := array_append(v_out, json_build_object(
      'fruit_id',    v_row.effect_type,
      'seconds_ago', greatest(
        0,
        floor(extract(epoch from (clock_timestamp() - v_row.last_used)))::int
      )
    ));
  end loop;

  return json_build_object('history', v_out);
end;
$$;

revoke all on function public.peek_copy_history(uuid) from public;
grant execute on function public.peek_copy_history(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- copy_ability — the commit. Validates the target fruit, refuses while frozen
-- or while the Copy Fruit itself is cooling down, then starts the cooldown so
-- a player cannot chain copies every second.
-- ----------------------------------------------------------------------------
create or replace function public.copy_ability(
  p_auction_id uuid,
  p_target_fruit_id text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_coppable text[] := array['multiply','divide','swap','freeze','thief','negate','restore'];
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  -- Cannot copy Copy Fruit (or anything that is not a real ability fruit).
  if p_target_fruit_id is null or not (p_target_fruit_id = any(v_coppable)) then
    raise exception 'That ability cannot be copied';
  end if;

  -- COOLDOWN GUARD: the Copy Fruit has the same 20s cooldown as every fruit.
  perform public.assert_fruit_cooldown(p_auction_id, v_actor_id, 'copy', 'Copy Fruit');

  -- FROZEN GUARD: the Negate fruit is the only fruit that works while frozen.
  if public.is_freeze_active(p_auction_id, v_actor_id) then
    raise exception 'You are currently frozen — wait for the Freeze Fruit to wear off before using a fruit';
  end if;

  -- Start the cooldown (same transaction: a failure above rolls this back, so
  -- a refused copy never costs the player a cooldown).
  perform public.bump_fruit_cooldown(p_auction_id, v_actor_id, 'copy');

  return json_build_object(
    'success',          true,
    'target_fruit_id',  p_target_fruit_id
  );
end;
$$;

revoke all on function public.copy_ability(uuid, text) from public;
grant execute on function public.copy_ability(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- REMINDER — the client grants the copied ability in its OWN per-auction
-- ledger (lib/fruitUsage.ts, grantFruitBonus) and consumes one Copy Fruit use
-- (recordFruitUse 'copy') when the copy lands. There is no server-side
-- inventory yet; like restore's fruit half, that flips to a real inventory API
-- once fruits are purchasable.
-- ----------------------------------------------------------------------------