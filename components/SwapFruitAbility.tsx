'use client'

// ============================================================================
// ABILITY FRUIT: POSITION SWAP
// ----------------------------------------------------------------------------
// Swaps the two bid AMOUNTS between the activator and the current #1 holder:
// the activator takes the leader's bid (jumping straight to first position)
// and the former leader takes what the activator had bid. Usernames and rows
// stay put — only the money moves.
//
// The five frames below follow the design sheet 1:1, with the sheet's purple
// replaced by the Position Swap fruit's own green accent (lib/abilityFruits).
//
//   FRAME 1  BEFORE SWAP        Current leaderboard before the ability runs.
//   FRAME 2  FRUIT ACTIVATED    The activator's card lights up with a green
//                               ring and the fruit appears SMALL on the RIGHT
//                               side of that card, inside a green pulse ring.
//   FRAME 3  FRUIT TRAVEL       The fruit LEAVES the card — the page overlay
//                               flies it to the target, growing as it goes, so
//                               only the green ring stays behind here.
//   FRAME 4  FRUIT EXPLODES     The fruit bursts on the LEADER's card: green
//                               flash, rays, shockwave, particles, and the
//                               card itself shakes. ~550ms.
//   FRAME 5  SETTLED STATE      Both cards show their position change at the
//                               right edge: green "↑ N" on the player who
//                               climbed, red "↓ N" on the one who dropped,
//                               held ~800ms then faded out.
//
// DEV RULES (from design):
//   - No target selection UI — the target is ALWAYS the highest bidder.
//   - A player already (or tied for) first position cannot swap — the page
//     shows a toast, and the RPC rejects it independently.
//   - Travel ease-out curve: cubic-bezier(0.22, 1, 0.36, 1).
//   - Explosion ~400-600ms with particles/shake; position indicators last
//     ~800ms then fade.
//
// The page drives the stage machine, the flight overlay + the green dot trail,
// and the optimistic update; this wrapper draws only the ON-CARD frames.
// ============================================================================

import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { getAbilityFruit } from '@/lib/abilityFruits'

export type SwapPlayer = {
    id: number | string
    name?: string
    bid?: number
    bidAmount?: number
}

export type SwapStage = 'idle' | 'active' | 'travel' | 'explode' | 'settle'

const SWAP = getAbilityFruit('swap')!
const FRUIT_SRC = SWAP.animationImage ?? SWAP.image

// The fruit's own accent — this is the green that replaces the sheet's purple
// everywhere in the sequence, so the animation matches the activation colour.
const GREEN = SWAP.accent.base        // #16a34a
const GREEN_SOFT = SWAP.accent.spark  // #bbf7d0
const GREEN_DEEP = SWAP.accent.deep   // #14532d
const RED = '#dc2626'

// Design-specified travel ease-out curve: cubic-bezier(0.22, 1, 0.36, 1).
export const SWAP_EASE_OUT = [0.22, 1, 0.36, 1] as const
/** Explosion window, inside the design's 400-600ms band. */
export const SWAP_BURST_MS = 550

/**
 * The swap fruit orb, haloed in its green accent. The artwork already carries
 * the golden swap arrows, so nothing extra is stamped on it — same as the sheet.
 */
export function SwapFruitBadge({ size = 54, className = '' }: { size?: number; className?: string }) {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            {/* green halo bleeding out from behind the orb */}
            <span
                className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
                style={{
                    width: size * 1.45,
                    height: size * 1.45,
                    background: `radial-gradient(circle, ${GREEN_SOFT} 0%, ${GREEN} 45%, transparent 72%)`,
                    opacity: 0.75,
                }}
            />
            <Image
                src={FRUIT_SRC}
                alt="Position Swap Fruit"
                width={size}
                height={size}
                sizes={`${size}px`}
                className="h-full w-full object-contain"
                style={{ filter: `drop-shadow(0 0 10px ${GREEN})` }}
            />
        </div>
    )
}

/**
 * The caption bar under the table, mirroring the narration strip printed on
 * each frame of the design sheet. Live while the fruit is out and flying.
 */
