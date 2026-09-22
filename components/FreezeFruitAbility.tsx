'use client'

// ============================================================================
// ABILITY FRUIT: FREEZE FRUIT
// ----------------------------------------------------------------------------
// Prevents every OTHER player from changing their bid amount or using a fruit
// for FREEZE_FRUIT_DURATION_S (30s). Only the activator can still bid.
//
//   FRAME 1  BEFORE ACTIVATION  The plain leaderboard.
//   FRAME 2  FREEZE ACTIVATED   The fruit appears on the RIGHT of the
//                               ACTIVATOR'S OWN card.
//   FRAME 3  FREEZE PULSE       A BLUE radial wave leaves the activator's card
//                               and travels over EVERY other card
//                               (FREEZE_PULSE_MS, 600ms). The sheet draws it as
//                               concentric rings crossing the whole table, so it
//                               is a table-wide overlay (FreezePulseOverlay,
//                               rendered by the page), not a per-card badge.
//   FRAME 4  OTHERS FROZEN      Every OTHER player's card wears a blue border
//                               (FREEZE_BORDER_COLOR + glow) — never the
//                               activator — and a small snowflake glyph on its
//                               RIGHT edge. The activator's card shows the fruit
//                               with an hourglass + the live 30 -> 0 countdown
//                               pill BENEATH it.
//   FRAME 5  FROZEN STATE       The countdown runs 30 -> 0. Frozen players are
//                               blocked server-side from bidding and fruits;
//                               the NEGATE fruit is the exception (it pops the
//                               'freeze' stack entry and releases its user).
//   FRAME 6  FREEZE ENDING      The blue borders fade out (~FREEZE_FADE_MS).
//   FRAME 7  BACK TO NORMAL     The table is clear again.
//
// DEV RULES (design video):
//   - The pulse is a RADIAL WAVE from the activator to all other cards, ~600ms;
//     the rings are blue, never red.
//   - Border colour is FREEZE_BORDER_COLOR (#3DA5FF) with a subtle glow.
//   - The activator NEVER gets the blue border.
//   - The timer pill + hourglass hang at the BOTTOM of the fruit.
//   - When the duration ends the borders fade out smoothly (~400ms).
//   - Ease-out curve: cubic-bezier(0.22, 1, 0.36, 1).
//
// The page drives the stage machine + countdown + the blue card borders and
// draws no connector lines; this wrapper only draws ON-CARD frames.
// ============================================================================

import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { getAbilityFruit, FREEZE_BORDER_COLOR, FREEZE_PULSE_MS, FREEZE_FADE_MS } from '@/lib/abilityFruits'

export type FreezeStage = 'idle' | 'pulse' | 'active' | 'fade'

export type FreezePlayer = {
    id: number | string
    name?: string
    bid?: number
    bidAmount?: number
}

// Design-specified blue / ice palette. The border colour is the sheet's
// #3DA5FF, shared with the page so the card borders and these overlays agree.
const ICE_BORDER = FREEZE_BORDER_COLOR
const ICE_DEEP = '#1d4ed8'
// FRAME 3: the radial wave lasts FREEZE_PULSE_MS (600ms), per the sheet.
const PULSE_MS = FREEZE_PULSE_MS
// Design-specified ease-out curve (same as Multiply / Divide / Steal).
const EASE_OUT = [0.22, 1, 0.36, 1] as const

const FREEZE = getAbilityFruit('freeze')!
const FRUIT_SRC = FREEZE.animationImage ?? FREEZE.image

/** FRAME 5 — the hourglass that rides beneath the fruit beside the countdown. */
function HourglassIcon({ size = 14 }: { size?: number }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <path d="M5 22h14" />
            <path d="M5 2h14" />
            <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
            <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
        </svg>
    )
}

/** FRAME 4 — the small snowflake on every frozen player's card. */
function SnowflakeIcon({ size = 12 }: { size?: number }) {
    return (
        <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
        >
            <line x1="12" y1="2" x2="12" y2="22" />
            <line x1="4" y1="6" x2="20" y2="18" />
            <line x1="20" y1="6" x2="4" y2="18" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="6" y1="4" x2="4" y2="6" />
            <line x1="20" y1="20" x2="18" y2="22" />
            <line x1="6" y1="20" x2="4" y2="18" />
            <line x1="20" y1="4" x2="18" y2="6" />
        </svg>
    )
}

/** FRAMES 2 + 5 — the fruit with the hourglass countdown pill beneath it. */
function FruitWithTimer({ size, secondsLeft }: { size: number; secondsLeft: number }) {
    return (
        <div className="relative" style={{ width: size, height: size + 28 }}>
            <Image
                src={FRUIT_SRC}
                alt="Freeze Fruit"
                width={size}
                height={size}
                sizes={`${size}px`}
                className="h-full w-full object-contain drop-shadow-lg"
            />
            {/* the timer + hourglass hang at the BOTTOM of the fruit */}
            <span
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-1 rounded-full px-2 py-0.5 font-extrabold text-white shadow-md tabular-nums"
                style={{ top: size + 2, fontSize: 12, backgroundColor: ICE_DEEP, color: '#eff6ff' }}
            >
                <HourglassIcon size={12} />
                {secondsLeft}s
            </span>
        </div>
    )
}

