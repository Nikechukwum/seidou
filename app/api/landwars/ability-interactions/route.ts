import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Ability Fruit INTERACTION SYSTEM — the reaction-window feed.
//
//   GET   Sync-then-peek feed. The GET first runs the SERVER SWEEP
//         (sync_ability_interactions) so every expired pending interaction is
//         resolved before the caller reads (peek_ability_interactions) — this
//         is the server-authoritative resolution the CEO's proposal asks for:
//         effects are applied on the database, never from a client timer.
//         Response shape:
//           { now, server_epoch_ms, interactions: [
//               { id, effect_type, factor, state, actor_user_id, actor_is_me,
//                 target_user_ids, is_targeting_me, blocked_by, reflected_by,
//                 created_at, resolve_at, window_remaining_s, resolved_at,
//                 outcome } ] }
//
//   POST  The two writes:
//           action: 'cast'  { effectType, factor? }  -> cast_ability_interaction
//                 the attacker parks the effect (5s reaction window opens).
//           action: 'respond' { interactionId, fruitId } -> respond_to_interaction
//                 the defender plays Shield (block) or Mirror (reflect).

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

        // 1) Resolve everything that has expired since the last read.
        const { error: syncError } = await supabase.rpc('sync_ability_interactions', {
            p_auction_id: auctionId,
        })
        if (syncError) {
            console.error('[landwars/ability-interactions] sync RPC error:', syncError.message, syncError)
            return NextResponse.json({ error: syncError.message || 'Could not resolve the ability feed.' }, { status: 400 })
        }

        // 2) Read the post-resolution truth.
        const { data, error } = await supabase.rpc('peek_ability_interactions', {
            p_auction_id: auctionId,
        })
        if (error) {
            console.error('[landwars/ability-interactions] peek RPC error:', error.message, error)
            return NextResponse.json({ error: error.message || 'Could not read the ability feed.' }, { status: 400 })
        }

        const result = Array.isArray(data) ? data[0] : data
        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/ability-interactions] unexpected feed error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        let body: {
            auctionId?: unknown
            action?: unknown
            effectType?: unknown
            factor?: unknown
            interactionId?: unknown
            fruitId?: unknown
        }
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
        }

        const auctionId = String(body?.auctionId ?? '').trim()
        const action = String(body?.action ?? '').trim()
        if (!auctionId) {
            return NextResponse.json({ error: 'auctionId is required.' }, { status: 400 })
        }
        if (action !== 'cast' && action !== 'respond') {
            return NextResponse.json({ error: 'action must be "cast" or "respond".' }, { status: 400 })
        }

        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        if (action === 'cast') {
            const effectType = String(body?.effectType ?? '').trim()
            const factor = body?.factor === undefined || body?.factor === null || body?.factor === ''
                ? null
                : Number(body.factor)
            if (!effectType) {
                return NextResponse.json({ error: 'effectType is required.' }, { status: 400 })
            }
            if (factor !== null && (!Number.isFinite(factor) || factor < 2 || factor > 4)) {
                return NextResponse.json({ error: 'factor must be between 2 and 4.' }, { status: 400 })
            }

            const { data, error } = await supabase.rpc('cast_ability_interaction', {
                p_auction_id: auctionId,
                p_effect_type: effectType,
                p_factor: factor,
            })
            if (error) {
                console.error('[landwars/ability-interactions] cast RPC error:', error.message, error)
                return NextResponse.json({ error: error.message || 'Could not cast that fruit.' }, { status: 400 })
            }
            const result = Array.isArray(data) ? data[0] : data
            return NextResponse.json(result)
        }

        // respond
        const interactionId = Number(body?.interactionId)
        const fruitId = String(body?.fruitId ?? '').trim()
        if (!Number.isInteger(interactionId) || interactionId <= 0) {
            return NextResponse.json({ error: 'interactionId is required.' }, { status: 400 })
        }
        if (fruitId !== 'shield' && fruitId !== 'mirror') {
            return NextResponse.json({ error: 'fruitId must be "shield" or "mirror".' }, { status: 400 })
        }

        const { data, error } = await supabase.rpc('respond_to_interaction', {
            p_auction_id: auctionId,
            p_interaction_id: interactionId,
            p_fruit_id: fruitId,
        })
        if (error) {
            console.error('[landwars/ability-interactions] respond RPC error:', error.message, error)
            // "…is still cooling down", "That effect does not target you", "The
            // reaction window has passed" are all meant to reach the defender.
            return NextResponse.json({ error: error.message || 'Could not counter that effect.' }, { status: 400 })
        }
        const result = Array.isArray(data) ? data[0] : data
        return NextResponse.json(result)
    } catch (err) {
        console.error('[landwars/ability-interactions] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}