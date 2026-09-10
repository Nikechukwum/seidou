'use client'

// ============================================================================
// ABILITY FRUIT: STEAL BIDDING CURRENCY
// ----------------------------------------------------------------------------
// Steals a fixed amount of bidding currency (BC) from EVERY other player on
// the table and gives it to the activator.
//
//   FRAME 1  BEFORE STEAL       Current leaderboard before the ability is used.
//   FRAME 2  FRUIT ACTIVATED    The fruit appears on the RIGHT of the
//                               ACTIVATOR'S OWN card with a live countdown
//                               timer pill beneath it (60 -> 0).
//   FRAME 3  STEAL IN PROGRESS  The fruit locks onto every other player (the
//                               page draws purple connector lines) and each
//                               target card shows a pulsing red "-10,000".
//                               The timer ticks down over 60 seconds.
//   FRAME 4  BC GATHERED        At 0 the fruit SLIDES LEFT over the activator's
//                               card (same slide as Multiply) and explodes with
//                               purple energy.
//   FRAME 5  INCREMENT FEEDBACK The card goes green-ringed and
//                               "+ B X,XXX,XXX" floats up on the activator's
//                               card — all stolen BC lands on it (~800ms).
//   FRAME 6  AFTERMATH          New balances stand, each row carrying its
//                               compact delta: red "v 180K" on every target,
//                               green "^ 370K" on the activator.
//
// DEV RULES (from design):
//   - No target selection UI — targets are automatic (every other bidder).
//   - Steal amount: 10,000 BC per eligible player (fixed, not % based).
//   - Players whose bid is below the steal amount are not touched.
//   - Ease-out curve: cubic-bezier(0.22, 1, 0.36, 1).
//   - Explosion ~400-600ms, with particles AND a card shake.
//   - BC increment feedback shows for ~800ms, then fades out.
//
// The page drives the stage machine + countdown and draws the connector
// lines; this wrapper only draws ON-CARD frames.
// ============================================================================

