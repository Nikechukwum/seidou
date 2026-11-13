'use client'

// ============================================================================
// ABILITY FRUIT: MULTIPLY
// ----------------------------------------------------------------------------
// Multiplies a player's bid amount by the fruit's level factor.
//
// SELF ONLY: the table only ever passes the current user's own id as
// targetPlayerId — a player cannot aim this at anyone else. The API route and
// the RPC enforce the same rule server-side.
//
// LIFECYCLE (CEO, 11 Nov 2026): every activation runs three phases, each with
// its own sound.
//   1. INTRODUCTION  (1s)  A miniature fruit appears on the RIGHT side of the
//                          activator's card.          Sound: ability-intro-v2
//   2. GROWTH        (2s)  The miniature fruit gradually grows to full size.
//                                                     Sound: ability-growth
//   3. MANIFESTATION (1s)  The effect itself — FRAMES 3 to 5 below (slide,
//                          explode, settle), squeezed into one second.
//                                                     Sound: multiply-manifestation
// Phases 1 + 2 replace the old FRAME 2 (fruit dropped on the top-right corner).
//
//   FRAME 1  BEFORE BID           Current leaderboard before the ability is
//                                 used. Plain card — no fruit, NO purple border.
//   FRAME 2  MULTIPLY ACTIVATED   (replaced by the introduction + growth phases)
//   FRAME 3  MULTIPLY ANIMATION   The fruit slides right -> left with a speed
//                                 trail and covers the target's info. The badge
//                                 travels WITH the fruit (design note: "the x2
//                                 should be attached to the fruit, not be at the
//                                 bottom right, on frame 3").
//   FRAME 4  MULTIPLY IMPACT      The fruit explodes with energy — white-hot
//                                 core, light rays and dark purple shards — and
//                                 the effect is applied.
//   FRAME 5  SETTLED STATE        Card back to normal, new bid standing, and the
//                                 amount increased floats up in green. No badge
//                                 (design note: "remove the x2 at the bottom
//                                 right of Madara's card").
//
// DEV NOTES (from design):
//   - Only the target player's bid is affected.
//   - Multiply factor is based on the fruit's level (x2, x3, x4, x5).
//   - If the result exceeds the max bid limit, cap at the limit.
//   - Show a multiply animation from the fruit to the target player.
//   - Floating number shows the amount increased.
//   - Ease-out curve: cubic-bezier(0.22, 1, 0.36, 1).
// ============================================================================

import { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { getAbilityFruit } from '@/lib/abilityFruits'
import { playAbilityGrowthSound, playAbilityIntroSound, playMultiplyManifestSound } from '@/utils/sound'
import { FRUIT_GROWTH_MS, FRUIT_INTRO_MS, FRUIT_MINI_SCALE } from '@/lib/fruitLifecycle'

// Shape of one row in the leaderboard table (supports both exemplar + real data)
export type MultiplyPlayer = {
    id: number | string
    name?: string
    bid?: number
    bidAmount?: number
}

type Phase = 'idle' | 'intro' | 'growth' | 'covering' | 'explode' | 'settled'

// Lifecycle durations (ms) — shared with every fruit (lib/fruitLifecycle.ts)
const INTRO_MS = FRUIT_INTRO_MS
const GROWTH_MS = FRUIT_GROWTH_MS
// MANIFESTATION = SLIDE + IMPACT + SETTLE = 1000ms
const SLIDE_MS = 300
const IMPACT_MS = 550
const SETTLE_MS = 150

// The miniature fruit is the full-size fruit drawn at this scale; the growth
// phase takes it from here up to 1 (full size).
const MINI_SCALE = FRUIT_MINI_SCALE

// Design-specified ease-out curve
const EASE_OUT = [0.22, 1, 0.36, 1] as const

const MULTIPLY = getAbilityFruit('multiply')!
const FRUIT_SRC = MULTIPLY.animationImage ?? MULTIPLY.image

interface MultiplyFruitAbilityProps {
    /** Full leaderboard table data (used to read the target's current bid). */
    tableData: MultiplyPlayer[]
    /** Id of the player being multiplied. When it matches this card, frames run. */
    targetPlayerId: number | string | null
    /** This card's own player id (only the matched row animates). */
    playerId: number | string
    /** Multiply factor from the fruit's level: x2 (default), x3, x4, x5. */
    factor?: number
    /** Hard cap on the resulting bid. */
    maxBidLimit?: number
    /** Optimistic callback fired at FRAME 4 with (playerId, newBid). */
    onBidUpdated?: (id: number | string, newBid: number) => void
    /** FRAME 5: fired once the overlay clears, with the amount increased. */
    onComplete?: (id: number | string, delta: number) => void
    /** The player card content this fruit overlays. */
    children?: ReactNode
}

/** The fruit plus its "xN" badge. The badge is attached to the FRUIT, so it
 *  rides along through frames 2 and 3 and goes up with it at frame 4. */
function FruitWithBadge({ size, factor }: { size: number; factor: number }) {
    return (
        <div className="relative" style={{ width: size, height: size }}>
            <Image
                src={FRUIT_SRC}
                alt="Multiply Multiply Fruit"
                width={size}
                height={size}
                sizes={`${size}px`}
                className="h-full w-full object-contain drop-shadow-lg"
            />
            <span
                className="absolute -bottom-1 -left-2 flex items-center justify-center rounded-full bg-white font-extrabold text-purple-600 shadow-md"
                style={{ width: size * 0.46, height: size * 0.46, fontSize: size * 0.22 }}
            >
                ×{factor}
            </span>
        </div>
    )
}

export default function MultiplyFruitAbility({
    tableData,
    targetPlayerId,
    playerId,
    factor = 2,
    maxBidLimit = 50000000,
    onBidUpdated,
    onComplete,
    children,
}: MultiplyFruitAbilityProps) {
    const isTarget = targetPlayerId === playerId

    const [phase, setPhase] = useState<Phase>('idle')
    const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
    const processedRef = useRef<number | string | null>(null)

    const player = tableData.find((p) => p.id === playerId)

    // The timers below fire up to 4s after the tap. Reading these through refs
    // gives them the LATEST bid and callbacks, not the ones from the tap.
    const playerRef = useRef(player)
    playerRef.current = player
    const onBidUpdatedRef = useRef(onBidUpdated)
    onBidUpdatedRef.current = onBidUpdated
    const onCompleteRef = useRef(onComplete)
    onCompleteRef.current = onComplete

    // ------------------------------------------------------------------------
    // Lifecycle state machine. Starts only when this card becomes the target.
    //   0ms     intro    (miniature fruit appears)        + intro sound
    //   1000ms  growth   (fruit grows to full size)       + growth sound
    //   3000ms  covering (manifestation: slide)           + multiply sound
    //   3300ms  explode  (bid is multiplied HERE)
    //   3850ms  settled
    //   4000ms  idle     (parent floats the green +amount)
    // ------------------------------------------------------------------------
    useEffect(() => {
        // The parent cancelled this activation before it finished (e.g. the
        // player turned out to be frozen): drop the overlay. The cleanup of
        // the previous run has already cleared the pending timers.
        if (!isTarget) {
            if (processedRef.current !== null) {
                processedRef.current = null
                setPhase('idle')
            }
            return
        }
        // Only start once per target activation
        if (processedRef.current === targetPlayerId) return
        processedRef.current = targetPlayerId

        const later = (ms: number, fn: () => void) => {
            timeoutsRef.current.push(setTimeout(fn, ms))
        }

        // PHASE 1 — INTRODUCTION: starts on the very same tap, no waiting.
        setPhase('intro')
        playAbilityIntroSound()

        // PHASE 2 — GROWTH
        later(INTRO_MS, () => {
            setPhase('growth')
            playAbilityGrowthSound()
        })

        // PHASE 3 — MANIFESTATION (FRAME 3: fruit slides right->left and
        // covers the target's info)
        later(INTRO_MS + GROWTH_MS, () => {
            setPhase('covering')
            playMultiplyManifestSound()
        })

        // FRAME 4: impact — the fruit explodes and the effect is applied.
        // Only this player's bid changes. The bid is read NOW (not at the
        // tap), so a bid placed during the 3s build-up is multiplied too.
        later(INTRO_MS + GROWTH_MS + SLIDE_MS, () => {
            const live = playerRef.current
            const current = Number(live?.bidAmount ?? live?.bid ?? 0)
            // DEV NOTE: cap at the max bid limit if the multiplied result exceeds it.
            const capped = Math.min(Math.floor(current * factor), maxBidLimit)
            const delta = capped - current
            setPhase('explode')
            onBidUpdatedRef.current?.(playerId, capped)

            // FRAME 5: settled — overlay comes off, parent floats the amount
            // increased next to the new bid.
            later(IMPACT_MS, () => {
                setPhase('settled')
                later(SETTLE_MS, () => {
                    setPhase('idle')
                    processedRef.current = null
                    onCompleteRef.current?.(playerId, delta)
                })
            })
        })

        return () => {
            timeoutsRef.current.forEach(clearTimeout)
            timeoutsRef.current = []
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isTarget, targetPlayerId])

    return (
        <div className="relative">
            {/* FRAME 1 / 5: the plain player card — no border treatment */}
            {children}

            {/* ================================================================
                PHASES 1 + 2 — INTRODUCTION and GROWTH
                One element across both phases so the growth is a smooth
                continuation: it pops in as a miniature on the RIGHT side of
                the card (intro), then scales up to full size (growth).
                The outer div only positions; the inner motion.div owns the
                transform, so the two never fight over `transform`.
               ================================================================ */}
            <AnimatePresence>
                {(phase === 'intro' || phase === 'growth') && (
                    <motion.div
                        key="mini-fruit"
                        className="pointer-events-none absolute top-1/2 right-4 z-30 -translate-y-1/2"
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: phase === 'intro' ? MINI_SCALE : 1 }}
                            transition={phase === 'intro'
                                ? { duration: 0.35, ease: EASE_OUT }
                                : { duration: GROWTH_MS / 1000, ease: 'easeInOut' }}
                        >
                            <FruitWithBadge size={56} factor={factor} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 3 — MULTIPLY ANIMATION
                A purple panel covers the target's info; the fruit leads in from
                the right with a speed trail streaming out behind it.
               ================================================================ */}
            <AnimatePresence>
                {phase === 'covering' && (
                    <motion.div
                        className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-3xl"
                        style={{
                            background:
                                'linear-gradient(110deg, #7e22ce 0%, #9333ea 45%, #a855f7 75%, #c084fc 100%)',
                        }}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: SLIDE_MS / 1000, ease: EASE_OUT }}
                    >
                        {/* speed trail streaking out behind the fruit */}
                        {[0, 1, 2, 3, 4].map((i) => (
                            <motion.span
                                key={i}
                                className="absolute rounded-full bg-white"
                                style={{ left: 64, top: `${22 + i * 14}%`, height: i % 2 === 0 ? 3 : 2 }}
                                initial={{ width: 0, x: 0, opacity: 0 }}
                                animate={{ width: [0, 150 - i * 20, 0], x: [0, 30, 90], opacity: [0, 0.75, 0] }}
                                transition={{ duration: SLIDE_MS / 1000, ease: EASE_OUT, delay: i * 0.025 }}
                            />
                        ))}

                        {/* the fruit leads the slide, badge riding along */}
                        <motion.div
                            className="absolute top-1/2 -translate-y-1/2"
                            initial={{ left: '78%', rotate: -140 }}
                            animate={{ left: '6%', rotate: 0 }}
                            transition={{ duration: SLIDE_MS / 1000, ease: EASE_OUT }}
                        >
                            <FruitWithBadge size={56} factor={factor} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 4 — MULTIPLY IMPACT
                The fruit explodes with energy: white-hot core, radiating light
                rays and dark purple shards thrown outward.
               ================================================================ */}
            <AnimatePresence>
                {phase === 'explode' && (
                    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden rounded-3xl">
                        {/* lavender wash filling the card */}
                        <motion.div
                            className="absolute inset-0"
                            style={{
                                background:
                                    'radial-gradient(circle at 50% 50%, #ffffff 0%, #f3e8ff 22%, #d8b4fe 48%, #a855f7 78%, #7e22ce 100%)',
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 1, 0] }}
                            transition={{ duration: IMPACT_MS / 1000, times: [0, 0.08, 0.62, 1], ease: 'easeOut' }}
                        />

                        {/* radiating light rays */}
                        {Array.from({ length: 16 }).map((_, i) => (
                            <motion.span
                                key={`ray-${i}`}
                                className="absolute left-1/2 top-1/2 origin-left rounded-full bg-white"
                                style={{ height: i % 2 === 0 ? 4 : 2, rotate: `${(i / 16) * 360}deg` }}
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: [0, 190, 230], opacity: [0, 0.9, 0] }}
                                transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.015 * (i % 5) }}
                            />
                        ))}

                        {/* expanding shockwave ring */}
                        <motion.span
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white"
                            initial={{ width: 20, height: 20, opacity: 0.95 }}
                            animate={{ width: 340, height: 340, opacity: 0 }}
                            transition={{ duration: 0.5, ease: EASE_OUT }}
                        />

                        {/* dark purple shards of the burst fruit */}
                        {Array.from({ length: 20 }).map((_, i) => {
                            const angle = (i / 20) * Math.PI * 2 + i * 0.4
                            const dist = 60 + (i % 5) * 32
                            const size = i % 3 === 0 ? 7 : 12
                            return (
                                <motion.span
                                    key={`shard-${i}`}
                                    className="absolute left-1/2 top-1/2"
                                    style={{
                                        width: size,
                                        height: size,
                                        borderRadius: i % 2 === 0 ? '40% 60% 55% 45%' : '60% 40% 45% 55%',
                                        backgroundColor: i % 4 === 0 ? '#6b21a8' : i % 3 === 0 ? '#7e22ce' : '#9333ea',
                                    }}
                                    initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                                    animate={{
                                        x: Math.cos(angle) * dist,
                                        y: Math.sin(angle) * dist + Math.sin(angle) * 16,
                                        opacity: [1, 1, 0],
                                        scale: [1, 1.15, 0.3],
                                        rotate: (i % 2 === 0 ? 1 : -1) * 180,
                                    }}
                                    transition={{ duration: 0.48, ease: EASE_OUT, delay: 0.02 * (i % 4) }}
                                />
                            )
                        })}

                        {/* white-hot core */}
                        <motion.div
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                            style={{ filter: 'blur(6px)' }}
                            initial={{ width: 14, height: 14, opacity: 1 }}
                            animate={{ width: [14, 130, 90], opacity: [1, 0.9, 0] }}
                            transition={{ duration: 0.45, ease: EASE_OUT }}
                        />
                    </div>
                )}
            </AnimatePresence>

            {/* FRAME 5: settled — nothing rendered here. The parent shows the new
                bid and floats "+X,XXX,XXX ↑" beside it via onComplete. */}
        </div>
    )
}