export function SwapStatusPill({
    stage,
    targetName,
}: {
    stage: SwapStage
    targetName?: string | null
}) {
    const live = stage === 'active' || stage === 'travel'
    return (
        <AnimatePresence>
            {live && (
                <motion.div
                    className="pointer-events-none flex justify-center"
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: SWAP_EASE_OUT }}
                >
                    <div
                        className="mt-4 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-lg"
                        style={{ backgroundColor: GREEN }}
                    >
                        <span className="flex size-6 items-center justify-center rounded-full bg-white/20 text-xs font-extrabold">
                            ⇄
                        </span>
                        Swapping positions with {targetName || 'the leader'}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

interface SwapFruitAbilityProps {
    /** Full leaderboard table data. */
    tableData: SwapPlayer[]
    /** The activator's own player id — the fruit + glow sit on this card. */
    activatorId: string | null
    /** The leader (highest bidder) the activator is swapping with. */
    targetPlayerId: string | null
    /** Which frame of the swap sequence is live (page-driven). */
    stage: SwapStage
    /** This card's own player id. */
    playerId: number | string
    /** Places GAINED by this card during settle: +1 climbed one, -1 dropped one. */
    positionDelta?: number
    /** The player card content these effects overlay. */
    children?: ReactNode
}

export default function SwapFruitAbility({
    tableData,
    activatorId,
    targetPlayerId,
    stage,
    playerId,
    positionDelta,
    children,
}: SwapFruitAbilityProps) {
    const isActivator = String(activatorId) === String(playerId)
    const isTarget = String(targetPlayerId) === String(playerId)
    const involved = isActivator || isTarget
    const live = stage !== 'idle'

    // FRAMES 2-5: both cards in the trade stay ringed in green for the whole
    // sequence, the way the sheet outlines them from activation through settle.
    const showRing = involved && live

    const delta = positionDelta ?? 0
    const showIndicator = stage === 'settle' && delta !== 0 && involved
    const climbed = delta > 0

    // NOTE: the FRAME 4 card shake lives on the card element itself (see the
    // table in the auction page) so the whole card moves, chrome included —
    // shaking only this overlay would slide the ring off the card's border.
    return (
        <div className="relative">
            {/* FRAME 1 / after settle: the plain player card */}
            {children}

            {/* ================================================================
                FRAMES 2-5 — the green highlight ring around each card taking
                part in the swap.
               ================================================================ */}
            <AnimatePresence>
                {showRing && (
                    <motion.span
                        className="pointer-events-none absolute -inset-px z-20 rounded-3xl border-2"
                        style={{ borderColor: GREEN, boxShadow: `0 0 18px -2px ${GREEN}` }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: SWAP_EASE_OUT }}
                    />
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 2 — FRUIT ACTIVATED (activator)
                The fruit sits small on the RIGHT of the activator's own card,
                inside a green pulse ring, then LEAVES the card for FRAME 3.
               ================================================================ */}
            <AnimatePresence>
                {isActivator && stage === 'active' && (
                    <motion.div
                        className="pointer-events-none absolute right-3 top-1/2 z-30 -translate-y-1/2"
                        initial={{ opacity: 0, scale: 0.3 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.35, ease: SWAP_EASE_OUT }}
                    >
                        <SwapFruitBadge size={44} />

                        {/* green pulse ring while the swap is being set up */}
                        <motion.span
                            className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                            style={{ borderColor: GREEN }}
                            initial={{ opacity: 0, width: 44, height: 44 }}
                            animate={{ opacity: [0, 0.9, 0], width: [44, 110], height: [44, 110] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 4 — FRUIT EXPLODES (target)
                The fruit reaches the leader's card and bursts: green flash,
                rays, shockwave and particles over the still-readable card.
               ================================================================ */}
            <AnimatePresence>
                {isTarget && stage === 'explode' && (
                    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden rounded-3xl">
                        {/* green flash washing over the card, kept translucent so
                            the name + bid stay readable through the burst */}
                        <motion.div
                            className="absolute inset-0"
                            style={{
                                background: `radial-gradient(circle at 50% 50%, #ffffff 0%, ${GREEN_SOFT} 26%, ${GREEN} 62%, ${GREEN_DEEP} 100%)`,
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 0.85, 0.4, 0] }}
                            transition={{ duration: SWAP_BURST_MS / 1000, times: [0, 0.12, 0.55, 1], ease: 'easeOut' }}
                        />

                        {/* radiating light rays */}
                        {Array.from({ length: 16 }).map((_, i) => (
                            <motion.span
                                key={`ray-${i}`}
                                className="absolute left-1/2 top-1/2 origin-left rounded-full bg-white"
                                style={{ height: i % 2 === 0 ? 4 : 2, rotate: `${(i / 16) * 360}deg` }}
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: [0, 190, 230], opacity: [0, 0.9, 0] }}
                                transition={{ duration: 0.45, ease: SWAP_EASE_OUT, delay: 0.02 * (i % 5) }}
                            />
                        ))}

                        {/* expanding shockwave ring */}
                        <motion.span
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px]"
                            style={{ borderColor: GREEN_SOFT }}
                            initial={{ width: 20, height: 20, opacity: 0.95 }}
                            animate={{ width: 340, height: 340, opacity: 0 }}
                            transition={{ duration: SWAP_BURST_MS / 1000, ease: SWAP_EASE_OUT }}
                        />

                        {/* green particles thrown out of the blast */}
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
                                        backgroundColor: i % 4 === 0 ? GREEN_DEEP : i % 3 === 0 ? GREEN_SOFT : GREEN,
                                    }}
                                    initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                                    animate={{
                                        x: Math.cos(angle) * dist,
                                        y: Math.sin(angle) * dist + Math.sin(angle) * 14,
                                        opacity: [1, 1, 0],
                                        scale: [1, 1.15, 0.3],
                                        rotate: (i % 2 === 0 ? 1 : -1) * 180,
                                    }}
                                    transition={{ duration: SWAP_BURST_MS / 1000, ease: SWAP_EASE_OUT, delay: 0.03 * (i % 4) }}
                                />
                            )
                        })}
                    </div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 5 — SETTLED STATE
                Position change at the right edge of the row: green "↑ N" for
                the climber, red "↓ N" for the one who dropped. Held ~800ms,
                then it fades out.
               ================================================================ */}
            <AnimatePresence>
                {showIndicator && (
                    <motion.div
                        className="pointer-events-none absolute right-5 top-1/2 z-30 -translate-y-1/2"
                        initial={{ opacity: 0, y: climbed ? 10 : -10, scale: 0.7 }}
                        animate={{
                            opacity: [0, 1, 1, 0],
                            y: climbed ? [10, 0, 0, -6] : [-10, 0, 0, 6],
                            scale: [0.7, 1, 1, 0.9],
                        }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.8, times: [0, 0.18, 0.72, 1], ease: 'easeOut' }}
                    >
                        <span
                            className="flex items-center gap-1 text-sm font-extrabold tabular-nums"
                            style={{ color: climbed ? GREEN : RED }}
                        >
                            {climbed ? '↑' : '↓'} {Math.abs(delta)}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
