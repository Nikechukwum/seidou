import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit: NEGATE — cancel the last effect that hit the caller and put
// their bid back to what it was before that effect landed.
//
// Two verbs, because the design sheet asks for both halves:
//
//   GET   "Prevent Negate activation if no recent effect exists." A read-only
//         peek at the top of the caller's effect stack. The table page calls
//         this BEFORE playing a frame, so the player is told there is nothing
//         to negate instead of watching the whole animation for nothing. It
//         also returns the amount the bid will be restored to (what the
//         animation counts up to) and the seconds left on the cooldown.
//
//   POST  The commit. Pops the newest un-negated effect, flags it, restores
//         the bid and starts the cooldown — all inside one transaction.
//
// SELF ONLY: both RPCs work off auth.uid(), so the target is never taken from
// the request and a crafted call cannot rewind someone else's bid.

export async function GET(request: NextRequest) {
    try {
        const auctionId = String(request.nextUrl.searchParams.get('auctionId') ?? '').trim()
        if (!auctionId) {
            return NextResponse.json({ error: 'auctionId is required.' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        const { data, error } = await supabase.rpc('peek_bid_effect', {
            p_auction_id: auctionId,
        })

        if (error) {
            console.error('[landwars/negate-bid] peek RPC error:', error.message, error)
            return NextResponse.json({ error: error.message || 'Could not read your effect history.' }, { status: 400 })
        }

        const result = Array.isArray(data) ? data[0] : data
        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/negate-bid] unexpected peek error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}

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

        const { data, error } = await supabase.rpc('negate_bid', {
            p_auction_id: auctionId,
        })

        if (error) {
            console.error('[landwars/negate-bid] RPC error:', error.message, error)
            // "No recent effect to negate" and the cooldown message are meant
            // to reach the player, so they surface as plain error copy.
            return NextResponse.json({ error: error.message || 'Could not negate the effect.' }, { status: 400 })
        }

        const result = Array.isArray(data) ? data[0] : data
        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/negate-bid] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}
