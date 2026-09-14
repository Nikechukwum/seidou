-- ============================================================================
-- Loyalty rewards — atomic claim RPC
-- Run this in the Supabase SQL editor.
-- ============================================================================
--
-- Replaces the browser-side claim on /land-wars/wallet,
-- /profile/loyalty-rewards and /auction/loyalty-rewards. Those pages credited
-- a hardcoded amount and wrote back their own (possibly stale) copy of the
-- balance and loyalty_rewards, which could erase a reward granted while the
-- page was open or overwrite a balance changed elsewhere.
--
-- This function:
--   * takes the user from auth.uid(), never from an argument;
--   * locks the user row, so two claims of one reward serialize;
--   * finds the reward in the latest row version;
--   * decides the amount from the allowlist below, keyed on the reward's
--     "source" — the stored "amount" field is display-only, because users can
--     currently write their own loyalty_rewards;
--   * removes the reward and credits the balance in a single UPDATE.
--
-- NOTE: users.loyalty_rewards is jsonb[] — a Postgres array of jsonb values,
-- not a single jsonb document. PostgREST shows it to the app as a JSON array,
-- which hides the difference everywhere except in SQL.
--
-- Deliberately plpgsql with SELECT ... FOR UPDATE rather than one statement:
-- under READ COMMITTED a single statement's array index can go stale after a
-- lock wait and remove the wrong element.
-- ============================================================================

create or replace function public.claim_loyalty_reward(p_reward_id bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_rewards jsonb[];
  v_balance numeric;
  v_idx     int;
  v_reward  jsonb;
  v_amount  numeric;
begin
  if v_user is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  -- Re-packed with array(select unnest(...)) so a null list becomes empty and
  -- subscripts always start at 1 for the slicing below.
  select array(select unnest(loyalty_rewards)),
         coalesce(bidding_balance, 0)
    into v_rewards, v_balance
    from public.users
   where id = v_user
     for update;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  -- First occurrence only: legacy Date.now() ids can collide.
  select e.ord::int, e.elem
    into v_idx, v_reward
    from unnest(v_rewards) with ordinality as e(elem, ord)
   where jsonb_typeof(e.elem) = 'object'
     and jsonb_typeof(e.elem->'id') = 'number'
     and (e.elem->>'id')::numeric = p_reward_id
   order by e.ord
   limit 1;

  if v_reward is null then
    return json_build_object(
      'status',          'not_found',
      'rewardId',        p_reward_id,
      'bidding_balance', v_balance,
      'loyalty_rewards', to_jsonb(v_rewards)
    );
  end if;

  -- Server-side allowlist. Entries without a source predate sources (GamePix).
  v_amount := case coalesce(v_reward->>'source', 'legacy')
                when 'video'  then 30000
                when 'legacy' then 30000
                else null
              end;

  if v_amount is null then
    return json_build_object(
      'status',          'unknown_source',
      'rewardId',        p_reward_id,
      'bidding_balance', v_balance,
      'loyalty_rewards', to_jsonb(v_rewards)
    );
  end if;

  -- Remove exactly that one element: everything before it, then everything
  -- after it. (array_remove would also drop identical duplicates.)
  update public.users
     set loyalty_rewards = v_rewards[1:v_idx - 1] || v_rewards[v_idx + 1:],
         bidding_balance = coalesce(bidding_balance, 0) + v_amount
   where id = v_user
  returning bidding_balance, loyalty_rewards
       into v_balance, v_rewards;

  return json_build_object(
    'status',          'claimed',
    'rewardId',        p_reward_id,
    'amount',          v_amount,
    'bidding_balance', v_balance,
    'loyalty_rewards', to_jsonb(v_rewards)
  );
end;
$$;

revoke all on function public.claim_loyalty_reward(bigint) from public, anon;
grant execute on function public.claim_loyalty_reward(bigint) to authenticated;
