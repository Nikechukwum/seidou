import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit: COOLDOWN READER — how long until each fruit can be used again
// by the caller on this table.
//
//   GET   Read-only `peek_fruit_cooldowns`: returns the fruits the CALLER is
//         currently cooling down on this auction as { fruit_id: seconds }.
//         The ability-fruits page polls this while it is open to paint "N s"
//         on Activate buttons, and the table page checks it before firing an
//         armed fruit so a player is never made to watch an animation the
//         server would refuse.
//
// There is no POST here: cooldowns are only written by the fruit RPCs
// themselves, inside the same transaction that commits the bid move.

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

        const { data, error } = await supabase.rpc('peek_fruit_cooldowns', {
            p_auction_id: auctionId,
        })

        if (error) {
            console.error('[landwars/fruit-cooldown] peek RPC error:', error.message, error)
            return NextResponse.json({ error: error.message || 'Could not read the fruit cooldowns.' }, { status: 400 })
        }

        const result = Array.isArray(data) ? data[0] : data
        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/fruit-cooldown] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}