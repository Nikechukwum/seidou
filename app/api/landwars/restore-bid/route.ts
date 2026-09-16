import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit: RESTORE — refund the bidding currency spent in this auction.
// The UI fires this while the "Restoring..." frame is on screen and holds that
// frame until the reply lands, so nothing is reported as restored before it is.
// The RPC figures out the refund itself (the activator's current bid), so the
// request never carries an amount; a zero bid comes back as refunded: 0 rather
// than an error, because the player may be restoring ability fruits only.
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

        const { data, error } = await supabase.rpc('restore_bid', {
            p_auction_id: auctionId,
        })

        if (error) {
            console.error('[landwars/restore-bid] RPC error:', error.message, error)
            const message = error.message || 'Could not restore your resources.'
            // "Nothing to restore" and "not on the table" surface as plain error
            // messages for the client toast.
            return NextResponse.json({ error: message }, { status: 400 })
        }

        // Supabase rpc() may return the json result directly or wrapped in an array
        const result = Array.isArray(data) ? data[0] : data

        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/restore-bid] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}