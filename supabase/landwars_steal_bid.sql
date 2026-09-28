-- ============================================================================
-- Ability Fruit: STEAL BIDDING CURRENCY — atomic drain COMMIT for the
-- interaction system. Run this file in the Supabase SQL editor AFTER
-- landwars_ability_interactions.sql (the cast + sweep that parks the steal)
-- AND landwars_bid_effects.sql (effect history). The old
-- steal_bids(uuid, numeric, int) overload is dropped here; the drain now has
-- to name the interaction it is collecting.
--
-- WHY A TWO-PHASE DESIGN: per the interaction system, casting the Steal Fruit
-- does not take anything immediately. It parks a 'thief' interaction whose
-- 5-second reaction window gives every targeted player a chance to SHIELD
-- (block their share) or MIRROR (throw their share back at the caster). When
-- the sweep resolves it, the attacker learns WHO is still stealable:
--
--   outcome.eligible  -> everyone who neither shielded nor mirrored
--   outcome.blocked   -> SHIELD users (their share is never taken)
--   outcome.reflected -> MIRROR users (their full share is debited from the
--                        CASTER instead, "reflected back at full strength";
--                        the defender keeps their balance)
--
-- THIS RPC COLLECTS THAT RESULT. It drains each eligible player's full share
-- (p_per_second * p_seconds, capped by their balance), burns each reflected
-- defender's share from the caster's own bid, and pools the net gain onto the
-- attacker's bid. It can only be run by the ATTACKER (auth.uid() must own the
-- interaction), only once the sweep has resolved it, and only once.
--
-- COOLDOWN: the Steal Fruit's 20s cooldown is started at CAST
-- (cast_ability_interaction) — the fruit is consumed when it is thrown, so a
-- blocked steal is still spent. This commit deliberately does NOT assert or
-- bump the thief cooldown, or an attacker who collects a few seconds after
-- casting would be wrongly locked out.
--
-- LEGACY / FALLBACK: the page replaces its old direct steal call with
-- cast_ability_interaction + this commit. The 60s constant moves to 30s
-- (STEAL_FRUIT_DURATION_S in lib/abilityFruits.ts). Draining pro-rata by
-- elapsed time is out of scope; like the original, the full stated rate is
-- collected at commit.
-- ============================================================================

-- The pre-interaction overload must go, or a crafted call could keep using
-- the old unattached drain.
drop function if exists public.steal_bids(uuid, numeric, int);

create or replace function public.steal_bids(
  p_auction_id     uuid,
  p_interaction_id bigint,
  p_per_second     numeric default 1000,
  p_seconds        int     default 30
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id  uuid := auth.uid();
  v_e         record;
  v_row       record;
  v_rate      numeric;
  v_take      numeric;
  v_gain      numeric := 0;
  v_burn      numeric := 0;
  v_bal       numeric := 0;
  v_actor_bid numeric := 0;
  v_new       numeric := 0;
  v_eligible  uuid[] := '{}'::uuid[];
  v_reflected uuid[] := '{}'::uuid[];
  v_out       json[] := array[]::json[];
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null or p_interaction_id is null then
    raise exception 'Invalid steal interaction';
  end if;

  if p_per_second is null or p_per_second <= 0 then
    raise exception 'Invalid steal rate';
  end if;

  if p_seconds is null or p_seconds <= 0 then
    raise exception 'Invalid steal duration';
  end if;

  -- The attacker must own the resolved 'thief' interaction to collect it.
  select * into v_row
    from public.ability_interactions
   where id = p_interaction_id
     and auction_id = p_auction_id
     and effect_type = 'thief'
     and actor_user_id = v_actor_id
     and state = 'resolved'
   for update;

  if not found then
    raise exception 'You have no resolved steal to collect on this table';
  end if;

  -- One collection only.
  if v_row.outcome->>'committed' = 'true' then
    raise exception 'This steal has already been collected';
  end if;

  -- The sweep's verdict: who is still stealable, who shielded, who mirrored.
  v_eligible  := coalesce(
    (select array_agg(e::uuid) from jsonb_array_elements_text(v_row.outcome->'eligible') e),
    '{}'::uuid[]
  );

  v_reflected := coalesce(
    (select array_agg(e::uuid) from jsonb_array_elements_text(v_row.outcome->'reflected') e),
    '{}'::uuid[]
  );

  if array_length(v_eligible, 1) is null then
    raise exception 'Your steal was blocked — no one was stealable';
  end if;

  v_rate := p_per_second * p_seconds;
  v_bal  := 0;
  v_take := 0;

  -- Drain every still-eligible player. Capped by their balance, so a player
  -- who spent everything during the reaction window stops contributing.
  for v_e in
    select unnest(v_eligible) as u
  loop
    select "bidAmount" into v_bal
      from public."Bids"
     where "auctionId" = p_auction_id
       and "userId" = v_e.u
     for update;

    if found then
      v_take := least(v_rate, v_bal);

      update public."Bids"
         set "bidAmount" = v_bal - v_take
       where "auctionId" = p_auction_id
         and "userId" = v_e.u;

      perform public.record_bid_effect(
        p_auction_id, v_e.u, v_actor_id, 'thief',
        v_bal, v_bal - v_take
      );

      v_gain := v_gain + v_take;
      v_out := array_append(v_out, json_build_object(
        'user_id',   v_e.u,
        'previous',  v_bal::numeric,
        'new',       (v_bal - v_take)::numeric
      ));
    end if;
  end loop;

  -- Each MIRRORED defender's full share comes out of the CASTER instead
  -- ("reflected back at full strength"; the defender keeps their money).
  for v_e in
    select unnest(v_reflected) as u
  loop
    v_burn := v_burn + v_rate;
  end loop;

  select "bidAmount" into v_actor_bid
    from public."Bids"
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id
   for update;

  -- Net the pooled gain against the reflected burn, never below zero.
  v_new := greatest(coalesce(v_actor_bid, 0) + v_gain - v_burn, 0);

  update public."Bids"
     set "bidAmount" = v_new
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id;

  -- The net move lands on the thief's own stack (a no-op net is skipped).
  perform public.record_bid_effect(
    p_auction_id, v_actor_id, v_actor_id, 'thief',
    coalesce(v_actor_bid, 0), v_new
  );

  -- Flag the collection on the interaction so a second commit is refused.
  update public.ability_interactions
     set outcome = outcome || jsonb_build_object(
       'committed',    true,
       'total_stolen', v_gain,
       'reflected_burn', v_burn,
       'actor_new',    v_new
     )
   where id = v_row.id;

  return json_build_object(
    'success',          true,
    'interaction_id',   v_row.id,
    'actor_id',         v_actor_id,
    'actor_previous',   coalesce(v_actor_bid, 0),
    'actor_new',        v_new,
    'total_stolen',     v_gain,
    'reflected_burn',   v_burn,
    'targets',          v_out
  );
end;
$$;

revoke all on function public.steal_bids(uuid, bigint, numeric, int) from public;
grant execute on function public.steal_bids(uuid, bigint, numeric, int) to authenticated;