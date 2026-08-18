import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
    const { auctionId, bidAmount } = await request.json()

    if (!auctionId || bidAmount == null || bidAmount <= 0) {
        return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('place_bid', {
        p_auction_id: auctionId,
        p_bid_amount: Number(bidAmount),
    })

    if (error) {
        console.error('[auction/bid] RPC error:', error.message, error)
        return NextResponse.json({ error: error.message || 'Could not place your bid.' }, { status: 400 })
    }

    // Supabase rpc() may return the json result directly or wrapped in an array
    const result = Array.isArray(data) ? data[0] : data

    return NextResponse.json(result)
}
