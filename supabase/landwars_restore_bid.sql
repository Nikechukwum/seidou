-- ============================================================================
-- Ability Fruit: RESTORE — give the player back what THEY used in this
-- auction. Run this in the Supabase SQL editor.
--
-- Currency half (this RPC): the Bidding Currency the activator committed to
-- THIS auction is withdrawn from the table (their bid is set to 0) and the
-- same amount is credited straight back to users.bidding_balance. No currency
-- is minted — the money simply moves from the table back to the wallet, and
-- only the activator's own row is touched, so no other player on the table is
-- affected.
--
-- Ability-fruit half (the top of the summary pop-up): the fruits the player
-- used go back into their inventory. There is no server-side fruit inventory
-- yet, so that half is held in the client's per-auction usage ledger
-- (lib/fruitUsage.ts) — when one ships, clear it here inside the same
-- transaction.
--
-- DEV NOTE (design): "Restore should only return Bidding Currency that was
-- spent by the player (not the current wallet balance)", and a player with a
-- zero bid can still restore the fruits they used — so a zero bid is a
-- refunded amount of 0, NOT an error. The "nothing to restore at all" case is
--   caught client-side, where the fruit ledger is known.
--
-- COOLDOWN: every fruit shares the negate-style cooldown. Run
-- landwars_fruit_cooldowns.sql first, then re-run this file so this RPC's
-- cooldown guard resolves.
-- ============================================================================

create or replace function public.restore_bid(p_auction_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id    uuid := auth.uid();
  v_bid         numeric := 0;
  v_new_balance numeric;
  v_tx_reference text;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_auction_id is null then
    raise exception 'Invalid auction id';
  end if;

  -- COOLDOWN GUARD: a fruit cannot be cast again within 20s of its last cast.
  perform public.assert_fruit_cooldown(p_auction_id, v_actor_id, 'restore', 'Restore Fruit');

  -- FROZEN GUARD (Freeze Fruit): a frozen player cannot use a fruit. Run
  -- landwars_freeze_bid.sql first, then re-run this file so the guard resolves.
  if public.is_freeze_active(p_auction_id, v_actor_id) then
    raise exception 'You are currently frozen — wait for the Freeze Fruit to wear off before using a fruit';
  end if;

  -- How much of the wallet went into this auction = the current bid.
  select "bidAmount" into v_bid
    from public."Bids"
   where "auctionId" = p_auction_id
     and "userId" = v_actor_id
   for update;

  if not found then
    raise exception 'Place a bid on this table before using a fruit';
  end if;

  v_bid := coalesce(v_bid, 0);

  if v_bid > 0 then
    -- 1) Withdraw the bid from the table (row kept as history, now worth 0).
    update public."Bids"
       set "bidAmount" = 0
     where "auctionId" = p_auction_id
       and "userId" = v_actor_id;

    -- 2) Refund exactly that much to the wallet.
    update public.users
       set bidding_balance = bidding_balance + v_bid
     where id = v_actor_id;

    v_tx_reference := 'restore_' || v_actor_id || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::text;

    insert into public.transactions (user_id, type, amount_credits, reference, status)
    values (v_actor_id, 'bid_restore', v_bid, v_tx_reference, 'success');
  end if;

  select bidding_balance into v_new_balance
    from public.users
   where id = v_actor_id;

  -- Start the cooldown on this fruit (same transaction: any later failure
  -- rolls this row back, so a failed cast never spends the cooldown).
  perform public.bump_fruit_cooldown(p_auction_id, v_actor_id, 'restore');

  return json_build_object(
    'success',         true,
    'refunded',        v_bid,
    'bidAmount',       0,
    'bidding_balance', v_new_balance
  );
end;
$$;

revoke all on function public.restore_bid(uuid) from public;
grant execute on function public.restore_bid(uuid) to authenticated;
