// ============================================================================
// ABILITY FRUIT INTERACTION SYSTEM — client-side model
// ----------------------------------------------------------------------------
// Phase 2 of the ability fruits: DIVIDE, POSITION SWAP, STEAL and FREEZE no
// longer resolve instantly. Casting one parks a PENDING interaction on the
// server; targeted players get a 5-second reaction window (the "spidey
// sense" warning) in which they can play SHIELD (block their share) or MIRROR
// (block AND throw it back at the caster); then the server sweep applies the
// effect and the feed reports the outcome.
//
// Every client polls the feed (GET /api/landwars/ability-interactions) at
// FEED_POLL_MS. The GET first runs the server sweep, so the response is
// always post-resolution truth — there are no authoritative client timers.
//
// Keep in step with the SQL side:
//   - REACTION_WINDOW_S mirrors public.reaction_window_s()
//     in supabase/landwars_ability_interactions.sql.
//   - The feed JSON mirrors public.peek_ability_interactions().
// ============================================================================

import type { AbilityFruitId } from '@/lib/abilityFruits'

export type InteractiveEffectId = 'divide' | 'swap' | 'thief' | 'freeze'

/** How long the pendin interaction is visible before landing (seconds). */
export const REACTION_WINDOW_S = 5

/** First beat of the window: the fruit visibly crosses the table. */
export const MANIFEST_MS = 1000

/** Feed poll cadence. The GET runs the server sweep first. */
export const FEED_POLL_MS = 1000

/** How long resolved interactions stay in the feed for impact/feedback. */
export const FEED_RETENTION_MS = 45_000

export type InteractionOutcome = {
    status: 'applied' | 'blocked' | 'reflected' | 'no_op' | 'ready'
    reason?: string
    target_user_id?: string
    reflected_user_id?: string
    divisor?: number
    previous_bid?: number
    bid_after?: number
    leader_id?: string
    actor_previous?: number
    actor_new?: number
    leader_previous?: number
    leader_new?: number
    eligible?: string[]
    blocked?: string[]
    reflected?: string[]
    frozen?: string[]
    total_stolen?: number
    reflected_burn?: number
    committed?: boolean
}

export type AbilityInteraction = {
    id: number
    effect_type: InteractiveEffectId
    factor: number | null
    state: 'pending' | 'resolved'
    actor_user_id: string
    actor_is_me: boolean
    target_user_ids: string[]
    is_targeting_me: boolean
    blocked_by: string[]
    reflected_by: string[]
    created_at: string
    resolve_at: string
    window_remaining_s: number
    resolved_at: string | null
    outcome: InteractionOutcome | null
}

export type InteractionFeed = {
    now: string
    server_epoch_ms: number
    interactions: AbilityInteraction[]
}

// ----------------------------------------------------------------------------
// Effect metadata — the bridge from the effect_type used by the RPCs to the
// fruit ids/pills the UI already knows.
// ----------------------------------------------------------------------------
export const INTERACTIVE_EFFECT_IDS: InteractiveEffectId[] = ['divide', 'swap', 'thief', 'freeze']

export const INTERACTIVE_EFFECT_META: Record<InteractiveEffectId, {
    fruitId: AbilityFruitId
    label: string
    short: string
}> = {
    divide: { fruitId: 'divide', label: 'Divide Fruit', short: 'Divide' },
    swap: { fruitId: 'swap', label: 'Position Swap', short: 'Swap' },
    thief: { fruitId: 'thief', label: 'Steal Bidding Currency', short: 'Steal' },
    freeze: { fruitId: 'freeze', label: 'Freeze Fruit', short: 'Freeze' },
}

export function isInteractiveEffectId(id: unknown): id is InteractiveEffectId {
    return typeof id === 'string' && (INTERACTIVE_EFFECT_IDS as string[]).includes(id)
}

export function effectFruitId(effect: string | null | undefined): AbilityFruitId | undefined {
    return effect ? INTERACTIVE_EFFECT_META[effect as InteractiveEffectId]?.fruitId : undefined
}

