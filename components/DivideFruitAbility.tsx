'use client'

// ============================================================================
// ABILITY FRUIT: DIVIDE
// ----------------------------------------------------------------------------
// Divides the player who currently holds FIRST POSITION on the leaderboard.
// The fruit ALWAYS hits #1 — there is nothing to aim.
//
//   FRAME 1  BEFORE BID           Current leaderboard before the ability is
//                                 used. Plain card — no fruit, no border.
//   FRAME 2  DIVIDE ACTIVATED     The fruit appears on the ACTIVATOR'S OWN card
//                                 and travels across the table, coming to rest
//                                 on the RIGHT of the #1 card. That card takes
//                                 a violet ring, and a violet status pill under
//                                 the table reads "Dividing <name>'s bid by N".
//   FRAME 3  DIVIDING ANIMATION   The bid amount SPLITS: the old value strikes
//                                 through and the reduced value drops in under
//                                 it. A small "÷N" chip sits bottom-right.
//   FRAME 4  NEW AMOUNT FEEDBACK  The reduced value stands in red and a
//                                 floating "-X,XXX,XXX ↓" shows what came off.
//   FRAME 5  SETTLED STATE        Overlay clears, the reduced bid stands and
//                                 the table re-sorts if the position changed.
//
// DEV NOTES (from design):
//   - Only the target player's bid is affected.
//   - Division factor is based on the fruit's level: ÷2, ÷3, ÷4.
//   - If the result is not a whole number, round DOWN.
//   - Show a split animation from the fruit to the target player.
//   - Floating number shows the amount reduced (red, with a down arrow).
//   - Ease-out curve: cubic-bezier(0.22, 1, 0.36, 1).
//
// The ability chrome reads VIOLET (the fruit's own colour); red is reserved for
// the amount that is lost — the design never washes the card in red.
//
// The travel FROM the activator's card is the page-level flying fruit overlay
// (see the leaderboard page). This wrapper only draws on-card frames:
//   - the source card during 'appear',
//   - the #1 card during 'covering' and 'explode'.
// ============================================================================

import { ReactNode, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { getAbilityFruit } from '@/lib/abilityFruits'

export type DividePlayer = {
    id: number | string
    name?: string
    bid?: number
    bidAmount?: number
}

export type DivideStage = 'idle' | 'appear' | 'travel' | 'covering' | 'explode' | 'settle'

// Frame durations (ms) — driven by the page timeline
const SPLIT_MS = 400
const IMPACT_MS = 950

// Design-specified ease-out curve (same as Multiply)
const EASE_OUT = [0.22, 1, 0.36, 1] as const

// The ability itself reads violet; red is only ever the amount lost.
const VIOLET = '#7c3aed'

const DIVIDE = getAbilityFruit('divide')!
const FRUIT_SRC = DIVIDE.animationImage ?? DIVIDE.image

/** The fruit plus its "÷N" badge — rides along through every frame. */
export function DivideFruitBadge({ size, factor }: { size: number; factor: number }) {
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <Image
                src={FRUIT_SRC}
                alt="Divide Divide Fruit"
                width={size}
                height={size}
                sizes={`${size}px`}
                className="h-full w-full object-contain drop-shadow-lg"
            />
            <span
                className="absolute -bottom-1 -left-2 flex items-center justify-center rounded-full bg-white font-extrabold text-violet-600 shadow-md"
                style={{ width: size * 0.46, height: size * 0.46, fontSize: size * 0.22 }}
            >
                ÷{factor}
            </span>
        </div>
    )
}

/**
 * FRAME 2 status pill — sits UNDER the table rather than on a card, so the page
 * owns it: "÷N  Dividing <name>'s bid by N". Clears once the reduction lands.
 */
