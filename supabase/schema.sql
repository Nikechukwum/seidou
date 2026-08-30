-- ============================================================================
-- Seidou wallet schema (users-table approach)
-- Run this in the Supabase SQL editor (or via migration).
--
-- Balances live on the existing `users` table:
--   users.cash_balance    -> Main / Naira wallet  (decimal)
--   users.bidding_balance -> Land Wars / Bidding Credits wallet
--
-- `transactions` is the only new table; it backs the audit log and the
-- idempotency check in app/api/wallet/deposit/verify/route.ts.
--
-- The API routes currently update `users` directly via PostgREST (conditional
-- updates guarded by `cash_balance >= amount`). The RPCs below are provided as
-- an equivalent atomic alternative and match the original wallet spec.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. transactions — audit log
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  amount_naira numeric(10,2),
  amount_credits numeric(12,0),
  reference text not null unique,
  status text not null default 'success',
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own" on public.transactions
  for select using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own" on public.transactions
  for insert with check (auth.uid() = user_id);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_reference_idx on public.transactions (reference);

-- ----------------------------------------------------------------------------
-- RPC: debit_main_wallet — atomic Naira debit from users.cash_balance
-- ----------------------------------------------------------------------------
create or replace function public.debit_main_wallet(naira_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if naira_amount is null or naira_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  update public.users
     set cash_balance = cash_balance - naira_amount
   where id = v_user_id
     and cash_balance >= naira_amount;

  if not found then
    raise exception 'Insufficient funds';
  end if;

  select cash_balance into v_new_balance
    from public.users
   where id = v_user_id;

  insert into public.transactions (user_id, type, amount_naira, amount_credits, reference, status)
  values (
    v_user_id,
    'debit_main',
    naira_amount,
    null,
    'debit_' || v_user_id || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
    'success'
  );

  return v_new_balance;
end;
$$;

revoke all on function public.debit_main_wallet(numeric) from public;
grant execute on function public.debit_main_wallet(numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- RPC: credit_landwars_wallet — atomic Bidding Credits credit to users.bidding_balance
-- ----------------------------------------------------------------------------
create or replace function public.credit_landwars_wallet(credit_amount numeric)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if credit_amount is null or credit_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  update public.users
     set bidding_balance = bidding_balance + credit_amount
   where id = v_user_id;

  select bidding_balance into v_new_balance
    from public.users
   where id = v_user_id;

  insert into public.transactions (user_id, type, amount_naira, amount_credits, reference, status)
  values (
    v_user_id,
    'credit_landwars',
    null,
    credit_amount,
    'credit_' || v_user_id || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
    'success'
  );

  return v_new_balance;
end;
$$;

revoke all on function public.credit_landwars_wallet(numeric) from public;
grant execute on function public.credit_landwars_wallet(numeric) to authenticated;

-- ----------------------------------------------------------------------------
-- RPC: purchase_bidpack — atomic Debit + Credit together
-- ----------------------------------------------------------------------------
create or replace function public.purchase_bidpack(naira_amount numeric, credit_amount numeric)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_wallet_balance numeric;
  v_landwars_balance numeric;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if naira_amount is null or naira_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  if credit_amount is null or credit_amount <= 0 then
    raise exception 'Invalid amount';
  end if;

  update public.users
     set cash_balance = cash_balance - naira_amount
   where id = v_user_id
     and cash_balance >= naira_amount;

  if not found then
    raise exception 'Insufficient funds';
  end if;

  update public.users
     set bidding_balance = bidding_balance + credit_amount
   where id = v_user_id;

  insert into public.transactions (user_id, type, amount_naira, amount_credits, reference, status)
  values (
    v_user_id,
    'credit_landwars',
    naira_amount,
    credit_amount,
    'bidpack_' || v_user_id || '_' || floor(extract(epoch from clock_timestamp()) * 1000)::text,
    'success'
  );

  select cash_balance into v_wallet_balance
    from public.users
   where id = v_user_id;

  select bidding_balance into v_landwars_balance
    from public.users
   where id = v_user_id;

  return json_build_object(
    'wallet_balance', v_wallet_balance,
    'landwars_balance', v_landwars_balance
  );
end;
$$;

revoke all on function public.purchase_bidpack(numeric, numeric) from public;
grant execute on function public.purchase_bidpack(numeric, numeric) to authenticated;
