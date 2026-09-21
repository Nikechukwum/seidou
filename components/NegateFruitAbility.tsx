'use client'

// ============================================================================
// ABILITY FRUIT: NEGATE
// ----------------------------------------------------------------------------
// "Cancels any effect another player's ability fruit had on you and restores
// your bid amount to what it was before."
//
// MECHANIC  When activated, the fruit removes the MOST RECENT effect that
//           affected the user and restores their original bid amount.
// EFFECT    Negates the effect and restores the user's previous bid amount
//           before the effect was applied.
//
// The design sheet draws Negate as the back half of a seven-frame story: a
// rival's Divide lands (frames 1-4), then the victim eats a Negate and takes
// their bid back (frames 5-7). Frames 1-4 belong to the other fruit; the three
// that belong to THIS file are:
//
//   FRAME 5  NEGATE ACTIVATED    The fruit appears on the RIGHT of the
//                                activator's own card, ringed in magenta, while
//                                the card still shows the damaged amount.
//   FRAME 6  SLIDES & COVERS     The fruit slides RIGHT -> LEFT across the card
//                                behind a magenta panel — the same covering
//                                move the Multiply fruit makes — and blows up.
//   FRAME 7  NEGATED & RESTORED  The effect is gone and the original bid is
//                                back: the card takes a GREEN ring, a brief
//                                "NEGATED" stamp shows, and an "↑ Restored"
//                                marker sits on the right.
//
// DEV NOTES (from the sheet):
//   - Track an effect history stack per player (type, value before the effect,
//     timestamp)  ->  public.bid_effects, written by every fruit RPC.
//   - Negate removes the LAST effect, restores the stored value and clears
//     that entry  ->  negate_bid().
//   - Use a distinct border colour (GREEN) when the effect is negated and the
//     bid restored.
//   - Show a brief "NEGATED" indicator after restoration (~800ms).
//   - Animate the fruit sliding left to cover the target before exploding.
//   - Prevent activation if no recent effect exists  ->  the page peeks first.
//   - Only the most recent effect is negated; it does NOT prevent future
//     effects; the fruit has a cooldown (15-20s).
//
// SELF ONLY: the sequence always runs on the activator's own card — Negate
// undoes what was done to YOU. The page owns the stage machine, the server
// commit and the card shake; this file draws the on-card frames and the
// caption pill.
// ============================================================================

import { ReactNode, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { getAbilityFruit } from '@/lib/abilityFruits'

export type NegatePlayer = {
    id: number | string
    name?: string
    bid?: number
    bidAmount?: number
}

export type NegateStage = 'idle' | 'appear' | 'covering' | 'explode' | 'restored'

const NEGATE = getAbilityFruit('negate')!
const FRUIT_SRC = NEGATE.animationImage ?? NEGATE.image

// The fruit's own accent — magenta all the way through the sequence...
const PINK = NEGATE.accent.base        // #ec4899
const PINK_SOFT = NEGATE.accent.spark  // #fce7f3
const PINK_DEEP = NEGATE.accent.deep   // #9d174d
// ...except the settled frame, which the sheet calls out in green: "use a
// distinct border colour when the effect is negated/restored".
const GREEN = '#16a34a'

/** Same ease-out curve the other fruits use: cubic-bezier(0.22, 1, 0.36, 1). */
export const NEGATE_EASE_OUT = [0.22, 1, 0.36, 1] as const

/** FRAME 5 — how long the fruit sits on the right of the card. */
export const NEGATE_APPEAR_MS = 700
/** FRAME 6 — the slide left across the card, before the burst. */
export const NEGATE_SLIDE_MS = 450
/** FRAME 6 — the explosion window, inside the 400-600ms band the sheets use. */
export const NEGATE_BURST_MS = 600
/** FRAME 7 — the "NEGATED" stamp, held for the ~800ms the sheet asks for. */
export const NEGATE_RESTORED_MS = 800

/**
 * The fruit with the "negate" mark on it — a crossed-out circle, the icon the
 * sheet puts in the MECHANIC panel. Rides along through frames 5 and 6.
 */
export function NegateFruitBadge({ size = 54, className = '' }: { size?: number; className?: string }) {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            {/* magenta halo bleeding out from behind the fruit */}
            <span
                className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
                style={{
                    width: size * 1.45,
                    height: size * 1.45,
                    background: `radial-gradient(circle, ${PINK_SOFT} 0%, ${PINK} 45%, transparent 72%)`,
                    opacity: 0.8,
                }}
            />
            <Image
                src={FRUIT_SRC}
                alt="Negate Fruit"
                width={size}
                height={size}
                sizes={`${size}px`}
                className="h-full w-full object-contain"
                style={{ filter: `drop-shadow(0 0 10px ${PINK})` }}
            />
            {/* the ✕ mark — "cancels the effect" */}
            <span
                className="absolute -bottom-1 -left-2 flex items-center justify-center rounded-full bg-white font-extrabold shadow-md"
                style={{ width: size * 0.46, height: size * 0.46, fontSize: size * 0.26, color: PINK_DEEP }}
            >
                ✕
            </span>
        </div>
    )
}