export function effectLabel(effect: string | null | undefined): string {
    return INTERACTIVE_EFFECT_META[effect as InteractiveEffectId]?.label ?? 'ability fruit'
}

export function effectShortLabel(effect: string | null | undefined): string {
    return INTERACTIVE_EFFECT_META[effect as InteractiveEffectId]?.short ?? 'Fruit'
}

// ----------------------------------------------------------------------------
// Server-clock anchoring. quoted ISO "resolve_at" timestamps came from the
// server, so comparing them to Date.now() locally can drift by the client's
// clock skew. The feed returns server_epoch_ms, so the hook captures the skew
// once per poll and everything below works in server time.
// ----------------------------------------------------------------------------
export function feedClockOffsetMs(feed: InteractionFeed | null): number {
    if (!feed) return 0
    return feed.server_epoch_ms - Date.now()
}

function isoToMs(iso: string | null | undefined): number | null {
    if (!iso) return null
    const ms = Date.parse(iso)
    return Number.isFinite(ms) ? ms : null
}

export type InteractionPhase = 'manifesting' | 'reacting' | 'impact' | 'feedback' | null

export function phaseForInteraction(
    it: AbilityInteraction,
    serverNowMs: number,
): InteractionPhase {
    const createdMs = isoToMs(it.created_at)
    const resolveMs = isoToMs(it.resolve_at)
    const resolvedMs = isoToMs(it.resolved_at)

    if (it.state === 'pending') {
        const remaining = resolveMs ? Math.max(0, resolveMs - serverNowMs) : 0
        if (remaining <= 0) return 'impact'
        if (createdMs && serverNowMs - createdMs < MANIFEST_MS) return 'manifesting'
        return 'reacting'
    }

    if (resolvedMs) {
        const since = serverNowMs - resolvedMs
        if (since < MANIFEST_MS * 2) return 'impact'
        if (since < FEED_RETENTION_MS) return 'feedback'
    }
    return null
}

export function windowRemainingSeconds(it: AbilityInteraction, serverNowMs: number): number {
    if (it.state !== 'pending') return 0
    const resolveMs = isoToMs(it.resolve_at)
    if (!resolveMs) return it.window_remaining_s
    return Math.max(0, Math.ceil((resolveMs - serverNowMs) / 1000))
}

// ----------------------------------------------------------------------------
// Outcome helpers — the toast/label copy the page and picker show.
// ----------------------------------------------------------------------------
export function iBlockedMe(it: AbilityInteraction, myUserId: string): boolean {
    return it.state === 'resolved'
        && (it.blocked_by ?? []).includes(myUserId)
}

export function iReflectedMe(it: AbilityInteraction, myUserId: string): boolean {
    return it.state === 'resolved'
        && (it.reflected_by ?? []).includes(myUserId)
}

/** Was I hit by this resolved effect (I was a target and did not block)? */
export function iWasAffected(it: AbilityInteraction, myUserId: string): boolean {
    if (it.state !== 'resolved' || it.actor_user_id === myUserId) return false
    if ((it.blocked_by ?? []).includes(myUserId)) return false
    if ((it.reflected_by ?? []).includes(myUserId)) return false
    if (!(it.target_user_ids ?? []).includes(myUserId)) return false

    if (it.effect_type === 'thief') {
        // the drain targets are the outcome's eligible list
        return (it.outcome?.eligible ?? []).includes(myUserId)
    }
    if (it.effect_type === 'freeze') {
        return (it.outcome?.frozen ?? []).includes(myUserId)
    }
    // divide/swap hit a single target
    return it.outcome?.target_user_id === myUserId
        || it.outcome?.leader_id === myUserId
}

/** Did MY cast fully whiff (every target blocked/mirrored)? */
export function wasFullyBlocked(it: AbilityInteraction): boolean {
    return it.outcome?.status === 'blocked'
}