import { ReactNode, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { getAbilityFruit } from '@/lib/abilityFruits'

export type StealPlayer = {
    id: number | string
    name?: string
    bid?: number
    bidAmount?: number
}

export type StealStage = 'idle' | 'active' | 'explode' | 'settle'

// Design-specified ease-out curve (same as Multiply / Divide)
const EASE_OUT = [0.22, 1, 0.36, 1] as const
const COVER_MS = 420
// Design note: "Explosion duration ~400-600ms with particles/shake."
const BURST_MS = 560
// Design note: "Show BC increment feedback (+ amount) for ~800ms then fade out."
const GAIN_MS = 800

const THIEF = getAbilityFruit('thief')!
const FRUIT_SRC = THIEF.animationImage ?? THIEF.image

/** The little purple "BC" coin that rides beside every steal amount. */
function BcToken({ size = 18 }: { size?: number }) {
    return (
        <span
            className="inline-flex shrink-0 flex-col items-center justify-center rounded-full bg-purple-600 font-extrabold leading-none text-white"
            style={{ width: size, height: size, fontSize: size * 0.42 }}
            aria-hidden
        >
            BC
        </span>
    )
}

/** FRAME 6 shorthand: 180000 -> "180K", 1200000 -> "1.2M". */
function compactBc(value: number) {
    const n = Math.abs(value)
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`
    return n.toLocaleString()
}

/** The fruit with the live countdown timer pill mounted beneath it. */
function FruitWithTimer({ size, secondsLeft }: { size: number; secondsLeft: number }) {
    return (
        <div className="relative" style={{ width: size, height: size + 34 }}>
            <Image
                src={FRUIT_SRC}
                alt="Steal Bidding Currency Fruit"
                width={size}
                height={size}
                sizes={`${size}px`}
                className="h-full w-full object-contain drop-shadow-lg"
            />
            <span
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-0.5 rounded-full bg-purple-700 px-2 py-0.5 font-extrabold text-white shadow-md tabular-nums"
                style={{ top: size - 14, fontSize: 12 }}
            >
                {secondsLeft}s
            </span>
        </div>
    )
}

interface StealFruitAbilityProps {
    /** Full leaderboard table data. */
    tableData: StealPlayer[]
    /** The activator's own player id — the fruit + timer sit on this card. */
    activatorId: string | null
    /** Ids of every other player being stolen from (for the red -X badge). */
    targetIds: string[]
    /** Which frame of the steal sequence is live (page-driven). */
    stage: StealStage
    /** Current countdown value (60 -> 0). */
    secondsLeft: number
    /** This card's own player id. */
    playerId: number | string
    /** Fixed amount stolen from each eligible player. */
    stealAmount: number
    /** Total stolen — the green "+X" floated on the activator card. */
    gain: number
    /** The player card content these effects overlay. */
    children?: ReactNode
}

export default function StealFruitAbility({
    tableData,
    activatorId,
    targetIds,
    stage,
    secondsLeft,
    playerId,
    stealAmount,
    gain,
    children,
}: StealFruitAbilityProps) {
    const isActivator = activatorId === playerId
    const isTarget = targetIds.includes(String(playerId))

    // Activator's explode runs internally: cover-slide, then particle burst.
    const [explodePhase, setExplodePhase] = useState<'idle' | 'cover' | 'burst'>('idle')
    const coveredRef = useRef(false)
    useEffect(() => {
        if (!isActivator || stage !== 'explode') {
            setExplodePhase('idle')
            coveredRef.current = false
            return
        }
        if (coveredRef.current) return
        coveredRef.current = true
        setExplodePhase('cover')
        const t1 = setTimeout(() => setExplodePhase('burst'), COVER_MS)
        return () => clearTimeout(t1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActivator, stage, explodePhase])

    // Settle splits into FRAME 5 (the "+X" increment feedback, ~800ms) and
    // FRAME 6 (the aftermath deltas that stay until the sequence resets).
    const [settlePhase, setSettlePhase] = useState<'idle' | 'gain' | 'after'>('idle')
    useEffect(() => {
        if (stage !== 'settle') {
            setSettlePhase('idle')
            return
        }
        setSettlePhase('gain')
        const t = setTimeout(() => setSettlePhase('after'), GAIN_MS)
        return () => clearTimeout(t)
    }, [stage])

    // Design: the explosion carries "particles/shake" — the whole card jolts.
    const isShaking = isActivator && stage === 'explode' && explodePhase === 'burst'

    return (
        <motion.div
            className="relative"
            animate={
                isShaking
                    ? { x: [0, -7, 6, -5, 4, -2, 0], y: [0, 3, -3, 2, -2, 1, 0] }
                    : { x: 0, y: 0 }
            }
            transition={isShaking ? { duration: BURST_MS / 1000, ease: 'easeOut' } : { duration: 0 }}
        >
            {/* FRAME 1: the plain player card */}
            {children}

            {/* FRAME 5 ring: the activator's card goes green as the BC lands. */}
            <AnimatePresence>
                {isActivator && stage === 'settle' && settlePhase === 'gain' && (
                    <motion.span
                        className="pointer-events-none absolute -inset-px z-20 rounded-3xl border-2 border-green-500"
                        style={{ boxShadow: '0 0 18px rgba(34,197,94,0.35)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                    />
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 2 + 3 — FRUIT ACTIVATED / STEAL IN PROGRESS (activator)
                Fruit on the right with the live 60 -> 0 countdown pill under it.
               ================================================================ */}
            <AnimatePresence>
                {isActivator && (stage === 'active') && (
                    <motion.div
                        className="pointer-events-none absolute -top-3 right-1 z-30"
                        initial={{ opacity: 0, scale: 0.4, x: 40, y: -20 }}
                        animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35, ease: EASE_OUT }}
                    >
                        <FruitWithTimer size={56} secondsLeft={secondsLeft} />

                        {/* faint purple pulse ring while the steal is running */}
                        <motion.span
                            className="absolute -top-3 -right-3 -z-10 rounded-full border-2 border-purple-500"
                            initial={{ opacity: 0, width: 56, height: 56 }}
                            animate={{ opacity: [0, 0.9, 0], width: [56, 120], height: [56, 120] }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 3 + 4 + 5 — STEAL IN PROGRESS (targets)
                Each other player's card shows a pulsing red "-10,000" badge
                with the BC coin, held until the aftermath deltas take over.
               ================================================================ */}
            <AnimatePresence>
                {isTarget && (stage === 'active' || stage === 'explode' || (stage === 'settle' && settlePhase === 'gain')) && (
                    <div className="pointer-events-none absolute -top-3 right-1 z-30 flex flex-col items-end gap-1">
                        <motion.div
                            className="flex items-center gap-1 rounded-full border border-red-200 bg-white px-2.5 py-1 shadow"
                            initial={{ opacity: 0, scale: 0.5, x: 20 }}
                            animate={{ opacity: 1, scale: [1, 1.06, 1], x: 0 }}
                            transition={{
                                opacity: { duration: 0.3, ease: 'easeOut' },
                                scale: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
                            }}
                        >
                            <span className="text-xs font-extrabold text-red-600 tabular-nums">
                                -{stealAmount.toLocaleString()}
                            </span>
                            <BcToken size={16} />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 4 — BC GATHERED (activator)
                The fruit slides left and covers the activator's card (same
                purple slide as Multiply), then bursts into purple energy.
               ================================================================ */}
            <AnimatePresence>
                {isActivator && stage === 'explode' && explodePhase === 'cover' && (
                    <motion.div
                        className="pointer-events-none absolute inset-0 z-40 overflow-hidden rounded-3xl"
                        style={{
                            background:
                                'linear-gradient(110deg, #7e22ce 0%, #9333ea 45%, #a855f7 75%, #c084fc 100%)',
                        }}
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: COVER_MS / 1000, ease: EASE_OUT }}
                    >
                        {/* speed trail streaking out behind the fruit */}
                        {[0, 1, 2, 3, 4].map((i) => (
                            <motion.span
                                key={i}
                                className="absolute rounded-full bg-white"
                                style={{ left: 64, top: `${22 + i * 14}%`, height: i % 2 === 0 ? 3 : 2 }}
                                initial={{ width: 0, x: 0, opacity: 0 }}
                                animate={{ width: [0, 150 - i * 20, 0], x: [0, 30, 90], opacity: [0, 0.75, 0] }}
                                transition={{ duration: COVER_MS / 1000, ease: EASE_OUT, delay: i * 0.025 }}
                            />
                        ))}
                        <motion.div
                            className="absolute top-1/2 -translate-y-1/2"
                            initial={{ left: '78%', rotate: -140 }}
                            animate={{ left: '6%', rotate: 0 }}
                            transition={{ duration: COVER_MS / 1000, ease: EASE_OUT }}
                        >
                            <Image
                                src={FRUIT_SRC}
                                alt=""
                                width={56}
                                height={56}
                                sizes="56px"
                                className="h-14 w-14 object-contain drop-shadow-lg"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 4 (burst) — BC GATHERED
                The pooled BC detonates: purple wash, rays, shockwave and
                shards, ~560ms, while the card itself shakes.
               ================================================================ */}
            <AnimatePresence>
                {isActivator && stage === 'explode' && explodePhase === 'burst' && (
                    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden rounded-3xl flex items-center justify-center">
                        {/* purple wash */}
                        <motion.div
                            className="absolute inset-0"
                            style={{
                                background:
                                    'radial-gradient(circle at 50% 50%, #ffffff 0%, #f3e8ff 22%, #d8b4fe 48%, #a855f7 78%, #7e22ce 100%)',
                            }}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 1, 0] }}
                            transition={{ duration: BURST_MS / 1000, times: [0, 0.08, 0.62, 1], ease: 'easeOut' }}
                        />

                        {/* radiating light rays */}
                        {Array.from({ length: 16 }).map((_, i) => (
                            <motion.span
                                key={`ray-${i}`}
                                className="absolute left-1/2 top-1/2 origin-left rounded-full bg-white"
                                style={{ height: i % 2 === 0 ? 4 : 2, rotate: `${(i / 16) * 360}deg` }}
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: [0, 190, 230], opacity: [0, 0.9, 0] }}
                                transition={{ duration: 0.42, ease: EASE_OUT, delay: 0.015 * (i % 5) }}
                            />
                        ))}

                        {/* expanding shockwave ring */}
                        <motion.span
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white"
                            initial={{ width: 20, height: 20, opacity: 0.95 }}
                            animate={{ width: 340, height: 340, opacity: 0 }}
                            transition={{ duration: BURST_MS / 1000, ease: EASE_OUT }}
                        />

                        {/* dark purple shards */}
                        {Array.from({ length: 18 }).map((_, i) => {
                            const angle = (i / 18) * Math.PI * 2 + i * 0.4
                            const dist = 55 + (i % 5) * 30
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
                                    transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.02 * (i % 4) }}
                                />
                            )
                        })}
                    </div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 5 — INCREMENT FEEDBACK (activator)
                Green "+ B X,XXX,XXX" floats up over the now-visible card and
                fades after ~800ms, exactly as the design's note asks.
               ================================================================ */}
            <AnimatePresence>
                {isActivator && stage === 'settle' && settlePhase === 'gain' && gain > 0 && (
                    <motion.div
                        className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="flex items-center gap-1.5 rounded-2xl px-5 py-2 text-xl md:text-2xl font-extrabold text-green-600 whitespace-nowrap"
                            style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)' }}
                            initial={{ y: 16, opacity: 0, scale: 0.7 }}
                            animate={{ y: -34, opacity: [0, 1, 1, 0], scale: [0.7, 1.2, 1.05, 1] }}
                            transition={{
                                duration: GAIN_MS / 1000,
                                ease: 'easeOut',
                                times: [0, 0.18, 0.72, 1],
                            }}
                        >
                            <span>+ B {gain.toLocaleString()}</span>
                            <BcToken size={20} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 6 — AFTERMATH
                The new balances stand, each row carrying its compact delta:
                red down-arrow on every target, green up-arrow on the activator.
               ================================================================ */}
            <AnimatePresence>
                {stage === 'settle' && settlePhase === 'after' && (isTarget || (isActivator && gain > 0)) && (
                    <motion.div
                        className="pointer-events-none absolute top-1/2 right-4 z-30 -translate-y-1/2"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE_OUT }}
                    >
                        <span
                            className={`flex items-center gap-1 text-sm font-extrabold tabular-nums ${
                                isActivator ? 'text-green-600' : 'text-red-600'
                            }`}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                className={`size-3.5 ${isActivator ? '' : 'rotate-180'}`}
                                fill="currentColor"
                                aria-hidden
                            >
                                <path d="M12 4a1 1 0 0 1 .7.29l6 6a1 1 0 0 1-1.4 1.42L13 7.41V19a1 1 0 1 1-2 0V7.41l-4.3 4.3a1 1 0 1 1-1.4-1.42l6-6A1 1 0 0 1 12 4Z" />
                            </svg>
                            {compactBc(isActivator ? gain : stealAmount)}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}