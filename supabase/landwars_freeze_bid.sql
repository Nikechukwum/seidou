-- ============================================================================
-- Ability Fruit: FREEZE FRUIT — table-wide bid lock for 30 seconds.
-- Run this in the Supabase SQL editor AFTER landwars_bid_effects.sql, then
-- RE-RUN the six protected RPCs afterwards (bid_schema.sql `place_bid` plus
-- multiply / divide / swap / steal / restore) because they gained a guard
-- against this fruit (see "FROZEN GUARD" in those files).
--
-- MECHANIC (design sheet + video): the activator freezes EVERY OTHER player
-- on the table for FREEZE_FRUIT_DURATION_S (30s, keep in step with
-- lib/abilityFruits.ts):
--   - frozen players cannot change their bid            (place_bid refused)
--   - frozen players cannot use ability fruits          (every RPC refused)
--   - the activator can still bid and is never blocked
--   - the NEGATE fruit is the exception: it stays usable while frozen, and
--     popping a 'freeze' entry off the stack releases that player.
--
-- HOW A FREEZE IS STORED: one row per affected player in public.bid_effects
-- with effect_type 'freeze' and bid_before = bid_after (a freeze never moves
-- a bid; the values are the player's current bid). record_bid_effect() is
-- deliberately NOT used — it skips no-op rows, and the whole point of the row
-- is to sit on the stack as the thing a Negate can undo.
--
-- THE "AM I FROZEN?" TEST is `is_freeze_active()`: "there is a non-negated,
-- un-expired 'freeze' row with ME as target". Because the activator never has
-- a row (freeze only targets OTHER players), casting the fruit can never
-- block yourself, and because expires is created_at + 30s, an expired (or
-- negated) freeze quietly stops blocking without needing a cleanup job.
--
-- ONE FREEZE PER TABLE AT A TIME: freeze_bid refuses while an un-expired,
-- un-negated freeze already exists on the auction, which keeps the 30s timer
-- unambiguous.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- is_freeze_active — shared guard used by place_bid and every fruit RPC.
-- Clients can never call this directly (no grant); only the security-definer
-- RPCs reach it at runtime.
-- ----------------------------------------------------------------------------
create or replace function public.is_freeze_active(
  p_auction_id uuid,
  p_user_id    uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.bid_effects
     where auction_id      = p_auction_id
       and target_user_id  = p_user_id
       and effect_type     = 'freeze'
       and not negated
       and created_at + interval '30 seconds' > clock_timestamp()
  );
$$;

revoke all on function public.is_freeze_active(uuid, uuid) from public;

-- ----------------------------------------------------------------------------
-- freeze_bid — the commit. Locks the caller's row, refuses while another
-- freeze is already active, then writes one 'freeze' stack entry per other
-- player on the table.
-- ----------------------------------------------------------------------------
create or replace function public.freeze_bid(
  p_auction_id uuid,
  p_duration_s int default 30
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
  v_any       uuid;
  v_out       json[] := array[]::json[];
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  if p_duration_s is null or p_duration_s <= 0 or p_duration_s > 120 then
    raise exception 'Invalid freeze duration';
  end if;

  -- FROZEN GUARD: a frozen player cannot even cast ANOTHER freeze — the Negate
  -- Fruit is the only fruit that works while frozen (see landwars_negate_bid.sql).
  if public.is_freeze_active(p_auction_id, v_actor_id) then
    raise exception 'You are currently frozen — wait for the Freeze Fruit to wear off before using a fruit';
  end if;

  -- The activator must actually be on the table for the fruit to mean anything.
  select "bidAmount" into v_actor_bid
    from public."Bids"
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id
   for update;

  if not found then
    raise exception 'Place a bid on this table before using a fruit';
  end if;

  -- ONE FREEZE AT A TIME: refuse while a live freeze is already on this table,
  -- whoever cast it. The 30s timer stays unambiguous.
  select id into v_any
    from public.bid_effects
   where auction_id      = p_auction_id
     and effect_type     = 'freeze'
     and not negated
     and created_at + make_interval(secs => p_duration_s) > clock_timestamp()
   limit 1;

  if found then
    raise exception 'The Freeze Fruit is already active on this table';
  end if;

  -- Freeze EVERY other player who has a row on the table. Each is written a
  -- stack entry with bid_before = bid_after (their current bid): the row is
  -- what blocks them and what a Negate can pop to release them.
  for v_target in
    select "userId" as u, "bidAmount" as b
      from public."Bids"
     where "auctionId" = p_auction_id
       and "userId" <> v_actor_id
     for update
  loop
    insert into public.bid_effects (
      auction_id, target_user_id, actor_user_id, effect_type, bid_before, bid_after
    )
    values (
      p_auction_id, v_target.u, v_actor_id, 'freeze',
      coalesce(v_target.b, 0), coalesce(v_target.b, 0)
    );

    v_out := array_append(v_out, json_build_object('user_id', v_target.u));
  end loop;

  if array_length(v_out, 1) is null then
    raise exception 'No other players on this table to freeze';
  end if;

  return json_build_object(
    'success',     true,
    'actor_id',    v_actor_id,
    'duration_s',  p_duration_s,
    'targets',     v_out
  );
end;
$$;

revoke all on function public.freeze_bid(uuid, int) from public;
grant execute on function public.freeze_bid(uuid, int) to authenticated;

-- ----------------------------------------------------------------------------
-- freeze_status — read-only look at whether the CALLER is frozen on this
-- table and for how many seconds. The table page polls this while it is open
-- so a frozen player sees their own blue border and can show the "you are
-- currently frozen — wait Xs" popup with a live countdown. The activator is
-- never "frozen" (they have no target row), so this also tells the activator
-- nothing is wrong.
-- ----------------------------------------------------------------------------
create or replace function public.freeze_status(p_auction_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_created  timestamptz;
  v_seconds  numeric := 0;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  select created_at into v_created
    from public.bid_effects
   where auction_id      = p_auction_id
     and target_user_id  = v_actor_id
     and effect_type     = 'freeze'
     and not negated
     and created_at + interval '30 seconds' > clock_timestamp()
   order by created_at desc, id desc
   limit 1;

  if v_created is not null then
    v_seconds := floor(greatest(
      extract(epoch from (v_created + interval '30 seconds' - clock_timestamp())),
      0
    ))::numeric;
  end if;

  return json_build_object(
    'frozen',             v_created is not null,
    'remaining_seconds',  v_seconds::int,
    'duration_s',         30
  );
end;
$$;

revoke all on function public.freeze_status(uuid) from public;
grant execute on function public.freeze_status(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- REMINDER — the NEGATE exception lives in landwars_negate_bid.sql: negate_bid
-- does NOT run the freeze guard (it is the designed counter), and because a
-- 'freeze' row sits on the stack it is naturally the TOP effect a frozen
-- player pops, marking it negated and releasing them while the rest of the
-- table stays frozen.
-- ----------------------------------------------------------------------------