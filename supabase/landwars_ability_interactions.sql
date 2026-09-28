-- ============================================================================
-- ABILITY FRUIT INTERACTION SYSTEM — phase 2 of the ability fruits.
-- Run this in the Supabase SQL editor AFTER landwars_fruit_cooldowns.sql
-- (cooldown helpers), landwars_bid_effects.sql (effect history), and
-- landwars_freeze_bid.sql (is_freeze_active guard). Steal Bidding Currency's
-- drain commit is rewritten separately to consume this system (see below).
--
-- WHAT THE CEO'S PROPOSAL ASKS FOR (verbatim beats):
--   "progressive manifestation, target warning (spidey sense), reaction
--    period, defenders can use defense fruits to counter, server-sweep for
--    resolution" and a "five-second reaction period".
--
-- The four fruits that USE the interaction system: DIVIDE, POSITION SWAP,
-- STEAL, and FREEZE. The other fruits (Multiply, Restore, Negate, Copy,
-- Clone) do not target anyone through a reaction window, so they keep their
-- instant, non-interactive RPCs.
--
-- THE FLOW:
--   1) ACTIVATION      — the attacker calls cast_ability_interaction. The
--                        effect is CREATED but does NOT land. Everyone except
--                        the attacker can keep acting; the targeted players
--                        are simply warned ("spidey sense").
--   2) MANIFESTATION   — the fruit crosses the table toward its targets over
--                        REACTION_WINDOW_S (5s). resolve_at = created_at + 5s.
--   3) REACTION WINDOW — any targeted player may call
--                        respond_to_interaction with a SHIELD (blocks their
--                        share of the effect) or a MIRROR (blocks AND throws
--                        the effect back at the caster, "full strength").
--                        Responding is allowed even while frozen: the whole
--                        point of the window is to give the frozen their one
--                        counter, and a pending freeze has not landed yet.
--   4) RESOLUTION      — every client polls the feed; peek_ability_interactions
--                        runs the server SWEEP (sync_ability_interactions)
--                        first. The sweep locks the expired pending rows and
--                        applies each effect with the same rules every client
--                        observes, so the outcome is server-authoritative:
--                        the bid_effects / freeze rows are written HERE, never
--                        from a client timer.
--   5) FEEDBACK        — the feed returns outcome jsonb per interaction:
--                        "ATTACK BLOCKED" / "REFLECTED" / "applied" numbers.
--
-- PER-TARGET BLOCKING: each defender's save is individual. targets is the
-- full cast list, blocked_by holds SHIELD users, reflected_by holds MIRROR
-- users. Resolution uses:
--   effective = targets MINUS blocked_by MINUS reflected_by
-- so a Shield only protects the player who cast it; everyone else still eats
-- the effect. A Divide that is fully blocked simply does nothing; a frozen
-- table whose members all Shield keeps everyone safe but is a hard counter.
--
-- ONE PENDING PER ACTOR: a player can only have one effect in flight on an
-- auction at a time (state='pending' and actor_user_id = me is refused), and
-- the FREEZE fruit keeps its "one freeze per table" rule against BOTH live
-- freezes and pending freeze interactions.
--
-- WHAT STAYS INSTANT (NOT part of this system): multiply, restore, negate,
-- copy, clone. Negate remains POST-impact ("fruits NOT using the interaction
-- system" per the proposal).
--
-- THE STEAL DRAIN: the sweep for 'thief' only freezes WHO is still eligible
-- (everyone minus shielded minus mirrored) into outcome. The actual drain —
-- the 30s countdown spectacle — is committed later by the attacker through
-- steal_bids, which is rewritten to take the interaction id and drain ONLY
-- the eligible list. Mirrored defenders are "reflected": their share is
-- deducted from the CASTER instead (returned at full strength), and the
-- defender keeps their balance.
--
-- CLIENTS CANNOT FORGE NOWHERE: only cast / respond / swing receive grants.
-- The table itself is read-only to authenticated; RLS blocks all writes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- The interaction ledger. created_at/resolve_at use clock_timestamp() so the
-- 5s reaction window is measured from the instant of the cast, even inside
-- slow transactions. outcome is written only by the sweep.
-- ----------------------------------------------------------------------------
create table if not exists public.ability_interactions (
  id              bigint generated always as identity primary key,
  auction_id      uuid        not null,
  actor_user_id   uuid        not null,
  effect_type     text        not null check (effect_type in ('divide','swap','thief','freeze')),
  factor          numeric,
  target_user_ids uuid[]      not null default '{}',
  blocked_by      uuid[]      not null default '{}',
  reflected_by    uuid[]      not null default '{}',
  state           text        not null default 'pending' check (state in ('pending','resolved')),
  created_at      timestamptz not null default clock_timestamp(),
  resolve_at      timestamptz not null,
  resolved_at     timestamptz,
  outcome         jsonb
);

-- The sweep scan: "expired pending effects on this auction".
create index if not exists ability_interactions_sweep_idx
  on public.ability_interactions (auction_id, state, resolve_at);

-- "Does this player already have an effect in flight here?"
create index if not exists ability_interactions_actor_idx
  on public.ability_interactions (auction_id, actor_user_id, state);

-- "Pending effects that point at me" (the spidey-sense lookups).
create index if not exists ability_interactions_targets_idx
  on public.ability_interactions using gin (target_user_ids);

alter table public.ability_interactions enable row level security;

-- Read-only to signed-in players (the feed renders pending effects, outcomes
-- and the reaction countdown). There is deliberately NO insert/update/delete
-- policy: only the security-definer RPCs below write.
drop policy if exists "ability interactions are readable by authenticated users" on public.ability_interactions;
create policy "ability interactions are readable by authenticated users"
  on public.ability_interactions for select
  to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- The reaction window. Keep in step with REACTION_WINDOW_S in
-- lib/abilityInteractions.ts (the client countdown, the manifest animation
-- and the poll cadence all assume this number).
-- ----------------------------------------------------------------------------
create or replace function public.reaction_window_s()
returns int
language sql
stable
as $$
  select 5;
$$;

revoke all on function public.reaction_window_s() from public;

-- ----------------------------------------------------------------------------
-- cast_ability_interaction — the attacker's commit. Derives the targets from
-- the BOARD (never from the request body, so a crafted call cannot aim the
-- fruit), refuses while frozen or cooling down, enforces one pending effect
-- per actor (and one freeze per table), then parks the effect for the 5s
-- window. The fruit's cooldown is started here, not at resolution: the fruit
-- is consumed the moment it is cast, whether the attack later lands or is
-- blocked.
-- ----------------------------------------------------------------------------
create or replace function public.cast_ability_interaction(
  p_auction_id  uuid,
  p_effect_type text,
  p_factor      numeric default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id  uuid := auth.uid();
  v_actor_bid numeric;
  v_target    record;
  v_targets   uuid[] := '{}'::uuid[];
  v_any       bigint;
  v_live      bigint;
  v_fruit_id  text;
  v_label     text;
  v_window_s  int;
  v_now       timestamptz;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  -- Only the four interactive fruits flow through here.
  if p_effect_type is null or not (
    p_effect_type = any (array['divide','swap','thief','freeze'])
  ) then
    raise exception 'That ability fruit does not use the interaction system';
  end if;

  -- Divide carries its factor (÷2/÷3/÷4); the other three ignore it.
  if p_effect_type = 'divide' then
    if p_factor is null or p_factor < 2 or p_factor > 4 then
      raise exception 'Invalid divide factor';
    end if;
  end if;

  -- Map the effect to its fruit id + human name for the shared cooldown.
  case p_effect_type
    when 'divide' then v_fruit_id := 'divide'; v_label := 'Divide Fruit';
    when 'swap'   then v_fruit_id := 'swap';   v_label := 'Position Swap';
    when 'thief'  then v_fruit_id := 'thief';  v_label := 'Steal Bidding Currency';
    when 'freeze' then v_fruit_id := 'freeze'; v_label := 'Freeze Fruit';
  end case;

  -- COOLDOWN GUARD: a fruit cannot be cast again within 20s of its last cast.
  perform public.assert_fruit_cooldown(p_auction_id, v_actor_id, v_fruit_id, v_label);

  -- FROZEN GUARD (Freeze Fruit): a frozen player cannot cast a fruit — the
  -- Negate Fruit is the only fruit that works while frozen, and a DEFENSE
  -- (shield/mirror) is the other: see respond_to_interaction.
  if public.is_freeze_active(p_auction_id, v_actor_id) then
    raise exception 'You are currently frozen — wait for the Freeze Fruit to wear off before using a fruit';
  end if;

  -- The attacker must be on the table for the effect to mean anything.
  select "bidAmount" into v_actor_bid
    from public."Bids"
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id
   for update;

  if not found then
    raise exception 'Place a bid on this table before using a fruit';
  end if;

  -- ONE PENDING PER ACTOR: a player has a single effect in flight at a time.
  select id into v_any
    from public.ability_interactions
   where auction_id = p_auction_id
     and actor_user_id = v_actor_id
     and state = 'pending'
   limit 1;

  if found then
    raise exception 'You already have an ability fruit in flight on this table';
  end if;

  -- FREEZE keeps "one freeze per table": refuse while a live freeze holds
  -- (bid_effects rows) OR another freeze is still in flight (pending row).
  if p_effect_type = 'freeze' then
    select id into v_live
      from public.ability_interactions
     where auction_id = p_auction_id
       and effect_type = 'freeze'
       and state = 'pending'
     limit 1;

    if found then
      raise exception 'The Freeze Fruit is already in flight on this table';
    end if;

    select id into v_any
      from public.bid_effects
     where auction_id = p_auction_id
       and effect_type = 'freeze'
       and not negated
       and created_at + interval '30 seconds' > clock_timestamp()
     limit 1;

    if found then
      raise exception 'The Freeze Fruit is already active on this table';
    end if;
  end if;

  -- Derive the targets from the board, exactly like the instant RPCs did:
  --   divide/swap -> whoever holds FIRST position (the target is fixed at
  --                  cast: that is whose card gets the spidey sense and the
  --                  reaction window),
  --   thief  -> every other player with bidding currency to drain,
  --   freeze -> every other player with a row on the table.
  if p_effect_type in ('divide','swap') then
    select "userId", "bidAmount" into v_target
      from public."Bids"
     where "auctionId" = p_auction_id
     order by "bidAmount" desc
     limit 1;

    if not found then
      raise exception 'No bids on this table yet';
    end if;

    -- Same guard the instant swap had: nothing to swap for when already first.
    if p_effect_type = 'swap' and (v_target."userId" = v_actor_id or v_actor_bid = v_target."bidAmount") then
      raise exception 'You are already in first place';
    end if;

    v_targets := array[v_target."userId"];
  elsif p_effect_type = 'thief' then
    for v_target in
      select "userId" as u
        from public."Bids"
       where "auctionId" = p_auction_id
         and "userId" <> v_actor_id
         and "bidAmount" > 0
    loop
      v_targets := array_append(v_targets, v_target.u);
    end loop;

    if array_length(v_targets, 1) is null then
      raise exception 'No one on this table has bidding currency to steal';
    end if;
  else -- freeze
    for v_target in
      select "userId" as u
        from public."Bids"
       where "auctionId" = p_auction_id
         and "userId" <> v_actor_id
    loop
      v_targets := array_append(v_targets, v_target.u);
    end loop;

    if array_length(v_targets, 1) is null then
      raise exception 'No other players on this table to freeze';
    end if;
  end if;

  v_window_s := public.reaction_window_s();

  -- Park the effect. It lands at created_at + REACTION_WINDOW_S.
  insert into public.ability_interactions (
    auction_id, actor_user_id, effect_type, factor, target_user_ids,
    state, created_at, resolve_at, outcome
  )
  values (
    p_auction_id, v_actor_id, p_effect_type,
    case when p_effect_type = 'divide' then p_factor else null end,
    v_targets, 'pending', clock_timestamp(), clock_timestamp() + make_interval(secs => v_window_s),
    null
  )
  returning id, resolve_at into v_any, v_now;

  -- Start the fruit's cooldown (same transaction: any failure above rolls
  -- this back, so a refused cast never costs a cooldown).
  perform public.bump_fruit_cooldown(p_auction_id, v_actor_id, v_fruit_id);

  return json_build_object(
    'success',         true,
    'interaction_id',  v_any,
    'effect_type',     p_effect_type,
    'factor',          case when p_effect_type = 'divide' then p_factor else null end,
    'targets',         to_jsonb(v_targets),
    'created_at',      v_now - make_interval(secs => v_window_s),
    'resolve_at',      v_now,
    'window_s',        v_window_s
  );
end;
$$;

revoke all on function public.cast_ability_interaction(uuid, text, numeric) from public;
grant execute on function public.cast_ability_interaction(uuid, text, numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- respond_to_interaction — the defender's counter. Fails unless the caller is
-- one of the interaction's targets and the 5s window is still open. A SHIELD
-- appends the caller to blocked_by (their share of the effect is dropped); a
-- MIRROR appends them to reflected_by (their share is thrown back at the
-- caster). Each defense consumes its own fruit and starts its own 20s
-- cooldown, so a defender can only rescue themselves, and only once per
-- cooldown.
--
-- RESPONDING WHILE FROZEN IS ALLOWED: the reaction window is the frozen
-- player's one counter (the proposal's "telegraphed, Shield can block" freeze)
-- and a PENDING freeze has not written its rows yet, so is_freeze_active is
-- still false for the target. This mirrors the Negate exception on purpose.
-- ----------------------------------------------------------------------------
create or replace function public.respond_to_interaction(
  p_auction_id     uuid,
  p_interaction_id bigint,
  p_fruit_id       text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_row      record;
  v_label    text;
  v_is_block boolean;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null or p_interaction_id is null then
    raise exception 'Invalid interaction';
  end if;

  -- Only the two defense fruits can counter a pending effect.
  if p_fruit_id = 'shield' then
    v_label    := 'Shield Shield Fruit';
    v_is_block := true;
  elsif p_fruit_id = 'mirror' then
    v_label    := 'Mirror Mirror Fruit';
    v_is_block := false;
  else
    raise exception 'That is not a defense fruit';
  end if;

  select * into v_row
    from public.ability_interactions
   where id = p_interaction_id
     and auction_id = p_auction_id
     and state = 'pending'
   for update;

  if not found then
    raise exception 'There is no ability fruit in flight for you to counter';
  end if;

  -- Only players the effect is aimed at get to react.
  if not (v_actor_id = any(coalesce(v_row.target_user_ids, '{}'::uuid[]))) then
    raise exception 'That effect does not target you';
  end if;

  -- The 5s reaction window must still be open.
  if v_row.resolve_at <= clock_timestamp() then
    raise exception 'The reaction window has passed — the effect already landed';
  end if;

  -- COOLDOWN GUARD for the defense fruit itself.
  perform public.assert_fruit_cooldown(p_auction_id, v_actor_id, p_fruit_id, v_label);

  -- Append the defender to the right list (never twice).
  if v_is_block then
    if v_actor_id = any(coalesce(v_row.blocked_by, '{}'::uuid[])) then
      raise exception 'You already countered that effect';
    end if;
    update public.ability_interactions
       set blocked_by = coalesce(blocked_by, '{}'::uuid[]) || array[v_actor_id]
     where id = v_row.id;
  else
    if v_actor_id = any(coalesce(v_row.reflected_by, '{}'::uuid[])) then
      raise exception 'You already countered that effect';
    end if;
    update public.ability_interactions
       set reflected_by = coalesce(reflected_by, '{}'::uuid[]) || array[v_actor_id]
     where id = v_row.id;
  end if;

  -- The defense fruit is consumed: start its cooldown so a React button
  -- cannot be mashed every half second.
  perform public.bump_fruit_cooldown(p_auction_id, v_actor_id, p_fruit_id);

  return json_build_object(
    'success',         true,
    'interaction_id',  v_row.id,
    'effect_type',     v_row.effect_type,
    'fruit_id',        p_fruit_id,
    'blocked_by',      to_jsonb(v_row.blocked_by),
    'reflected_by',    to_jsonb(v_row.reflected_by)
  );
end;
$$;

revoke all on function public.respond_to_interaction(uuid, bigint, text) from public;
grant execute on function public.respond_to_interaction(uuid, bigint, text) to authenticated;

-- ----------------------------------------------------------------------------
-- resolve_ability_interaction — the sweep's worker. Applies one expired
-- pending interaction in the same transaction that locks it, with the
-- per-target blocking rules baked in. Callable only from the sweep; never
-- granted to a client.
-- ----------------------------------------------------------------------------
create or replace function public.resolve_ability_interaction(p_interaction_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row        record;
  v_effective  uuid[] := '{}'::uuid[];
  v_leader     uuid;
  v_before     numeric;
  v_after      numeric;
  v_actor_bid  numeric;
  v_leader_bid numeric;
  v_actor_new  numeric;
  v_leader_new numeric;
  v_target     record;
  v_outcome    jsonb;
begin
  select * into v_row
    from public.ability_interactions
   where id = p_interaction_id
   for update;

  if not found then
    return null;
  end if;

  -- Idempotent: a row already resolved by a concurrent sweep changes nothing.
  if v_row.state = 'resolved' then
    return jsonb_build_object('id', v_row.id, 'effect_type', v_row.effect_type, 'outcome', v_row.outcome);
  end if;

  -- effective = targets MINUS shielded MINUS mirrored (the per-target save).
  select coalesce(array_agg(x), '{}'::uuid[]) into v_effective
    from (
      select unnest(v_row.target_user_ids) as x
      except
      select unnest(coalesce(v_row.blocked_by, '{}'::uuid[]))
      except
      select unnest(coalesce(v_row.reflected_by, '{}'::uuid[]))
    ) t;

  if v_row.effect_type = 'divide' then
    v_leader := v_row.target_user_ids[1];

    if v_leader is null then
      v_outcome := jsonb_build_object('status', 'no_op', 'reason', 'no target');
    elsif v_leader = any(coalesce(v_row.reflected_by, '{}'::uuid[])) then
      -- The #1 player mirrors: the caster eats their own divide, the leader
      -- keeps their bid.
      select "bidAmount" into v_before
        from public."Bids"
       where "auctionId" = v_row.auction_id
         and "userId" = v_row.actor_user_id
       for update;

      if not found then
        v_outcome := jsonb_build_object('status', 'no_op', 'reason', 'attacker left the table', 'target_user_id', v_leader);
      else
        v_after := greatest(floor(v_before / v_row.factor), 1);

        update public."Bids"
           set "bidAmount" = v_after
         where "auctionId" = v_row.auction_id
           and "userId" = v_row.actor_user_id;

        perform public.record_bid_effect(
          v_row.auction_id, v_row.actor_user_id, v_row.actor_user_id, 'divide',
          v_before, v_after
        );

        v_outcome := jsonb_build_object(
          'status',           'reflected',
          'target_user_id',   v_leader,
          'reflected_user_id', v_row.actor_user_id,
          'divisor',          v_row.factor,
          'previous_bid',     v_before,
          'bid_after',        v_after
        );
      end if;
    elsif v_leader = any(coalesce(v_row.blocked_by, '{}'::uuid[])) then
      v_outcome := jsonb_build_object(
        'status',         'blocked',
        'target_user_id', v_leader,
        'blocked_by',     to_jsonb(v_row.blocked_by)
      );
    else
      -- The leader accepts the cut: divide their CURRENT bid (whatever it
      -- grew or shrank to during the reaction window).
      select "bidAmount" into v_before
        from public."Bids"
       where "auctionId" = v_row.auction_id
         and "userId" = v_leader
       for update;

      if not found then
        v_outcome := jsonb_build_object('status', 'no_op', 'reason', 'target left the table', 'target_user_id', v_leader);
      else
        v_after := greatest(floor(v_before / v_row.factor), 1);

        update public."Bids"
           set "bidAmount" = v_after
         where "auctionId" = v_row.auction_id
           and "userId" = v_leader;

        perform public.record_bid_effect(
          v_row.auction_id, v_leader, v_row.actor_user_id, 'divide',
          v_before, v_after
        );

        v_outcome := jsonb_build_object(
          'status',         'applied',
          'target_user_id', v_leader,
          'divisor',        v_row.factor,
          'previous_bid',   v_before,
          'bid_after',      v_after
        );
      end if;
    end if;

  elsif v_row.effect_type = 'swap' then
    v_leader := v_row.target_user_ids[1];

    -- Mirror on a swap is treated as a block: there is nothing meaningful to
    -- throw back ("swap with yourself").
    if v_leader is null then
      v_outcome := jsonb_build_object('status', 'no_op', 'reason', 'no target');
    elsif v_leader = any(coalesce(v_row.reflected_by, '{}'::uuid[]))
      or v_leader = any(coalesce(v_row.blocked_by, '{}'::uuid[])) then
      v_outcome := jsonb_build_object(
        'status',         'blocked',
        'target_user_id', v_leader,
        'blocked_by',     to_jsonb(v_row.blocked_by),
        'reflected_by',   to_jsonb(v_row.reflected_by)
      );
    else
      select "bidAmount" into v_actor_bid
        from public."Bids"
       where "auctionId" = v_row.auction_id
         and "userId" = v_row.actor_user_id
       for update;

      select "bidAmount" into v_leader_bid
        from public."Bids"
       where "auctionId" = v_row.auction_id
         and "userId" = v_leader
       for update;

      if not found then
        v_outcome := jsonb_build_object('status', 'no_op', 'reason', 'a traded player left the table', 'target_user_id', v_leader);
      elsif v_actor_bid = v_leader_bid then
        v_outcome := jsonb_build_object('status', 'no_op', 'reason', 'You are already in first place', 'target_user_id', v_leader);
      else
        v_actor_new  := v_leader_bid;
        v_leader_new := v_actor_bid;

        update public."Bids"
           set "bidAmount" = v_actor_new
         where "auctionId" = v_row.auction_id
           and "userId" = v_row.actor_user_id;

        update public."Bids"
           set "bidAmount" = v_leader_new
         where "auctionId" = v_row.auction_id
           and "userId" = v_leader;

        -- A swap moves TWO bids, so both players get a stack entry (same
        -- transaction created_at, so a Negate uns on both halves).
        perform public.record_bid_effect(
          v_row.auction_id, v_row.actor_user_id, v_row.actor_user_id, 'swap',
          v_actor_bid, v_actor_new
        );
        perform public.record_bid_effect(
          v_row.auction_id, v_leader, v_row.actor_user_id, 'swap',
          v_leader_bid, v_leader_new
        );

        v_outcome := jsonb_build_object(
          'status',         'applied',
          'leader_id',      v_leader,
          'actor_previous', v_actor_bid,
          'actor_new',      v_actor_new,
          'leader_previous', v_leader_bid,
          'leader_new',     v_leader_new
        );
      end if;
    end if;

  elsif v_row.effect_type = 'thief' then
    -- The sweep only freezes WHO is still stealable. The actual drain — the
    -- 30s countdown spectacle — is committed through the rewritten steal_bids
    -- (attacker passes this interaction id; it drains v_effective only, and
    -- deducts each mirrored defender's full share from the CASTER instead).
    v_outcome := jsonb_build_object(
      'status',   case when array_length(v_effective, 1) is null then 'blocked' else 'ready' end,
      'eligible', to_jsonb(v_effective),
      'blocked',  to_jsonb(coalesce(v_row.blocked_by, '{}'::uuid[])),
      'reflected', to_jsonb(coalesce(v_row.reflected_by, '{}'::uuid[]))
    );

  else -- freeze
    -- Write one 'freeze' stack row per STILL-eligible player. Like the instant
    -- freeze, rows carry bid_before = bid_after (a freeze never moves a bid);
    -- the row is what blocks them and what a Negate pops to release them. The
    -- 30s expiry starts NOW, at impact.
    for v_target in
      select unnest(v_effective) as u
    loop
      select "bidAmount" into v_actor_bid
        from public."Bids"
       where "auctionId" = v_row.auction_id
         and "userId" = v_target.u
       for update;

      if found then
        insert into public.bid_effects (
          auction_id, target_user_id, actor_user_id, effect_type, bid_before, bid_after
        )
        values (
          v_row.auction_id, v_target.u, v_row.actor_user_id, 'freeze',
          coalesce(v_actor_bid, 0), coalesce(v_actor_bid, 0)
        );
      end if;
    end loop;

    -- A mirrored freeze throws itself back: the CASTER is frozen for those
    -- defenders (signature "counter" — they cannot simply cast a new fruit
    -- while their own freeze pins them, and Negate is their way out).
    if array_length(coalesce(v_row.reflected_by, '{}'::uuid[]), 1) is not null then
      select "bidAmount" into v_actor_bid
        from public."Bids"
       where "auctionId" = v_row.auction_id
         and "userId" = v_row.actor_user_id
       for update;

      if found then
        insert into public.bid_effects (
          auction_id, target_user_id, actor_user_id, effect_type, bid_before, bid_after
        )
        values (
          v_row.auction_id, v_row.actor_user_id, v_row.actor_user_id, 'freeze',
          coalesce(v_actor_bid, 0), coalesce(v_actor_bid, 0)
        );
      end if;
    end if;

    if array_length(v_effective, 1) is null and array_length(coalesce(v_row.reflected_by, '{}'::uuid[]), 1) is null then
      v_outcome := jsonb_build_object(
        'status',  'blocked',
        'blocked', to_jsonb(v_row.blocked_by)
      );
    else
      v_outcome := jsonb_build_object(
        'status',    'applied',
        'frozen',    to_jsonb(v_effective),
        'blocked',   to_jsonb(coalesce(v_row.blocked_by, '{}'::uuid[])),
        'reflected', to_jsonb(coalesce(v_row.reflected_by, '{}'::uuid[]))
      );
    end if;
  end if;

  update public.ability_interactions
     set state = 'resolved',
         resolved_at = clock_timestamp(),
         outcome = v_outcome
   where id = v_row.id;

  return jsonb_build_object(
    'id',          v_row.id,
    'effect_type', v_row.effect_type,
    'outcome',     v_outcome
  );
end;
$$;

revoke all on function public.resolve_ability_interaction(bigint) from public;

-- ----------------------------------------------------------------------------
-- sync_ability_interactions — the server sweep. Every feed read calls this
-- first: it resolves every expired pending interaction on the auction in one
-- locked pass (for update skip locked, so parallel polls never double-apply
-- an effect and the cheaper poll just finds nothing to do).
-- ----------------------------------------------------------------------------
create or replace function public.sync_ability_interactions(p_auction_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row    record;
  v_result jsonb;
  v_out    json[] := array[]::json[];
begin
  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  for v_row in
    select id
      from public.ability_interactions
     where auction_id = p_auction_id
       and state = 'pending'
       and resolve_at <= clock_timestamp()
     order by id
     for update skip locked
  loop
    v_result := public.resolve_ability_interaction(v_row.id);
    if v_result is not null then
      v_out := array_append(v_out, json_build_object(
        'id',          v_result->>'id',
        'effect_type', v_result->>'effect_type',
        'outcome',     (v_result->'outcome')::text
      ));
    end if;
  end loop;

  return json_build_object('resolved', to_jsonb(v_out));
end;
$$;

revoke all on function public.sync_ability_interactions(uuid) from public;
grant execute on function public.sync_ability_interactions(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- peek_ability_interactions — the feed. Runs AFTER the sweep in the API
-- route, so the caller always sees post-resolution truth. Returns every
-- pending interaction (the reaction window UI) plus recently-resolved ones
-- (the impact/feedback UI anyway), each tagged with the caller's point of
-- view: is_mine, is_targeting_me, and window_remaining_s.
-- ----------------------------------------------------------------------------
create or replace function public.peek_ability_interactions(p_auction_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_now      timestamptz := clock_timestamp();
  v_row      record;
  v_windows  int;
  v_out      json[] := array[]::json[];
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  for v_row in
    select *
      from public.ability_interactions
     where auction_id = p_auction_id
       and (state = 'pending'
         or resolved_at >= now() - interval '45 seconds')
     order by id desc
     limit 20
  loop
    if v_row.state = 'pending' then
      v_windows := greatest(ceil(extract(epoch from (v_row.resolve_at - v_now)))::int, 0);
    else
      v_windows := 0;
    end if;

    v_out := array_append(v_out, json_build_object(
      'id',                  v_row.id,
      'effect_type',         v_row.effect_type,
      'factor',              v_row.factor,
      'state',               v_row.state,
      'actor_user_id',       v_row.actor_user_id,
      'actor_is_me',         v_row.actor_user_id = v_actor_id,
      'target_user_ids',     to_jsonb(v_row.target_user_ids),
      'is_targeting_me',     v_actor_id = any(coalesce(v_row.target_user_ids, '{}'::uuid[])),
      'blocked_by',          to_jsonb(v_row.blocked_by),
      'reflected_by',        to_jsonb(v_row.reflected_by),
      'created_at',          to_char(v_row.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'resolve_at',          to_char(v_row.resolve_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'window_remaining_s',  v_windows,
      'resolved_at',         case when v_row.resolved_at is null then null else to_char(v_row.resolved_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') end,
      'outcome',             v_row.outcome
    ));
  end loop;

  return json_build_object(
    'now',              to_char(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'server_epoch_ms',  floor(extract(epoch from v_now) * 1000)::bigint,
    'interactions',     to_jsonb(v_out)
  );
end;
$$;

revoke all on function public.peek_ability_interactions(uuid) from public;
grant execute on function public.peek_ability_interactions(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- REMINDER — the drain commit. landwars_steal_bid.sql is rewritten to give
-- steal_bids a p_interaction_id parameter: it resolves the 'thief' interaction,
-- drains ONLY outcome.eligible, deducts each outcome.reflected target's full
-- share from the CASTER (the mirror "reflects the theft back at full
-- strength"), and stops bumping the thief cooldown itself (cast already bumped
-- it at activation). Run that file AFTER this one.
--
-- FALLBACK / LEGACY: the instant divide_bid / swap_positions / freeze_bid RPCs
-- still exist for non-interactive callers and are unchanged; the table page
-- stops calling them for these four fruits and uses cast + the feed instead.
-- ----------------------------------------------------------------------------