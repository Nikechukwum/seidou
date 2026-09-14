import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit: POSITION SWAP — commit the bid amount swap.
// The UI plays the 5-frame animation (appear, travel, explode, settled) and
// fires this endpoint as the fruit explodes. The RPC finds the highest bidder
// itself, so the request never carries a target — it cannot be aimed manually.
export async function POST(request: NextRequest) {
    try {
        let body: { auctionId?: unknown }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
        }

        const auctionId = String(body?.auctionId ?? '').trim()
        if (!auctionId) {
            return NextResponse.json({ error: 'auctionId is required.' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        const { data, error } = await supabase.rpc('swap_positions', {
            p_auction_id: auctionId,
        })

        if (error) {
            console.error('[landwars/swap-bid] RPC error:', error.message, error)
            const message = error.message || 'Could not swap positions.'
            // The "already first" rejection surfaces as a plain error message,
            // so clients pass it straight to the toast. 400, not 403: the user
            // is allowed to use the fruit, just not from first position.
            return NextResponse.json({ error: message }, { status: 400 })
        }

        // Supabase rpc() may return the json result directly or wrapped in an array
        const result = Array.isArray(data) ? data[0] : data

        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/swap-bid] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}