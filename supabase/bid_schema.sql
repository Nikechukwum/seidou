-- ============================================================================
-- Landwars atomic bid RPC + performance indexes
-- Run this in the Supabase SQL editor.
-- ============================================================================

-- 1. Performance indexes

create index if not exists bids_auction_user_idx
  on public."Bids" ("auctionId", "userId");

create index if not exists bids_auction_amount_idx
  on public."Bids" ("auctionId", "bidAmount" DESC);

-- 2. Atomic bid RPC (auctionId is uuid)

create or replace function public.place_bid(p_auction_id uuid, p_bid_amount numeric)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id      uuid := auth.uid();
  v_existing     record;
  v_new_bid      numeric;
  v_new_balance  numeric;
  v_action       text;
  v_tx_reference text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null or p_bid_amount is null or p_bid_amount <= 0 then
    raise exception 'Invalid auction id or bid amount';
  end if;

  update public.users
     set bidding_balance = bidding_balance - p_bid_amount
   where id = v_user_id
     and bidding_balance >= p_bid_amount;

  if not found then
    raise exception 'Insufficient bidding balance';
  end if;

  select bidding_balance into v_new_balance
    from public.users
   where id = v_user_id;

  select id, "bidAmount" into v_existing
    from public."Bids"
   where "auctionId" = p_auction_id
     and "userId" = v_user_id
   for update;

  if found then
    v_new_bid := v_existing."bidAmount" + p_bid_amount;

    update public."Bids"
       set "bidAmount" = v_new_bid
     where id = v_existing.id;

    v_action := 'update';
  else
    v_new_bid := p_bid_amount;

    insert into public."Bids" ("auctionId", "userId", "bidAmount")
    values (p_auction_id, v_user_id, v_new_bid);

    v_action := 'insert';
  end if;

  v_tx_reference := 'bid_' || v_user_id || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::text;

  insert into public.transactions (user_id, type, amount_credits, reference, status)
  values (v_user_id, 'bid_increase', p_bid_amount, v_tx_reference, 'success');

  return json_build_object(
    'success',         true,
    'action',          v_action,
    'bidAmount',       v_new_bid,
    'bidding_balance', v_new_balance
  );
end;
$$;

revoke all on function public.place_bid(uuid, numeric) from public;
grant execute on function public.place_bid(uuid, numeric) to authenticated;

-- 3. Enable Realtime on Bids table

alter publication supabase_realtime add table public."Bids";
