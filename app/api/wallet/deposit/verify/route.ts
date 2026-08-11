import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: { reference?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { reference } = body
  if (!reference || typeof reference !== 'string' || reference.trim() === '') {
    return NextResponse.json({ error: 'Missing reference.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY
  if (!secretKey) {
    return NextResponse.json(
      { error: 'Payment verification is not configured.' },
      { status: 500 }
    )
  }

  try {
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${secretKey}` },
        cache: 'no-store',
      }
    )

    const paystackBody = await paystackRes.json().catch(() => null)

    if (!paystackRes.ok || !paystackBody?.status) {
      return NextResponse.json(
        { error: 'Could not verify payment with Paystack.' },
        { status: 502 }
      )
    }

    const tx = paystackBody.data
    if (!tx || tx.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment was not successful.' },
        { status: 400 }
      )
    }

    // Make sure this payment actually belongs to the signed-in user
    const metadata = tx.metadata ?? {}
    if (metadata.userId !== user.id || metadata.type !== 'wallet_deposit') {
      return NextResponse.json(
        { error: 'Payment does not match this account.' },
        { status: 400 }
      )
    }

    // Paystack returns the amount in kobo
    const amount = Number(tx.amount) / 100
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: 'Invalid payment amount.' },
        { status: 400 }
      )
    }

    // Idempotency: if this reference was already processed, just return the
    // current balance instead of crediting twice.
    const { data: existingTx } = await supabase
      .from('transactions')
      .select('id, status')
      .eq('reference', reference)
      .maybeSingle()

    if (existingTx && existingTx.status === 'success') {
      const { data: existingUser } = await supabase
        .from('users')
        .select('cash_balance')
        .eq('id', user.id)
        .single()

      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        newBalance: Number(existingUser?.cash_balance ?? 0),
      })
    }

    // Credit the wallet server-side
    const { data: currentUser } = await supabase
      .from('users')
      .select('cash_balance')
      .eq('id', user.id)
      .single()

    const previousBalance = Number(currentUser?.cash_balance ?? 0)
    const newBalance = previousBalance + amount

    const { error: updateError } = await supabase
      .from('users')
      .update({ cash_balance: newBalance })
      .eq('id', user.id)

    if (updateError) {
      console.error('[wallet/deposit/verify] balance update failed:', updateError.message)
      return NextResponse.json(
        { error: 'Could not credit your wallet. Please contact support.' },
        { status: 500 }
      )
    }

    // Audit log (best effort — the transactions table is created by
    // supabase/schema.sql; deposits still succeed if it is not present).
    const { error: auditError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'credit_main',
        amount_naira: amount,
        amount_credits: null,
        reference,
        status: 'success',
      })

    if (auditError) {
      console.error('[wallet/deposit/verify] audit insert failed:', auditError.message)
    }

    return NextResponse.json({ success: true, newBalance })
  } catch (err) {
    console.error('[wallet/deposit/verify] unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
