-- ============================================================================
-- Ability Fruit: CLONE FRUIT — duplicate any ability fruit you own (+2 copies).
-- Run this in the Supabase SQL editor AFTER landwars_fruit_cooldowns.sql
-- (cooldown helpers) and landwars_freeze_bid.sql (frozen guard).
--
-- MECHANIC (master prompt + video): the player picks a fruit from their
-- possession and the Clone Fruit creates 2 extra copies of it (x1 becomes x3,
-- x2 becomes x4 — formula After = Current + 2). No server-side fruit inventory
-- exists yet, so possession lives in the client per-auction ledger
-- (lib/fruitUsage.ts): what this RPC does is apply the same rules every other
-- fruit RPC does — validate the target, refuse while frozen, and start the
-- Clone Fruit's 20s cooldown. The client then consumes one Clone Fruit use and
-- grants +2 uses of the chosen fruit.
--
-- CLONABLE SET: every playable fruit EXCEPT the Clone fruit itself (edge case:
-- "prevent infinite loop" — the Clone fruit can never be cloned). Note that
-- the Copy fruit IS clonable: it is a different fruit. Keep in step with
-- CLONABLE_FRUIT_IDS in lib/abilityFruits.ts.
-- ============================================================================

create or replace function public.clone_ability(
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
  v_clonable text[] := array['multiply','divide','swap','freeze','thief','negate','restore','copy'];
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  -- The Clone fruit is the one fruit that can never be cloned.
  if p_target_fruit_id is null or not (p_target_fruit_id = any(v_clonable)) then
    raise exception 'That fruit cannot be cloned — the Clone fruit can never be cloned';
  end if;

  -- COOLDOWN GUARD: the Clone Fruit has the same 20s cooldown as every fruit.
  perform public.assert_fruit_cooldown(p_auction_id, v_actor_id, 'clone', 'Clone Fruit');

  -- FROZEN GUARD: the Negate fruit is the only fruit that works while frozen.
  if public.is_freeze_active(p_auction_id, v_actor_id) then
    raise exception 'You are currently frozen — wait for the Freeze Fruit to wear off before using a fruit';
  end if;

  -- Start the cooldown (same transaction: a failure above rolls this back, so
  -- a refused clone never costs the player a cooldown).
  perform public.bump_fruit_cooldown(p_auction_id, v_actor_id, 'clone');

  return json_build_object(
    'success',          true,
    'target_fruit_id',  p_target_fruit_id,
    'copies',           2
  );
end;
$$;

revoke all on function public.clone_ability(uuid, text) from public;
grant execute on function public.clone_ability(uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- REMINDER — the client grant lives in lib/fruitUsage.ts: on success the page
-- calls recordFruitUse(auctionId, 'clone') (the Clone fruit is consumed) and
-- grantFruitBonus(auctionId, target, 2) (After = Current + 2). It flips to a
-- real inventory API once fruits are purchasable, like the Copy fruit.
-- ----------------------------------------------------------------------------