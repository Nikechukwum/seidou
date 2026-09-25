// ============================================================================
// ABILITY FRUIT USAGE LEDGER
// ----------------------------------------------------------------------------
// DEV NOTE (design, Restore sheet): "Restore should only return recently used
// Ability Fruits" and "Restore cannot be used if there is nothing to restore."
// Both need a record of what the player has actually SPENT this auction.
//
// The table page unmounts every time the player walks over to the Ability
// Fruits page and back (Activate navigates), so the ledger cannot live in a
// ref. It is kept in sessionStorage, keyed per auction, and is the single
// source of truth for:
//
//   • the "x N left" badge on the Ability Fruits page,
//   • the list of fruits the Restore summary gives back,
//   • the "nothing to restore" guard.
//
// TESTING PHASE: there is no server-side fruit inventory yet, so uses are
// counted against TESTING_PHASE_FRUIT_COUNT per auction session. Swap the
// storage calls for the real inventory API once fruits are purchasable —
// every caller goes through the four helpers below.
// ============================================================================

import { AbilityFruitId, TESTING_PHASE_FRUIT_COUNT } from './abilityFruits'

/** fruit id -> how many times it has been used in this auction. */
export type FruitUsage = Partial<Record<AbilityFruitId, number>>

const storageKey = (auctionId: string) => `seidou:fruit-usage:${auctionId}`

/** Everything the player has used on this table so far. */
export function getFruitUsage(auctionId: string): FruitUsage {
    if (typeof window === 'undefined' || !auctionId) return {}
    try {
        const raw = window.sessionStorage.getItem(storageKey(auctionId))
        if (!raw) return {}
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object') return {}
        // Drop anything that is not a positive count so a corrupted entry can
        // never hand the player free uses.
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>)
                .map(([id, n]) => [id, Number(n)] as const)
                .filter(([, n]) => Number.isFinite(n) && n > 0)
        ) as FruitUsage
    } catch {
        return {}
    }
}

/** Count one activation of `fruitId` against this auction. */
export function recordFruitUse(auctionId: string, fruitId: AbilityFruitId): FruitUsage {
    const next: FruitUsage = { ...getFruitUsage(auctionId) }
    next[fruitId] = (next[fruitId] ?? 0) + 1
    if (typeof window !== 'undefined' && auctionId) {
        try {
            window.sessionStorage.setItem(storageKey(auctionId), JSON.stringify(next))
        } catch {
            // storage full / blocked — the ledger is a convenience, never a blocker
        }
    }
    return next
}

/**
 * Restore hands the used fruits back, so the ledger is wiped. `keep` is the
 * Restore activation itself: the fruit that was just eaten does not come back.
 */
export function clearFruitUsage(auctionId: string, keep: FruitUsage = {}): void {
    if (typeof window === 'undefined' || !auctionId) return
    try {
        const remaining = Object.entries(keep).filter(([, n]) => Number(n) > 0)
        if (remaining.length === 0) {
            window.sessionStorage.removeItem(storageKey(auctionId))
            return
        }
        window.sessionStorage.setItem(storageKey(auctionId), JSON.stringify(Object.fromEntries(remaining)))
    } catch {
        // ignore — see recordFruitUse
    }
}

/** Uses left on a fruit for this auction, during the testing phase. */
export function remainingUses(usage: FruitUsage, fruitId: AbilityFruitId): number {
    return Math.max(0, TESTING_PHASE_FRUIT_COUNT - (usage[fruitId] ?? 0))
}

// ----------------------------------------------------------------------------
// COPIED FRUIT BONUSES
// ----------------------------------------------------------------------------
// The Copy Fruit hands the player an EXTRA use of whatever ability it copied,
// above their normal allocation. Uses are spent (recordFruitUse) but the bonus
// comes from its own small ledger, so copying multiply twice gives your
// multiply two extra uses on top of the base ten. Restore's clearFruitUsage
// intentionally leaves these alone — a copied ability is not "something you
// used", so it is not something to give back.
// ----------------------------------------------------------------------------

export type FruitBonuses = Partial<Record<AbilityFruitId, number>>

const bonusKey = (auctionId: string) => `seidou:fruit-bonus:${auctionId}`

/** Extra uses earned by COPYING fruits on this auction. */
export function getFruitBonuses(auctionId: string): FruitBonuses {
    if (typeof window === 'undefined' || !auctionId) return {}
    try {
        const raw = window.sessionStorage.getItem(bonusKey(auctionId))
        if (!raw) return {}
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object') return {}
        return parsed as FruitBonuses
    } catch {
        return {}
    }
}

/**
 * Grant bonus uses of `fruitId`: +1 for a successful Copy, +2 for a
 * successful Clone (master prompt: "One clone action creates 2 additional
 * copies. So 1 becomes 3").
 */
export function grantFruitBonus(
    auctionId: string,
    fruitId: AbilityFruitId,
    amount = 1
): FruitBonuses {
    const next: FruitBonuses = { ...getFruitBonuses(auctionId) }
    next[fruitId] = (next[fruitId] ?? 0) + amount
    if (typeof window !== 'undefined' && auctionId) {
        try {
            window.sessionStorage.setItem(bonusKey(auctionId), JSON.stringify(next))
        } catch {
            // storage full / blocked — the ledger is a convenience, never a blocker
        }
    }
    return next
}

/** Uses a player genuinely holds on a fruit this auction: base 10 − spent + copied/cloned bonuses. */
export function availableUses(
    auctionId: string,
    usage: FruitUsage,
    bonuses: FruitBonuses,
    fruitId: AbilityFruitId
): number {
    return Math.max(0, TESTING_PHASE_FRUIT_COUNT - (usage[fruitId] ?? 0) + (bonuses[fruitId] ?? 0))
}