export function DivideStatusPill({
    stage,
    targetName,
    factor,
}: {
    stage: DivideStage
    targetName?: string | null
    factor: number
}) {
    const live = stage === 'appear' || stage === 'travel' || stage === 'covering'
    return (
        <AnimatePresence>
            {live && (
                <motion.div
                    className="pointer-events-none flex justify-center"
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                >
                    <div
                        className="mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg"
                        style={{ backgroundColor: VIOLET }}
                    >
                        <span className="flex size-6 items-center justify-center rounded-full bg-white/20 text-xs font-extrabold">
                            ÷{factor}
                        </span>
                        Dividing {targetName || 'the leader'}&apos;s bid by {factor}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

interface DivideFruitAbilityProps {
    /** Full leaderboard table data (used to read the #1 player's current bid). */
    tableData: DividePlayer[]
    /** The activator's own player id — the fruit appears on THIS card first. */
    sourcePlayerId: number | string | null
    /** Id of the player in FIRST position — always the divide target. */
    targetPlayerId: number | string | null
    /** Which frame of the divide sequence is live (page-driven). */
    stage: DivideStage
    /** This card's own player id. */
    playerId: number | string
    /** Division factor from the fruit's level: ÷2 (default), ÷3, ÷4. */
    factor: number
    /** The player card content this fruit overlays. */
    children?: ReactNode
}

export default function DivideFruitAbility({
    tableData,
    sourcePlayerId,
    targetPlayerId,
    stage,
    playerId,
    factor,
    children,
}: DivideFruitAbilityProps) {
    const isSource = sourcePlayerId === playerId
    const isTarget = targetPlayerId === playerId

    const player = tableData.find((p) => p.id === playerId)
    const current = Number(player?.bidAmount ?? player?.bid ?? 0)

    // The page optimistically updates the bid at the same tick it enters the
    // 'explode' stage, so `current` would already be the REDUCED value by then.
    // Capture the pre-divide amount while the split is running so the
    // "-X,XXX,XXX" feedback shows what was actually taken off.
    const oldBidRef = useRef<number | null>(null)
    useEffect(() => {
        if (isTarget && stage === 'covering' && oldBidRef.current === null) {
            oldBidRef.current = current
        }
        if (stage === 'idle') {
            oldBidRef.current = null
        }
    }, [isTarget, stage, current])

    const oldBid = oldBidRef.current ?? current
    // Round DOWN, and never let a bid fall below 1 (mirrors the RPC).
    const reduced = Math.max(1, Math.floor(oldBid / factor))
    const reducedAmount = oldBid - reduced

    // The fruit rests on the target card from the moment it lands until the
    // reduction is applied — frames 2 and 3 of the design sheet.
    const onTarget = isTarget && (stage === 'covering' || stage === 'explode')

    return (
        <div className="relative">
            {/* FRAME 1 / 5: the plain player card — no border treatment, no fruit */}
            {children}

            {/* ================================================================
                FRAME 2 — DIVIDE ACTIVATED (on the ACTIVATOR's card)
                The fruit pops in on the right side of the activator's own card.
                The page-level flight overlay takes over as it travels away.
               ================================================================ */}
            <AnimatePresence>
                {isSource && stage === 'appear' && (
                    <motion.div
                        className="pointer-events-none absolute -top-3 right-1 z-30"
                        initial={{ opacity: 0, scale: 0.4, x: 40, y: -20 }}
                        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35, ease: EASE_OUT }}
                    >
                        <DivideFruitBadge size={56} factor={factor} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 2 / 3 — the target card takes a violet ring while the fruit
                is on it. The card stays readable the whole way through: the
                design never hides the player behind the effect.
               ================================================================ */}
            <AnimatePresence>
                {onTarget && (
                    <motion.div
                        className="pointer-events-none absolute inset-0 z-20 rounded-3xl"
                        style={{ boxShadow: `0 0 0 2px ${VIOLET}, 0 8px 24px -8px ${VIOLET}` }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                    />
                )}
            </AnimatePresence>

            {/* The fruit at rest on the right of the target card, ÷N riding along */}
            <AnimatePresence>
                {onTarget && (
                    <motion.div
                        className="pointer-events-none absolute right-4 top-1/2 z-30 -translate-y-1/2"
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                    >
                        <DivideFruitBadge size={52} factor={factor} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 3 — DIVIDING ANIMATION / FRAME 4 — NEW AMOUNT FEEDBACK
                The bid amount SPLITS in place: the old figure strikes through
                and lifts away, the reduced figure drops in under it in red. The
                card keeps its rank badge and name — only the number is rewritten.

                Anchored over the card's own amount: p-6 (1.5rem) + the size-10
                rank circle (2.5rem) + gap-4 (1rem) = 5rem in from the left.
               ================================================================ */}
            <AnimatePresence>
                {onTarget && (
                    <motion.div
                        className="pointer-events-none absolute z-30 rounded-xl bg-white pr-3"
                        style={{ left: '5rem', top: '1.35rem' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* the old amount, struck through and lifting out of the way */}
                        <AnimatePresence>
                            {stage === 'covering' && (
                                <motion.div
                                    className="whitespace-nowrap text-xl font-bold leading-tight text-gray-400 line-through"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: SPLIT_MS / 1000, ease: EASE_OUT }}
                                >
                                    B {oldBid.toLocaleString()}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* the reduced amount dropping into place, in red */}
                        <motion.div
                            className="whitespace-nowrap text-xl font-bold leading-tight text-red-600"
                            initial={{ opacity: 0, y: -8, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: SPLIT_MS / 1000, ease: EASE_OUT, delay: 0.1 }}
                        >
                            B {reduced.toLocaleString()}
                        </motion.div>

                        {/* FRAME 4: floating "-X,XXX,XXX ↓" showing the amount reduced */}
                        <AnimatePresence>
                            {stage === 'explode' && (
                                <motion.div
                                    className="absolute left-0 top-full flex items-center gap-1 whitespace-nowrap text-sm font-extrabold text-red-600"
                                    initial={{ opacity: 0, y: -4, scale: 0.8 }}
                                    animate={{ opacity: [0, 1, 1, 0], y: [-4, 2, 4, 10], scale: [0.8, 1.15, 1, 1] }}
                                    transition={{ duration: IMPACT_MS / 1000, times: [0, 0.18, 0.7, 1], ease: 'easeOut' }}
                                >
                                    -{reducedAmount.toLocaleString()}
                                    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                                        <path d="M12 4a1 1 0 0 1 1 1v9.17l3.1-3.1a1 1 0 1 1 1.41 1.42l-4.8 4.8a1 1 0 0 1-1.42 0l-4.8-4.8a1 1 0 1 1 1.41-1.42l3.1 3.1V5a1 1 0 0 1 1-1Z" />
                                    </svg>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FRAME 3 — the "÷N" chip in the card's bottom-right corner */}
            <AnimatePresence>
                {isTarget && stage === 'covering' && (
                    <motion.span
                        className="pointer-events-none absolute bottom-3 right-3 z-30 rounded-lg px-2 py-1 text-xs font-extrabold text-white"
                        style={{ backgroundColor: VIOLET }}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                    >
                        ÷{factor}
                    </motion.span>
                )}
            </AnimatePresence>

            {/* FRAME 5: settled — nothing rendered here. The reduced bid stands
                on the card and the table re-sorts if the position changed. */}
        </div>
    )
}
