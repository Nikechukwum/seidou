import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit: COPY — copy one of the last 3 ability fruits used on the table.
//
//   GET   Read-only `peek_copy_history`: the last 3 DISTINCT ability fruits
//         activated on this auction (each once, most recent use), as
//         { fruit_id, seconds_ago }. The picker renders this — max 3 rows,
//         or fewer / none when few abilities have been used.
//
//   POST  The commit. `copy_ability` validates the target fruit (never Copy
//         Fruit itself), refuses while the caller is frozen or the Copy Fruit
//         is on its 20s cooldown, and starts that cooldown. The client then
//         consumes one Copy Fruit use and grants the copied ability to its own
//         per-auction ledger.

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

        const { data, error } = await supabase.rpc('peek_copy_history', {
            p_auction_id: auctionId,
        })

        if (error) {
            console.error('[landwars/copy-fruit] peek RPC error:', error.message, error)
            return NextResponse.json({ error: error.message || 'Could not read the ability history.' }, { status: 400 })
        }

        const result = Array.isArray(data) ? data[0] : data
        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/copy-fruit] unexpected history error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}

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

        const { data, error } = await supabase.rpc('copy_ability', {
            p_auction_id: auctionId,
            p_target_fruit_id: targetFruitId,
        })

        if (error) {
            console.error('[landwars/copy-fruit] RPC error:', error.message, error)
            // "…is still cooling down", "You are currently frozen", "You can
            // only copy real abilities" are all meant to reach the player, so
            // they surface as plain error copy like the other fruit routes.
            return NextResponse.json({ error: error.message || 'Could not copy that ability.' }, { status: 400 })
        }

        const result = Array.isArray(data) ? data[0] : data
        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/copy-fruit] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}