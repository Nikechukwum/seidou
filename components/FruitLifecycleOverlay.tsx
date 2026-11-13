'use client'

// ============================================================================
// FRUIT LIFECYCLE OVERLAY — phases 1 and 2 (introduction + growth) for every
// fruit except Multiply, which draws its own inside MultiplyFruitAbility.
// ----------------------------------------------------------------------------
// Drawn on the ACTIVATOR'S own card, on the right side:
//   intro   pops in as a miniature (FRUIT_MINI_SCALE)
//   growth  grows smoothly to full size over FRUIT_GROWTH_MS
//   hold    stays full size with a soft pulse until the effect lands
// The page owns the timing and the sounds; this only draws.
// ============================================================================

import { motion } from 'motion/react'
import AbilityFruitOrb from '@/components/AbilityFruitOrb'
import { AbilityFruit } from '@/lib/abilityFruits'
import { FRUIT_GROWTH_MS, FRUIT_MINI_SCALE, LifecyclePhase } from '@/lib/fruitLifecycle'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

type Props = {
    fruit: AbilityFruit
    phase: LifecyclePhase
}

export default function FruitLifecycleOverlay({ fruit, phase }: Props) {
    const art = { ...fruit, image: fruit.animationImage ?? fruit.image }
    return (
        // Outer div positions; the inner motion.div owns `transform` (scale),
        // so Tailwind's translate and the animation never overwrite each other.
        <div className="pointer-events-none absolute top-1/2 right-4 z-30 -translate-y-1/2">
            <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={
                    phase === 'intro'
                        ? { opacity: 1, scale: FRUIT_MINI_SCALE }
                        : phase === 'growth'
                            ? { opacity: 1, scale: 1 }
                            : { opacity: 1, scale: [1, 1.06, 1] }
                }
                transition={
                    phase === 'intro'
                        ? { duration: 0.35, ease: EASE_OUT }
                        : phase === 'growth'
                            ? { duration: FRUIT_GROWTH_MS / 1000, ease: 'easeInOut' }
                            : { duration: 1.2, ease: 'easeInOut', repeat: Infinity }
                }
            >
                <AbilityFruitOrb fruit={art} size={56} glow />
            </motion.div>
        </div>
    )
}
