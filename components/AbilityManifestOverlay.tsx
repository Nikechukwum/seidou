'use client'

// Ability fruit INTERACTION — the MANIFEST overlay.
// ----------------------------------------------------------------------------
// Progressive manifestation, per the CEO's proposal: the moment anyone casts
// an interactive fruit (Divide / Swap / Steal / Freeze) the fruit visibly
// leaves THEIR card and crosses the table toward every target card. For the
// first MANIFEST_MS of the 5s reaction window it flies; for the rest of the
// window a small parked badge stays on each target card (the "landed fruit")
// while the TargetTelegraphOverlay adds the spidey-sense rings + countdown.
//
// Positions are read live from the cards the page already renders
// ([data-divide-card]) so the overlay tracks the real table, and the overlay
// itself is pointer-events-none — it never intercepts taps.
// ============================================================================

import { motion } from 'motion/react'
import { useMemo } from 'react'
import {
    AbilityInteraction,
    effectFruitId,
    MANIFEST_MS,
    phaseForInteraction,
} from '@/lib/abilityInteractions'
import { getAbilityFruit } from '@/lib/abilityFruits'
import Image from 'next/image'

type Props = {
    interactions: AbilityInteraction[]
    serverNowMs: number
}

type Rect = { left: number; top: number; width: number; height: number }

function cardRect(userId: string): Rect | null {
    const el = document.querySelector<HTMLElement>(`[data-divide-card="${userId}"]`)
    const r = el?.getBoundingClientRect()
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null
}

function cardCenter(r: Rect) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function cardRight(r: Rect) {
    return { x: r.left + r.width - 40, y: r.top + r.height / 2 }
}

/** Flying fruit badge — one per target during the manifesting beat. */
function Flight({
    interaction,
    from,
    to,
}: {
    interaction: AbilityInteraction
    from: { x: number; y: number }
    to: { x: number; y: number }
}) {
    const fruit = getAbilityFruit(effectFruitId(interaction.effect_type)!)
    return (
        <div className="pointer-events-none fixed inset-0 z-[60]">
            {/* comet trail catching up behind the travelling fruit */}
            {[1, 2, 3].map((i) => (
                <motion.span
                    key={`trail-${interaction.id}-${i}`}
                    className="absolute left-0 top-0 rounded-full bg-red-400/70"
                    style={{ width: 12 - i * 3, height: 12 - i * 3 }}
                    initial={{ x: from.x - 8 - i * 18, y: from.y - 8 - i * 18, opacity: 0.85 }}
                    animate={{ x: to.x - 8 - i * 18, y: to.y - 8 - i * 18, opacity: 0 }}
                    transition={{ duration: MANIFEST_MS / 1000, ease: 'easeInOut', delay: (i - 1) * 0.06 }}
                />
            ))}
            <motion.div
                className="absolute left-0 top-0"
                initial={{ x: from.x - 22, y: from.y - 22, rotate: 0, scale: 0.4, opacity: 0 }}
                animate={{ x: to.x - 22, y: to.y - 22, rotate: 540, scale: 1, opacity: [0, 1, 1, 1] }}
                transition={{ duration: MANIFEST_MS / 1000, ease: 'easeInOut', times: [0, 0.15, 0.8, 1] }}
            >
                {fruit && (
                    <Image
                        src={fruit.image}
                        alt=""
                        width={44}
                        height={44}
                        sizes="44px"
                        className="size-11 rounded-full object-contain drop-shadow-md"
                    />
                )}
            </motion.div>
        </div>
    )
}

/** Parked badge on each target card while the reactor window is open. */
function Parked({ interaction, userId }: { interaction: AbilityInteraction; userId: string }) {
    const fruit = getAbilityFruit(effectFruitId(interaction.effect_type)!)
    const rect = cardRect(userId)
    if (!rect) return null
    const p = cardRight(rect)
    return (
        <div
            className="pointer-events-none fixed z-[60] flex items-center justify-center"
            style={{ left: p.x - 20, top: p.y - 20, width: 40, height: 40 }}
        >
            <motion.span
                className="absolute inset-0 rounded-full border-2 border-red-400"
                animate={{ scale: [1, 1.6], opacity: [0.7, 0] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeOut' }}
            />
            {fruit && (
                <Image
                    src={fruit.image}
                    alt=""
                    width={34}
                    height={34}
                    sizes="34px"
                    className="size-[34px] rounded-full object-contain drop-shadow-md"
                />
            )}
        </div>
    )
}

export default function AbilityManifestOverlay({ interactions, serverNowMs }: Props) {
    const flights = useMemo(() => {
        const out: { interaction: AbilityInteraction; from: { x: number; y: number }; to: { x: number; y: number } }[] = []
        if (typeof document === 'undefined') return out
        for (const it of interactions) {
            if (phaseForInteraction(it, serverNowMs) !== 'manifesting') continue
            const from = cardRect(it.actor_user_id)
            if (!from) continue
            for (const tid of it.target_user_ids ?? []) {
                const to = cardRect(tid)
                if (!to) continue
                out.push({ interaction: it, from: cardCenter(from), to: cardCenter(to) })
            }
        }
        return out
    }, [interactions, serverNowMs])

    const parked = useMemo(() => {
        const out: { interaction: AbilityInteraction; userId: string }[] = []
        if (typeof document === 'undefined') return out
        for (const it of interactions) {
            if (phaseForInteraction(it, serverNowMs) !== 'reacting') continue
            for (const tid of it.target_user_ids ?? []) {
                out.push({ interaction: it, userId: tid })
            }
        }
        return out
    }, [interactions, serverNowMs])

    return (
        <>
            {flights.map((f) => (
                <Flight key={`flight-${f.interaction.id}-${f.to.x}-${f.to.y}`} interaction={f.interaction} from={f.from} to={f.to} />
            ))}
            {parked.map((p) => (
                <Parked key={`parked-${p.interaction.id}-${p.userId}`} interaction={p.interaction} userId={p.userId} />
            ))}
        </>
    )
}