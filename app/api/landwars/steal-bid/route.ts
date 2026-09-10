import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit: STEAL BIDDING CURRENCY — commit the pooled steal.
// The UI runs the 60s countdown + visuals, then reconciles with this endpoint
// once the timer hits zero. The RPC derives everyone to drain itself; it never
// reads a target list from the request, so it cannot be aimed at anyone.
export async function POST(request: NextRequest) {
    try {
        let body: { auctionId?: unknown; stealAmount?: unknown }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
        }

        const auctionId = String(body?.auctionId ?? '').trim()
        const stealAmount = Number(body?.stealAmount ?? 10000)

        if (!auctionId) {
            return NextResponse.json({ error: 'auctionId is required.' }, { status: 400 })
        }
        if (!Number.isFinite(stealAmount) || stealAmount <= 0) {
            return NextResponse.json({ error: 'stealAmount must be a positive number.' }, { status: 400 })
        }

        const supabase = await createClient()
        const [authResult, cookieNames] = await Promise.all([
            supabase.auth.getUser(),
            import('next/headers').then(async ({ cookies }) => (await cookies()).getAll().map(c => c.name)),
        ])
        const user = authResult.data.user
        if (!user) {
            // Distinguish "no session cookie reached the server" from "cookie
            // present but the session is invalid/expired" so triage is instant.
            const supabaseCookies = cookieNames.filter(n => n.startsWith('sb-'))
            console.error('[landwars/steal-bid] Unauthorized.', {
                reason: supabaseCookies.length ? 'session cookie present but invalid or expired' : 'no supabase session cookie sent by the browser',
                supabaseCookies,
                authError: authResult.error?.message ?? null,
            })
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        const { data, error } = await supabase.rpc('steal_bids', {
            p_auction_id: auctionId,
            p_steal_amount: stealAmount,
        })

        if (error) {
            console.error('[landwars/steal-bid] RPC error:', error.message, error)
            return NextResponse.json({ error: error.message || 'Could not steal the bidding currency.' }, { status: 400 })
        }

        // Supabase rpc() may return the json result directly or wrapped in an array
        const result = Array.isArray(data) ? data[0] : data

        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/steal-bid] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}