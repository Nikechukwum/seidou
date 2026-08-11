import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    let body: { amount?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const amount = Number(body?.amount)
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0.' }, { status: 400 })
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

    const newBidding = Number(profile?.bidding_balance ?? 0) + amount

    const { data: updated, error } = await supabase
      .from('users')
      .update({ bidding_balance: newBidding })
      .eq('id', user.id)
      .select('bidding_balance')
      .maybeSingle()

    if (error || !updated) {
      console.error('[landwars-wallet/credit] update failed:', error?.message ?? 'no row matched')
      return NextResponse.json(
        { error: 'Could not credit LandWars wallet.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, newBalance: Number(updated.bidding_balance) })
  } catch (err) {
    console.error('[landwars-wallet/credit] unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
