// ============================================================================
// ABILITY FRUIT LIFECYCLE — shared timings.
// ----------------------------------------------------------------------------
// Every fruit activation runs three phases (CEO, 11 Nov 2026):
//   1. INTRODUCTION  a miniature fruit appears on the right of the activator's
//                    card                               (sound: ability-intro-v2)
//   2. GROWTH        the miniature grows to full size  (sound: ability-growth-2s)
//   3. MANIFESTATION the fruit's own effect animation   (sound: per fruit)
// Change a duration here and every fruit follows.
// ============================================================================

import type { AbilityFruitId } from '@/lib/abilityFruits'

export const FRUIT_INTRO_MS = 1000
export const FRUIT_GROWTH_MS = 2000

/** The miniature is the full-size fruit drawn at this scale. */
export const FRUIT_MINI_SCALE = 0.35

/** Where the lifecycle overlay is in its run. 'hold' = fully grown, waiting
 *  for the server to land the effect (interactive fruits only). */
export type LifecyclePhase = 'intro' | 'growth' | 'hold'

/** The fruits that go through the server's reaction window, keyed to the
 *  effect_type the interaction feed uses. */
export const INTERACTIVE_LIFECYCLE_EFFECTS: Partial<Record<AbilityFruitId, string>> = {
    divide: 'divide',
    swap: 'swap',
    thief: 'thief',
    freeze: 'freeze',
}
