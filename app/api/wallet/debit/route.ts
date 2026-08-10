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
      .select('cash_balance')
      .eq('id', user.id)
      .maybeSingle()

    const currentCash = Number(profile?.cash_balance ?? 0)
    if (currentCash < amount) {
      return NextResponse.json({ error: 'Insufficient funds.' }, { status: 400 })
    }

    const newCash = currentCash - amount

    const { data: updated, error } = await supabase
      .from('users')
      .update({ cash_balance: newCash })
      .eq('id', user.id)
      .gte('cash_balance', amount)
      .select('cash_balance')
      .maybeSingle()

    if (error || !updated) {
      console.error('[wallet/debit] update failed:', error?.message ?? 'no row matched')
      return NextResponse.json({ error: 'Insufficient funds.' }, { status: 400 })
    }

    return NextResponse.json({ success: true, newBalance: Number(updated.cash_balance) })
  } catch (err) {
    console.error('[wallet/debit] unexpected error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