interface FreezeFruitAbilityProps {
    /** Full leaderboard table data. */
    tableData: FreezePlayer[]
    /** The activator's own player id — the fruit + timer sit on this card. */
    activatorId: string | null
    /** Ids of every other player being frozen (the blue borders + badge). */
    targetIds: string[]
    /** Which frame of the freeze sequence is live (page-driven). */
    stage: FreezeStage
    /** Current countdown value (30 -> 0). */
    secondsLeft: number
    /** This card's own player id. */
    playerId: number | string
    /** The player card content these effects overlay. */
    children?: ReactNode
}

export default function FreezeFruitAbility({
    tableData,
    activatorId,
    targetIds,
    stage,
    secondsLeft,
    playerId,
    children,
}: FreezeFruitAbilityProps) {
    const isActivator = activatorId === playerId
    const isTarget = targetIds.includes(String(playerId))

    return (
        <motion.div className="relative">
            {/* FRAME 1: the plain player card */}
            {children}

            {/* FRAME 4 frost tint — an ice-blue veil on every frozen card while
                the freeze holds. FRAME 6: it thins out over FREEZE_FADE_MS
                together with the border, so the table clears in one movement. */}
            <AnimatePresence>
                {isTarget && (stage === 'pulse' || stage === 'active' || stage === 'fade') && (
                    <motion.div
                        className="pointer-events-none absolute inset-0 z-10 rounded-3xl"
                        style={{
                            background:
                                'linear-gradient(180deg, rgba(61,165,255,0.10) 0%, rgba(29,78,216,0.06) 100%)',
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: stage === 'fade' ? 0 : 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: (stage === 'fade' ? FREEZE_FADE_MS : 300) / 1000, ease: EASE_OUT }}
                    />
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 2 + 3 — FREEZE ACTIVATED / PULSE (activator)
                The fruit appears on the right of the activator's own card and
                a BLUE pulse ripples out of it (~400ms).
               ================================================================ */}
            <AnimatePresence>
                {(isActivator && (stage === 'pulse' || stage === 'active')) && (
                    <motion.div
                        className="pointer-events-none absolute -top-3 right-1 z-30"
                        initial={{ opacity: 0, scale: 0.4, x: 40, y: -20 }}
                        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35, ease: EASE_OUT }}
                    >
                        <FruitWithTimer size={56} secondsLeft={secondsLeft} />

                        {/* FRAME 3: the wave itself is TABLE-WIDE, so it is
                            drawn once by <FreezePulseOverlay /> at page level
                            rather than per card. All that belongs here is the
                            small flash that leaves the fruit as it fires. */}
                        {stage === 'pulse' && (
                            <motion.span
                                className="absolute -top-3 -right-3 -z-10 rounded-full"
                                style={{ background: 'radial-gradient(circle, rgba(219,234,254,0.95) 0%, rgba(61,165,255,0) 70%)' }}
                                initial={{ opacity: 0, width: 56, height: 56 }}
                                animate={{ opacity: [0, 1, 0], width: [56, 132], height: [56, 132] }}
                                transition={{ duration: PULSE_MS / 1000, ease: 'easeOut' }}
                            />
                        )}

                        {/* FRAME 5: while the freeze holds, a slow blue halo
                            breathes around the fruit so the timer reads "live". */}
                        {stage === 'active' && (
                            <motion.span
                                className="absolute -top-3 -right-3 -z-10 rounded-full border-2"
                                style={{ borderColor: ICE_BORDER }}
                                initial={{ opacity: 0, width: 56, height: 56 }}
                                animate={{ opacity: [0, 0.8, 0], width: [56, 96], height: [56, 96] }}
                                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 4 + 6 — OTHERS FROZEN / ENDING (targets)
                Every other player's card carries a snowflake "FROZEN" badge
                while the freeze holds; it rides the fade in FRAME 6.
               ================================================================ */}
            <AnimatePresence>
                {isTarget && (stage === 'pulse' || stage === 'active' || stage === 'fade') && (
                    <motion.div
                        className="pointer-events-none absolute right-3 top-1/2 z-30 -translate-y-1/2"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{
                            opacity: stage === 'fade' ? 0 : 1,
                            scale: stage === 'fade' ? 0.9 : 1,
                        }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        // FRAME 6: rides the same smooth fade as the borders.
                        transition={{ duration: (stage === 'fade' ? FREEZE_FADE_MS : 300) / 1000, ease: EASE_OUT }}
                    >
                        {/* The sheet draws a bare snowflake glyph in the card's
                            top-right corner — no word, no filled pill — so the
                            frozen state reads from the border + this mark. */}
                        <span
                            className="flex items-center justify-center"
                            style={{ color: ICE_BORDER, filter: `drop-shadow(0 0 4px ${ICE_BORDER}99)` }}
                            aria-label="Frozen"
                            title="Frozen"
                        >
                            <SnowflakeIcon size={16} />
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}

/** The blue caption bar shown under the table while a freeze is live. */
export function FreezeStatusPill({ stage, secondsLeft }: { stage: FreezeStage; secondsLeft: number }) {
    if (stage === 'idle') return null

    return (
        <div className="flex justify-center">
            <motion.div
                className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm"
                style={{ backgroundColor: ICE_DEEP }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
            >
                <SnowflakeIcon size={14} />
                {stage === 'pulse' && <span>Freeze Fruit activated — freezing the table…</span>}
                {stage === 'active' && <span>Table frozen — {secondsLeft}s left</span>}
                {stage === 'fade' && <span>Freeze wearing off…</span>}
            </motion.div>
        </div>
    )
}
// ============================================================================
// FRAME 3 — FREEZE PULSE (table-wide)
// ----------------------------------------------------------------------------
// The sheet does NOT draw the pulse as a badge on the activator's card: it
// draws concentric rings leaving that card and washing over EVERY other card,
// spanning the whole table, with ice sparks riding the wave.
//
//   "Pulse animation: radial wave from activator to all other cards (~600ms)"
//
// So it is one fixed-position overlay rendered by the page for the length of
// the 'pulse' stage. `origin` is the viewport point the wave starts from — the
// activator's own card, measured by the page — and `reach` is how far it has
// to travel to clear the furthest card.
// ============================================================================

/** Ring count copied from the sheet, where five circles are visible mid-pulse. */
const PULSE_RINGS = 5
/** The ice sparks that ride the wave outward. */
const PULSE_SPARKS = 14

export function FreezePulseOverlay({
    origin,
    reach,
}: {
    origin: { x: number; y: number } | null
    reach: number
}) {
    if (!origin) return null

    const seconds = PULSE_MS / 1000

    return (
        <div className="pointer-events-none fixed inset-0 z-[65] overflow-hidden">
            {/* the cold wash that lifts the whole table for the beat of the pulse */}
            <motion.div
                className="absolute rounded-full"
                style={{
                    left: origin.x,
                    top: origin.y,
                    width: reach * 2,
                    height: reach * 2,
                    marginLeft: -reach,
                    marginTop: -reach,
                    background: `radial-gradient(circle, rgba(61,165,255,0.22) 0%, rgba(61,165,255,0.10) 45%, rgba(61,165,255,0) 72%)`,
                }}
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: [0, 1, 0], scale: [0.2, 1] }}
                transition={{ duration: seconds, ease: 'easeOut' }}
            />

            {/* the concentric rings — each one leaves slightly after the last so
                the wave reads as travelling outward rather than flashing once */}
            {Array.from({ length: PULSE_RINGS }).map((_, i) => (
                <motion.span
                    key={`freeze-ring-${i}`}
                    className="absolute rounded-full border"
                    style={{
                        left: origin.x,
                        top: origin.y,
                        borderColor: ICE_BORDER,
                        borderWidth: i < 2 ? 2 : 1,
                        boxShadow: `0 0 12px ${ICE_BORDER}66, inset 0 0 12px ${ICE_BORDER}44`,
                    }}
                    initial={{ opacity: 0, width: 0, height: 0, marginLeft: 0, marginTop: 0 }}
                    animate={{
                        opacity: [0, 0.85, 0],
                        width: reach * 2,
                        height: reach * 2,
                        marginLeft: -reach,
                        marginTop: -reach,
                    }}
                    transition={{
                        duration: seconds,
                        // the whole wave still finishes inside FREEZE_PULSE_MS:
                        // the last ring leaves at ~40% and is scaled to land with it
                        delay: (i / PULSE_RINGS) * seconds * 0.4,
                        ease: 'easeOut',
                    }}
                />
            ))}

            {/* ice sparks thrown out along the wave */}
            {Array.from({ length: PULSE_SPARKS }).map((_, i) => {
                const angle = (i / PULSE_SPARKS) * Math.PI * 2
                const distance = reach * (0.55 + ((i % 4) * 0.12))
                return (
                    <motion.span
                        key={`freeze-spark-${i}`}
                        className="absolute rounded-full"
                        style={{
                            left: origin.x,
                            top: origin.y,
                            width: 4,
                            height: 4,
                            backgroundColor: '#eff6ff',
                            boxShadow: `0 0 8px ${ICE_BORDER}`,
                        }}
                        initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                        animate={{
                            opacity: [0, 1, 0],
                            x: Math.cos(angle) * distance,
                            y: Math.sin(angle) * distance,
                            scale: [0.6, 1, 0.4],
                        }}
                        transition={{ duration: seconds, delay: (i % 5) * 0.03, ease: 'easeOut' }}
                    />
                )
            })}
        </div>
    )
}
