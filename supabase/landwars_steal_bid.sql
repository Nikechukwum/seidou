-- ============================================================================
-- Ability Fruit: STEAL BIDDING CURRENCY — atomic multi-target steal RPC
-- Run this in the Supabase SQL editor.
--
-- The fruit requires NO targeting. It drains a fixed amount from EVERY other
-- player who holds a bid on the auction, then adds the whole pooled amount to
-- the activator's OWN bid. Players whose bid is below the steal amount are
-- skipped. All rows are locked and updated in one transaction so the board
-- stays consistent. Realtime on "Bids" keeps every client in sync.
-- ============================================================================

create or replace function public.steal_bids(
  p_auction_id uuid,
  p_steal_amount numeric default 10000
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id  uuid := auth.uid();
  v_actor_bid numeric := 0;
  v_target    record;
  v_total     numeric := 0;
  v_out       json[] := array[]::json[]; 
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  if p_steal_amount is null or p_steal_amount <= 0 then
    raise exception 'Invalid steal amount';
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

  -- Drain every other player whose bid can afford the steal amount.
  for v_target in
    select "userId" as u, "bidAmount" as b
      from public."Bids"
     where "auctionId" = p_auction_id
       and "userId" <> v_actor_id
       and "bidAmount" >= p_steal_amount
     for update
  loop
    update public."Bids"
       set "bidAmount" = v_target.b - p_steal_amount
     where "auctionId" = p_auction_id
       and "userId" = v_target.u;

    v_total := v_total + p_steal_amount;
    v_out := array_append(v_out, json_build_object(
      'user_id',   v_target.u,
      'previous',  v_target.b::numeric,
      'new',       (v_target.b - p_steal_amount)::numeric
    ));
  end loop;

  if v_total = 0 then
    raise exception 'No bids on this table are large enough to steal from';
  end if;

  -- Pool everything onto the activator's bid, all at once.
  update public."Bids"
     set "bidAmount" = v_actor_bid + v_total
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id;

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

revoke all on function public.steal_bids(uuid, numeric) from public;
grant execute on function public.steal_bids(uuid, numeric) to authenticated;