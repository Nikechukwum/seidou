-- ============================================================================
-- ABILITY FRUIT EFFECT HISTORY — the stack the NEGATE fruit pops from.
-- Run this in the Supabase SQL editor BEFORE landwars_negate_bid.sql, and
-- re-run the four fruit RPCs afterwards (multiply / divide / swap / steal),
-- because they were updated to write into this table.
--
-- DEV NOTE (design, Negate sheet): "Track effect history stack per player
-- (type, value before effect, timestamp)." That is exactly this table — one
-- row per ability-fruit effect that MOVED a player's bid:
--
--   target_user_id   who was affected (the player who may later negate it)
--   actor_user_id    who used the fruit
--   effect_type      'multiply' | 'divide' | 'swap' | 'thief' | 'negate'
--   bid_before       the value BEFORE the effect was applied  <- restored
--   bid_after        the value the effect left behind
--   negated          true once a Negate has consumed this entry
--   created_at       the timestamp the stack is ordered by
--
-- A swap writes TWO rows (both players were affected), a steal writes one row
-- per drained player plus one for the pooled gain, and a multiply/divide write
-- a single row. Nothing is ever deleted: negating an entry only flags it, so
-- the history stays auditable.
--
-- Rows are written exclusively by the security-definer fruit RPCs, so a client
-- can never forge an effect for itself to negate.
-- ============================================================================

create table if not exists public.bid_effects (
  id             bigserial primary key,
  auction_id     uuid        not null,
  target_user_id uuid        not null,
  actor_user_id  uuid,
  effect_type    text        not null,
  bid_before     numeric     not null,
  bid_after      numeric     not null,
  negated        boolean     not null default false,
  negated_at     timestamptz,
  created_at     timestamptz not null default now()
);

-- The one query that matters: "the newest un-negated effect on this player,
-- on this table" — the top of the stack.
create index if not exists bid_effects_stack_idx
  on public.bid_effects (auction_id, target_user_id, negated, created_at desc);

-- ...and the cooldown lookup: "when did this player last eat a Negate here".
create index if not exists bid_effects_actor_idx
  on public.bid_effects (auction_id, actor_user_id, effect_type, created_at desc);

alter table public.bid_effects enable row level security;

-- Read-only to signed-in players (a future "what hit me" panel can use it).
-- There is deliberately NO insert/update/delete policy: only the RPCs write.
drop policy if exists "bid_effects are readable by authenticated users" on public.bid_effects;
create policy "bid_effects are readable by authenticated users"
  on public.bid_effects for select
  to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- record_bid_effect — the single writer every fruit RPC calls.
-- No-op effects are skipped: an effect that did not move the bid is not worth
-- a Negate, and it must never sit on top of the stack hiding a real one.
-- ----------------------------------------------------------------------------
create or replace function public.record_bid_effect(
  p_auction_id uuid,
  p_target_user_id uuid,
  p_actor_user_id uuid,
  p_effect_type text,
  p_bid_before numeric,
  p_bid_after numeric
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.bid_effects (
    auction_id, target_user_id, actor_user_id, effect_type, bid_before, bid_after
  )
  select p_auction_id, p_target_user_id, p_actor_user_id, p_effect_type,
         coalesce(p_bid_before, 0), coalesce(p_bid_after, 0)
   where p_auction_id is not null
     and p_target_user_id is not null
     and coalesce(p_bid_before, 0) is distinct from coalesce(p_bid_after, 0);
$$;

-- Callable only from inside the other security-definer RPCs, never by a client.
revoke all on function public.record_bid_effect(uuid, uuid, uuid, text, numeric, numeric) from public;
