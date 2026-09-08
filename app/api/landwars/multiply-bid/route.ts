import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit: MULTIPLY — commit a bid multiplication.
// The UI updates the table optimistically, then reconciles with this endpoint.
//
// SELF ONLY: a player may only multiply their own bid. The target is taken from
// the session, never from the request body; if the body names someone else the
// call is rejected outright. The RPC enforces the same rule independently.
const ALLOWED_FACTORS = [2, 3, 4, 5]

export async function POST(request: NextRequest) {
    try {
        let body: { auctionId?: unknown; targetUserId?: unknown; factor?: unknown }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
        }

        const auctionId = String(body?.auctionId ?? '').trim()
        const targetUserId = String(body?.targetUserId ?? '').trim()
        const factor = Number(body?.factor)

        if (!auctionId) {
            return NextResponse.json({ error: 'auctionId is required.' }, { status: 400 })
        }
        // Design spec: default x2, upgradeable to x3 / x4 / x5. Anything outside
        // that set is not a real fruit level.
        if (!ALLOWED_FACTORS.includes(factor)) {
            return NextResponse.json({ error: 'factor must be 2, 3, 4 or 5.' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        // SELF ONLY: the body may not aim this at anyone but the caller.
        if (targetUserId && targetUserId !== user.id) {
            return NextResponse.json({ error: 'You can only multiply your own bid.' }, { status: 403 })
        }

        const { data, error } = await supabase.rpc('multiply_bid', {
            p_auction_id: auctionId,
            p_target_user_id: user.id,
            p_factor: factor,
        })

        if (error) {
            console.error('[landwars/multiply-bid] RPC error:', error.message, error)
            return NextResponse.json({ error: error.message || 'Could not multiply the bid.' }, { status: 400 })
        }

        // Supabase rpc() may return the json result directly or wrapped in an array
        const result = Array.isArray(data) ? data[0] : data

        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/multiply-bid] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}