/**
 * The caption bar under the table, mirroring the narration strip printed under
 * each frame of the design sheet. Names the effect being cancelled, so the
 * player can see WHAT is being undone.
 */
export function NegateStatusPill({ stage, effectLabel }: { stage: NegateStage; effectLabel?: string | null }) {
    const live = stage === 'appear' || stage === 'covering' || stage === 'explode' || stage === 'restored'
    const label =
        stage === 'restored'
            ? 'Effect negated — your bid is restored'
            : stage === 'appear'
                ? 'Negate Fruit activated'
                : `Negating ${effectLabel || 'the last effect'}...`
    return (
        <AnimatePresence>
            {live && (
                <motion.div
                    className="pointer-events-none flex justify-center"
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: NEGATE_EASE_OUT }}
                >
                    <div
                        className="mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg"
                        style={{ backgroundColor: stage === 'restored' ? GREEN : PINK_DEEP }}
                    >
                        <span className="flex size-6 items-center justify-center rounded-full bg-white/20 text-xs font-extrabold">
                            {stage === 'restored' ? '↑' : '✕'}
                        </span>
                        {label}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

interface NegateFruitAbilityProps {
    /** Full leaderboard table data (used to read the bid being restored). */
    tableData: NegatePlayer[]
    /** The activator's own player id — the sequence runs on this card. */
    activatorId: string | null
    /** Which frame of the negate sequence is live (page-driven). */
    stage: NegateStage
    /** This card's own player id. */
    playerId: number | string
    /** What the bid goes back to, from the server's peek. */
    restoredAmount: number
    /** Human name of the effect being cancelled ("Divide", "Position Swap"). */
    effectLabel?: string | null
    /** The player card content these effects overlay. */
    children?: ReactNode
}

export default function NegateFruitAbility({
    tableData,
    activatorId,
    stage,
    playerId,
    restoredAmount,
    effectLabel,
    children,
}: NegateFruitAbilityProps) {
    const isActivator = activatorId !== null && String(activatorId) === String(playerId)

    const player = tableData.find((p) => String(p.id) === String(playerId))
    const current = Number(player?.bidAmount ?? player?.bid ?? 0)

    // The page applies the restore optimistically as it enters 'explode', so by
    // the settled frame `current` is already the RESTORED amount. Capture the
    // damaged value while the fruit is still sitting on the card, so the stamp
    // can show how much came back.
    const damagedRef = useRef<number | null>(null)
    useEffect(() => {
        if (isActivator && stage === 'appear' && damagedRef.current === null) {
            damagedRef.current = current
        }
        if (stage === 'idle') {
            damagedRef.current = null
        }
    }, [isActivator, stage, current])

    const damaged = damagedRef.current ?? current
    const restored = restoredAmount > 0 ? restoredAmount : current
    const recovered = Math.max(0, restored - damaged)

    return (
        <div className="relative">
            {/* FRAME 1 / after the sequence: the plain player card */}
            {children}

            {/* ================================================================
                FRAME 5 — NEGATE ACTIVATED
                The fruit appears on the RIGHT of the activator's own card,
                inside a magenta pulse ring, while the damaged amount is still
                standing. Nothing has been undone yet.
               ================================================================ */}
            <AnimatePresence>
                {isActivator && stage === 'appear' && (
                    <>
                        {/* magenta ring around the card that is about to be fixed */}
                        <motion.div
                            className="pointer-events-none absolute inset-0 z-20 rounded-3xl"
                            style={{ boxShadow: `0 0 0 2px ${PINK}, 0 8px 24px -8px ${PINK}` }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25, ease: NEGATE_EASE_OUT }}
                        />

                        <motion.div
                            className="pointer-events-none absolute right-3 top-1/2 z-30 -translate-y-1/2"
                            initial={{ opacity: 0, scale: 0.3, x: 28 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                        >
                            <NegateFruitBadge size={46} />

                            {/* pulse ring while the fruit is being eaten */}
                            <motion.span
                                className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                                style={{ borderColor: PINK }}
                                initial={{ opacity: 0, width: 46, height: 46 }}
                                animate={{ opacity: [0, 0.9, 0], width: [46, 112], height: [46, 112] }}
                                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                            />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 6a — THE FRUIT SLIDES LEFT AND COVERS THE CARD
                "The fruit slides left & covers Madara" — the same covering move
                the Multiply fruit makes, in magenta, with a speed trail behind.
               ================================================================ */}
            <AnimatePresence>
                {isActivator && stage === 'covering' && (
                    <motion.div
                        className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-3xl"
                        style={{
                            background:
                                'linear-gradient(110deg, #9d174d 0%, #be185d 45%, #ec4899 75%, #f9a8d4 100%)',
                        }}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: NEGATE_SLIDE_MS / 1000, ease: NEGATE_EASE_OUT }}
                    >
                        {/* speed trail streaming out behind the fruit */}
                        {[0, 1, 2, 3, 4].map((i) => (
                            <motion.span
                                key={i}
                                className="absolute rounded-full bg-white"
                                style={{ left: 64, top: `${22 + i * 14}%`, height: i % 2 === 0 ? 3 : 2 }}
                                initial={{ width: 0, x: 0, opacity: 0 }}
                                animate={{ width: [0, 150 - i * 20, 0], x: [0, 30, 90], opacity: [0, 0.75, 0] }}
                                transition={{ duration: NEGATE_SLIDE_MS / 1000, ease: NEGATE_EASE_OUT, delay: i * 0.025 }}
                            />
                        ))}

                        {/* the fruit leads the slide, ✕ mark riding along */}
                        <motion.div
                            className="absolute top-1/2 -translate-y-1/2"
                            initial={{ left: '78%', rotate: 140 }}
                            animate={{ left: '6%', rotate: 0 }}
                            transition={{ duration: NEGATE_SLIDE_MS / 1000, ease: NEGATE_EASE_OUT }}
                        >
                            <NegateFruitBadge size={54} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 6b — IT BLOWS UP
                The burst goes off on the activator's own card: magenta flash,
                rays, shockwaves and shards. The card shake comes from the page.
                The restore is committed under this frame, so the number that
                comes out the other side is already the original one.
               ================================================================ */}
            {isActivator && stage === 'explode' && (
                <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden rounded-3xl">
                    {/* magenta flash washing over the card */}
                    <motion.div
                        className="absolute inset-0"
                        style={{
                            background: `radial-gradient(circle at 50% 50%, #ffffff 0%, ${PINK_SOFT} 26%, ${PINK} 62%, ${PINK_DEEP} 100%)`,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.9, 0.4, 0] }}
                        transition={{ duration: NEGATE_BURST_MS / 1000, times: [0, 0.12, 0.55, 1], ease: 'easeOut' }}
                    />

                    {/* radiating light rays */}
                    {Array.from({ length: 16 }).map((_, i) => (
                        <motion.span
                            key={`ray-${i}`}
                            className="absolute left-1/2 top-1/2 origin-left rounded-full bg-white"
                            style={{ height: i % 2 === 0 ? 4 : 2, rotate: `${(i / 16) * 360}deg` }}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: [0, 190, 230], opacity: [0, 0.9, 0] }}
                            transition={{ duration: 0.45, ease: NEGATE_EASE_OUT, delay: 0.02 * (i % 5) }}
                        />
                    ))}

                    {/* expanding shockwave rings */}
                    {[0, 0.12].map((delay, i) => (
                        <motion.span
                            key={`wave-${i}`}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px]"
                            style={{ borderColor: i === 0 ? PINK_SOFT : PINK }}
                            initial={{ width: 20, height: 20, opacity: 0.95 }}
                            animate={{ width: 340, height: 340, opacity: 0 }}
                            transition={{ duration: NEGATE_BURST_MS / 1000, ease: NEGATE_EASE_OUT, delay }}
                        />
                    ))}

                    {/* the fruit itself blowing apart at the centre of the card */}
                    <motion.div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        initial={{ scale: 0.9, opacity: 1, rotate: 0 }}
                        animate={{ scale: [0.9, 1.35, 0.2], opacity: [1, 1, 0], rotate: -140 }}
                        transition={{ duration: NEGATE_BURST_MS / 1000, ease: 'easeOut' }}
                    >
                        <NegateFruitBadge size={54} />
                    </motion.div>

                    {/* magenta shards thrown out of the blast */}
                    {Array.from({ length: 20 }).map((_, i) => {
                        const angle = (i / 20) * Math.PI * 2 + i * 0.4
                        const dist = 50 + (i % 5) * 30
                        const size = i % 3 === 0 ? 6 : 11
                        return (
                            <motion.span
                                key={`shard-${i}`}
                                className="absolute left-1/2 top-1/2"
                                style={{
                                    width: size,
                                    height: size,
                                    borderRadius: i % 2 === 0 ? '40% 60% 55% 45%' : '60% 40% 45% 55%',
                                    backgroundColor: i % 4 === 0 ? PINK_DEEP : i % 3 === 0 ? PINK_SOFT : PINK,
                                }}
                                initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                                animate={{
                                    x: Math.cos(angle) * dist,
                                    y: Math.sin(angle) * dist + Math.sin(angle) * 14,
                                    opacity: [1, 1, 0],
                                    scale: [1, 1.15, 0.3],
                                    rotate: (i % 2 === 0 ? 1 : -1) * 180,
                                }}
                                transition={{ duration: NEGATE_BURST_MS / 1000, ease: 'easeOut' }}
                            />
                        )
                    })}
                </div>
            )}

            {/* ================================================================
                FRAME 7 — EFFECT NEGATED & BID RESTORED
                The GREEN frame the sheet asks for: a green ring on the card, a
                brief "NEGATED" stamp (~800ms) and the "↑ Restored" marker with
                the amount that came back.
               ================================================================ */}
            <AnimatePresence>
                {isActivator && stage === 'restored' && (
                    <>
                        <motion.div
                            className="pointer-events-none absolute inset-0 z-20 rounded-3xl"
                            style={{ boxShadow: `0 0 0 2px ${GREEN}, 0 8px 24px -8px ${GREEN}` }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25, ease: NEGATE_EASE_OUT }}
                        />

                        {/* the "NEGATED" stamp, straight after the restoration */}
                        <motion.div
                            className="pointer-events-none absolute left-1/2 top-2 z-40 -translate-x-1/2"
                            initial={{ opacity: 0, scale: 1.6, rotate: -8 }}
                            animate={{ opacity: [0, 1, 1, 0], scale: [1.6, 0.95, 1, 1], rotate: -8 }}
                            transition={{
                                duration: NEGATE_RESTORED_MS / 1000,
                                times: [0, 0.2, 0.75, 1],
                                ease: 'easeOut',
                            }}
                        >
                            <span
                                className="rounded-md px-2.5 py-1 text-[11px] font-extrabold tracking-[0.2em] text-white shadow-lg"
                                style={{ backgroundColor: PINK_DEEP }}
                            >
                                NEGATED
                            </span>
                        </motion.div>

                        {/* "↑ Restored" — the green marker on the right of the card */}
                        <motion.div
                            className="pointer-events-none absolute right-4 top-1/2 z-30 -translate-y-1/2"
                            initial={{ opacity: 0, y: 8, scale: 0.85 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                        >
                            <div className="flex items-center gap-1 rounded-full bg-green-50 px-3 py-1.5 ring-1 ring-green-200">
                                <span className="text-sm font-extrabold text-green-600">↑</span>
                                <span className="text-xs font-extrabold text-green-700">
                                    {recovered > 0
                                        ? `B ${recovered.toLocaleString(undefined, { maximumFractionDigits: 0 })} restored`
                                        : 'Restored'}
                                </span>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
