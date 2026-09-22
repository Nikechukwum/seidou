import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit: FREEZE — freeze every other player's bids and fruits for 30s.
//
// Two verbs:
//
//   GET   Read-only `freeze_status`: is the CALLER frozen on this table, and
//         how many seconds remain? The table page polls this while it is open
//         so a frozen player can show their own blue border and the "you are
//         currently frozen — wait Xs" popup with a live countdown.
//
//   POST  The commit. `freeze_bid` writes one 'freeze' stack entry per other
//         player (which is what negate_bid pops to release one of them) and
//         refuses while another freeze is already active on the table.
//
// AUTHORITY: who the freeze applies to is derived inside the RPC from the
// Bids rows — a crafted request can never freeze an arbitrary list of users.
// The activator is never a target, so they can keep bidding.

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

        const { data, error } = await supabase.rpc('freeze_status', {
            p_auction_id: auctionId,
        })

        if (error) {
            console.error('[landwars/freeze-bid] freeze_status RPC error:', error.message, error)
            return NextResponse.json({ error: error.message || 'Could not read the freeze status.' }, { status: 400 })
        }

        const result = Array.isArray(data) ? data[0] : data
        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/freeze-bid] unexpected freeze_status error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        let body: { auctionId?: unknown; durationS?: unknown }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
        }

        const auctionId = String(body?.auctionId ?? '').trim()
        const durationS = Number(body?.durationS ?? 30)

        if (!auctionId) {
            return NextResponse.json({ error: 'auctionId is required.' }, { status: 400 })
        }
        if (!Number.isInteger(durationS) || durationS <= 0 || durationS > 120) {
            return NextResponse.json({ error: 'durationS must be a whole number between 1 and 120.' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        const { data, error } = await supabase.rpc('freeze_bid', {
            p_auction_id: auctionId,
            p_duration_s: durationS,
        })

        if (error) {
            console.error('[landwars/freeze-bid] RPC error:', error.message, error)
            // "The Freeze Fruit is already active..." is meant to reach the
            // player, so it surfaces as plain error copy like the negate route.
            return NextResponse.json({ error: error.message || 'Could not freeze the table.' }, { status: 400 })
        }

        const result = Array.isArray(data) ? data[0] : data
        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/freeze-bid] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}