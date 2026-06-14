import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    const { auctionId, bidAmount } = await request.json()

    if (!auctionId || bidAmount == null) {
        return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data: userData } = await supabase
        .from('users')
        .select('bidding_balance')
        .eq('id', user.id)
        .single()

    if (!userData) {
        return NextResponse.json({ error: 'Could not verify your balance.' }, { status: 500 })
    }

    if (userData.bidding_balance < bidAmount) {
        return NextResponse.json({ error: 'Insufficient bidding balance.' }, { status: 400 })
    }

    const { data: existing } = await supabase
        .from('Bids')
        .select('id, bidAmount')
        .eq('auctionId', auctionId)
        .eq('userId', user.id)
        .single()

    if (existing) {
        const { error } = await supabase
            .from('Bids')
            .update({ bidAmount: existing.bidAmount + bidAmount })
            .eq('id', existing.id)

        if (error) {
            return NextResponse.json({ error: 'Could not update your bid.' }, { status: 500 })
        }
    } else {
        const { error } = await supabase
            .from('Bids')
            .insert({ auctionId, userId: user.id, bidAmount })

        if (error) {
            return NextResponse.json({ error: 'Could not place your bid.' }, { status: 500 })
        }
    }

    const { error: balanceError } = await supabase
        .from('users')
        .update({ bidding_balance: userData.bidding_balance - bidAmount })
        .eq('id', user.id)

    if (balanceError) {
        return NextResponse.json({ error: 'Bid placed but failed to deduct balance. Please contact support.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: existing ? 'update' : 'insert' })
}
