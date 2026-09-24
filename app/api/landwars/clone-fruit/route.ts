import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit: CLONE — duplicate any ability fruit you own (+2 copies).
//
//   POST  The commit. `clone_ability` validates the target fruit (never the
//         Clone fruit itself), refuses while the caller is frozen or the Clone
//         Fruit is on its 20s cooldown, and starts that cooldown. The client
//         then consumes one Clone Fruit use and grants +2 uses of the chosen
//         fruit to its own per-auction ledger (master prompt: "One clone
//         action creates 2 additional copies. So 1 becomes 3").
//
//   There is no GET: the carousel lists your own possession, which lives in
//   the client ledger (lib/fruitUsage.ts) — nothing to fetch.

export async function POST(request: NextRequest) {
    try {
        let body: { auctionId?: unknown; targetFruitId?: unknown }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
        }

        const auctionId = String(body?.auctionId ?? '').trim()
        const targetFruitId = String(body?.targetFruitId ?? '').trim()
        if (!auctionId) {
            return NextResponse.json({ error: 'auctionId is required.' }, { status: 400 })
        }
        if (!targetFruitId) {
            return NextResponse.json({ error: 'targetFruitId is required.' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        const { data, error } = await supabase.rpc('clone_ability', {
            p_auction_id: auctionId,
            p_target_fruit_id: targetFruitId,
        })

        if (error) {
            console.error('[landwars/clone-fruit] RPC error:', error.message, error)
            // "…is still cooling down", "You are currently frozen", "That fruit
            // cannot be cloned" are all meant to reach the player, so they
            // surface as plain error copy like the other fruit routes.
            return NextResponse.json({ error: error.message || 'Could not clone that fruit.' }, { status: 400 })
        }

        const result = Array.isArray(data) ? data[0] : data
        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/clone-fruit] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}