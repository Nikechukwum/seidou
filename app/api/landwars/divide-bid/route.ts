import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit: DIVIDE — commit a bid division.
// The UI updates the table optimistically, then reconciles with this endpoint.
//
// The DIVIDE fruit ALWAYS hits whoever currently holds #1 position, so the
// target is derived server-side (inside the RPC) from the highest bid on the
// auction — it is never taken from the request body.
const ALLOWED_FACTORS = [2, 3, 4]

export async function POST(request: NextRequest) {
    try {
        let body: { auctionId?: unknown; factor?: unknown }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
        }

        const auctionId = String(body?.auctionId ?? '').trim()
        const factor = Number(body?.factor)

        if (!auctionId) {
            return NextResponse.json({ error: 'auctionId is required.' }, { status: 400 })
        }
        // Design spec: default ÷2, upgradeable to ÷3 / ÷4.
        if (!ALLOWED_FACTORS.includes(factor)) {
            return NextResponse.json({ error: 'factor must be 2, 3 or 4.' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        const { data, error } = await supabase.rpc('divide_bid', {
            p_auction_id: auctionId,
            p_factor: factor,
        })

        if (error) {
            console.error('[landwars/divide-bid] RPC error:', error.message, error)
            return NextResponse.json({ error: error.message || 'Could not divide the bid.' }, { status: 400 })
        }

        // Supabase rpc() may return the json result directly or wrapped in an array
        const result = Array.isArray(data) ? data[0] : data

        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/divide-bid] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}