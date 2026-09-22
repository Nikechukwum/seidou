-- ============================================================================
-- FRUIT COOLDOWNS — every ability fruit shares the negate-style cooldown.
-- Run this file in the Supabase SQL editor FIRST, THEN re-run every fruit RPC
-- that calls into it (landwars_multiply_bid.sql, landwars_divide_bid.sql,
-- landwars_swap_bid.sql, landwars_steal_bid.sql, landwars_restore_bid.sql,
-- landwars_freeze_bid.sql, landwars_negate_bid.sql) so their guards resolve.
--
-- DESIGN: the Negate sheet's "the fruit has a cooldown (15-20s)" is the
-- template for ALL fruits. After a fruit fires successfully, the SAME fruit
-- cannot be fired again on that auction for COOLDOWN_S (20s, keep in step
-- with FRUIT_COOLDOWN_S in lib/abilityFruits.ts). The rule is "same fruit,
-- same table, same player" — casting Multiply does not lock Divide.
--
-- The cooldown is tracked in its own table (not bid_effects) because restore
-- and freeze never store a "fruit used by me" stack entry the way the negate
-- history did, and one shared mechanism is easier to reason about than six.
--
-- WHO WRITES / READS IT:
--   - bump_fruit_cooldown          — fired by every fruit RPC right before it
--                                     returns success (same transaction, so a
--                                     failed cast never spends the cooldown).
--   - assert_fruit_cooldown        — the actual guard; raises a friendly error
--                                     while a fruit is cooling down.
--   - fruit_cooldown_remaining     — shared by the guard and the peek.
--   - peek_fruit_cooldowns         — read-only, granted to authenticated: the
--                                     clients call it to paint "N s" on fruit
--                                     buttons and to stop a fruit mid-arming.
-- Clients can NEVER bump or assert directly (no grants) — only the
-- security-definer RPCs reach them at runtime.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- The ledger. One row per successful cast of a fruit. used_at defaults to
-- clock_timestamp() (not now()) so the countdown is measured from the instant
-- of the call, even inside a long transaction.
-- ----------------------------------------------------------------------------
create table if not exists public.fruit_cooldowns (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null,
  auction_id uuid        not null,
  fruit_id   text        not null,
  cooldown_s int         not null,
  used_at    timestamptz not null default clock_timestamp()
);

create index if not exists fruit_cooldowns_lookup_idx
  on public.fruit_cooldowns (user_id, auction_id, fruit_id, used_at desc);

alter table public.fruit_cooldowns enable row level security;

-- no client policies / grants on the table itself: RLS blocks everyone, and
-- only the security-definer functions below (or via the fruit RPCs) touch it.

-- ----------------------------------------------------------------------------
-- fruit_cooldown_remaining — seconds left before p_user_id can cast p_fruit_id
-- again on this auction (0 = ready). Each call to a fruit writes a fresh row,
-- so "the most recent use" is what counts.
-- ----------------------------------------------------------------------------
create or replace function public.fruit_cooldown_remaining(
  p_auction_id uuid,
  p_user_id    uuid,
  p_fruit_id   text
)
returns int
language sql
security definer
set search_path = public
as $$
  select greatest(0, ceil(cooldown_s - extract(epoch from (clock_timestamp() - used_at)))::int)
    from public.fruit_cooldowns
   where auction_id = p_auction_id
     and user_id    = p_user_id
     and fruit_id   = p_fruit_id
   order by used_at desc
   limit 1;
$$;

revoke all on function public.fruit_cooldown_remaining(uuid, uuid, text) from public;

-- ----------------------------------------------------------------------------
-- assert_fruit_cooldown — the guard every fruit RPC calls up front. Raises a
-- friendly message while the fruit is still cooling down. p_label is the
-- human name ("Freeze Fruit") so the error reads naturally.
-- ----------------------------------------------------------------------------
create or replace function public.assert_fruit_cooldown(
  p_auction_id uuid,
  p_user_id    uuid,
  p_fruit_id   text,
  p_label      text default 'This fruit'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining int;
begin
  v_remaining := public.fruit_cooldown_remaining(p_auction_id, p_user_id, p_fruit_id);
  if v_remaining > 0 then
    raise exception '% is still cooling down — % more second(s)', p_label, v_remaining;
  end if;
end;
$$;

revoke all on function public.assert_fruit_cooldown(uuid, uuid, text, text) from public;

-- ----------------------------------------------------------------------------
-- bump_fruit_cooldown — records a successful cast. Called by the fruit RPCs
-- inside the same transaction as the bid update: if the RPC later fails, the
-- whole transaction rolls back and the cooldown row goes with it, so a failed
-- attempt never costs the player a cooldown.
-- ----------------------------------------------------------------------------
create or replace function public.bump_fruit_cooldown(
  p_auction_id uuid,
  p_user_id    uuid,
  p_fruit_id   text,
  p_cooldown_s int default 20
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.fruit_cooldowns (user_id, auction_id, fruit_id, cooldown_s)
  values (p_user_id, p_auction_id, p_fruit_id, p_cooldown_s);
$$;

revoke all on function public.bump_fruit_cooldown(uuid, uuid, text, int) from public;

-- ----------------------------------------------------------------------------
-- peek_fruit_cooldowns — read-only look at every fruit the CALLER is currently
-- cooling down on this auction, as { fruit_id: seconds_remaining }. The
-- ability-fruits page polls this while it is open to paint "N s" on the
-- Activate buttons, and the table page checks it before firing an armed fruit
-- so a player is never made to watch an animation the server would refuse.
-- ----------------------------------------------------------------------------
create or replace function public.peek_fruit_cooldowns(p_auction_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id  uuid := auth.uid();
  v_row       record;
  v_remaining int;
  v_out       jsonb := '{}'::jsonb;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  for v_row in
    select distinct on (fruit_id) fruit_id, used_at, cooldown_s
      from public.fruit_cooldowns
     where auction_id = p_auction_id
       and user_id    = v_actor_id
     order by fruit_id, used_at desc
  loop
    v_remaining := greatest(
      0,
      ceil(v_row.cooldown_s - extract(epoch from (clock_timestamp() - v_row.used_at)))::int
    );
    if v_remaining > 0 then
      v_out := v_out || jsonb_build_object(v_row.fruit_id, v_remaining);
    end if;
  end loop;

  return json_build_object('cooldowns', v_out);
end;
$$;

revoke all on function public.peek_fruit_cooldowns(uuid) from public;
grant execute on function public.peek_fruit_cooldowns(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- REMINDER — AFTER sizing this file up, re-run the seven fruit RPC files (in
-- the order they are listed at the top of this header). Their FROZEN GUARD and
-- now COOLDOWN GUARD blocks call the shared helpers from this file at runtime,
-- so this file must be applied first.
-- ----------------------------------------------------------------------------