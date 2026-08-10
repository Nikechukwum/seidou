import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    let body: { naira_amount?: unknown; credit_amount?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const nairaAmount = Number(body?.naira_amount)
    const creditAmount = Number(body?.credit_amount)

    if (!Number.isFinite(nairaAmount) || nairaAmount <= 0) {
      return NextResponse.json({ error: 'naira_amount must be greater than 0.' }, { status: 400 })
    }
    if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
      return NextResponse.json({ error: 'credit_amount must be greater than 0.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('cash_balance, bidding_balance')
      .eq('id', user.id)
      .maybeSingle()

    const currentCash = Number(profile?.cash_balance ?? 0)
    const currentBidding = Number(profile?.bidding_balance ?? 0)

    if (currentCash < nairaAmount) {
      return NextResponse.json({ error: 'Insufficient funds.' }, { status: 400 })
    }

    // Conditional update guards against double-spending: the row is only
    // updated if the Naira balance is still >= the price.
    const newCash = currentCash - nairaAmount
    const newBidding = currentBidding + creditAmount

    const { data: updated, error } = await supabase
      .from('users')
      .update({ cash_balance: newCash, bidding_balance: newBidding })
      .eq('id', user.id)
      .gte('cash_balance', nairaAmount)
      .select('cash_balance, bidding_balance')
      .maybeSingle()

    if (error || !updated) {
      console.error('[landwars/purchase-bidpack] update failed:', error?.message ?? 'no row matched')
      return NextResponse.json({ error: 'Insufficient funds.' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      wallet_balance: Number(updated.cash_balance),
      landwars_balance: Number(updated.bidding_balance),
    })
  } catch (err) {
    console.error('[landwars/purchase-bidpack] unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
