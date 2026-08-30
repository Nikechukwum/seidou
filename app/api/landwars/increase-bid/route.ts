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

        const { data, error } = await supabase.rpc('place_bid', {
            p_auction_id: auctionId,
            p_bid_amount: increment,
        })

        if (error) {
            console.error('[landwars/increase-bid] RPC error:', error.message, error)
            return NextResponse.json({ error: error.message || 'Could not place your bid.' }, { status: 400 })
        }

        // Supabase rpc() may return the json result directly or wrapped in an array
        const result = Array.isArray(data) ? data[0] : data

        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/increase-bid] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}
