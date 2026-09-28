'use client'

// Ability fruit INTERACTION — the TARGET WARNING (spidey-sense) overlay.
// ----------------------------------------------------------------------------
// While any pending interaction is in its reaction window, every targeted
// card wears a pulsing red ring and a "arriving in Ns" chip — the CEO's
// "target warning (spidey sense)" and the design's "red borders before
// effect" for multi-target steals/freezes. The chip sits just above the card
// so defenders know they have a countdown to react; the ReactFruitPicker
// pops for MY OWN card.
// ============================================================================

import { motion } from 'motion/react'
import { useMemo } from 'react'
import {
    AbilityInteraction,
    effectShortLabel,
    phaseForInteraction,
    windowRemainingSeconds,
} from '@/lib/abilityInteractions'

type Props = {
    interactions: AbilityInteraction[]
    serverNowMs: number
    myUserId: string | null
}

type Rect = { left: number; top: number; width: number; height: number }

function cardRect(userId: string): Rect | null {
    const el = document.querySelector<HTMLElement>(`[data-divide-card="${userId}"]`)
    const r = el?.getBoundingClientRect()
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null
}

export default function TargetTelegraphOverlay({ interactions, serverNowMs, myUserId }: Props) {
    const telegraphed = useMemo(() => {
        const out: {
            interaction: AbilityInteraction
            rect: Rect
            seconds: number
            isMe: boolean
        }[] = []
        if (typeof document === 'undefined') return out
        for (const it of interactions) {
            if (phaseForInteraction(it, serverNowMs) !== 'reacting') continue
            for (const tid of it.target_user_ids ?? []) {
                const rect = cardRect(tid)
                if (!rect) continue
                out.push({
                    interaction: it,
                    rect,
                    seconds: windowRemainingSeconds(it, serverNowMs),
                    isMe: myUserId !== null && tid === myUserId,
                })
            }
        }
        return out
    }, [interactions, serverNowMs, myUserId])

    return (
        <>
            {telegraphed.map((t) => (
                <div
                    key={`telegraph-${t.interaction.id}-${t.rect.left}-${t.rect.top}`}
                    className="pointer-events-none fixed z-[55]"
                    style={{
                        left: t.rect.left - 3,
                        top: t.rect.top - 3,
                        width: t.rect.width + 6,
                        height: t.rect.height + 6,
                    }}
                >
                    {/* pulsing spidey-sense ring */}
                    <motion.span
                        className="absolute -inset-1 rounded-3xl border-2 border-red-400"
                        animate={{ scale: [1, 1.035, 1], opacity: [0.55, 0.9, 0.55] }}
                        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    {/* countdown chip */}
                    <motion.span
                        className={`absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold text-white shadow ${
                            t.isMe ? 'bg-red-500' : 'bg-black/80'
                        }`}
                    >
                        {effectShortLabel(t.interaction.effect_type)} arriving · {t.seconds}s
                    </motion.span>
                </div>
            ))}
        </>
    )
}