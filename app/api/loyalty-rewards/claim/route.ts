import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ClaimResponse } from '@/lib/loyalty-rewards'

const STATUS_CODES: Record<ClaimResponse['status'], number> = {
    claimed: 200,
    not_found: 409,
    unknown_source: 422,
}

// Claims one loyalty reward for the signed-in user. The body carries only the
// reward id: the user comes from the session and the amount is decided inside
// claim_loyalty_reward (supabase/loyalty_rewards_claim.sql).
export async function POST(request: NextRequest) {
    let rewardId: unknown
    try {
        ({ rewardId } = await request.json())
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    if (typeof rewardId !== 'number' || !Number.isSafeInteger(rewardId) || rewardId <= 0) {
        return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const { data, error } = await supabase.rpc('claim_loyalty_reward', {
        p_reward_id: rewardId,
    })

    if (error) {
        if (error.code === '28000') {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }
        if (error.code === 'P0002') {
            return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
        }
        console.error('[loyalty-rewards/claim] RPC error:', error.message, error)
        return NextResponse.json({ error: 'Could not claim your reward.' }, { status: 500 })
    }

    // Supabase rpc() may return the json result directly or wrapped in an array
    const result = (Array.isArray(data) ? data[0] : data) as ClaimResponse | null

    if (!result || !(result.status in STATUS_CODES)) {
        console.error('[loyalty-rewards/claim] Unexpected RPC result:', data)
        return NextResponse.json({ error: 'Could not claim your reward.' }, { status: 500 })
    }

    return NextResponse.json(result, { status: STATUS_CODES[result.status] })
}
