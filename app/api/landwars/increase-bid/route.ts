import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    let body: { auctionId?: unknown; increment?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const auctionId = String(body?.auctionId ?? '').trim()
    const increment = Number(body?.increment)

    if (!auctionId) {
      return NextResponse.json({ error: 'auctionId is required.' }, { status: 400 })
    }
    if (!Number.isFinite(increment) || increment <= 0) {
      return NextResponse.json({ error: 'increment must be greater than 0.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('bidding_balance')
      .eq('id', user.id)
      .maybeSingle()

    const currentBalance = Number(profile?.bidding_balance ?? 0)
    if (currentBalance < increment) {
      return NextResponse.json({ error: 'Not enough Bidding Credits.' }, { status: 400 })
    }

    const { data: existing } = await supabase
      .from('Bids')
      .select('id, bidAmount')
      .eq('auctionId', auctionId)
      .eq('userId', user.id)
      .maybeSingle()

    if (!existing) {
      return NextResponse.json({ error: 'No active bid found for this auction.' }, { status: 400 })
    }

    // Deduct Bidding Credits from the wallet (guarded so the balance can't go negative).
    const { data: updated, error: balanceError } = await supabase
      .from('users')
      .update({ bidding_balance: currentBalance - increment })
      .eq('id', user.id)
      .gte('bidding_balance', increment)
      .select('bidding_balance')
      .maybeSingle()

    if (balanceError || !updated) {
      console.error('[landwars/increase-bid] balance update failed:', balanceError?.message ?? 'no row matched')
      return NextResponse.json({ error: 'Not enough Bidding Credits.' }, { status: 400 })
    }

    const newBidAmount = Number(existing.bidAmount) + increment
    const { error: bidError } = await supabase
      .from('Bids')
      .update({ bidAmount: newBidAmount })
      .eq('id', existing.id)

    if (bidError) {
      console.error('[landwars/increase-bid] bid update failed:', bidError.message)
      return NextResponse.json({ error: 'Could not update your bid.' }, { status: 500 })
    }

    const { error: logError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'bid_increase',
        amount_credits: increment,
        reference: `increase_bid_${user.id}_${Date.now()}`,
        status: 'success',
      })

    if (logError) {
      console.error('[landwars/increase-bid] transaction log failed:', logError.message)
    }

    return NextResponse.json({
      success: true,
      bidAmount: newBidAmount,
      bidding_balance: Number(updated.bidding_balance),
    })
  } catch (err) {
    console.error('[landwars/increase-bid] unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
