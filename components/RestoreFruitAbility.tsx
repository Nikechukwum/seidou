'use client'

// ============================================================================
// ABILITY FRUIT: RESTORE
// ----------------------------------------------------------------------------
// "You get back what you used." Restore rewinds the activator's OWN recent
// actions in this auction: every ability fruit they spent returns to their
// inventory, and the bidding currency they committed is paid back into their
// wallet. Nobody else on the table is touched.
//
// The six frames below follow the design sheet 1:1, in the fruit's own teal:
//
//   FRAME 1  BEFORE RESTORE     The plain player card. Fruits have been used
//                               and bidding currency spent, so the balance is
//                               lower than it started.
//   FRAME 2  FRUIT ACTIVATED    The fruit appears SMALL on the RIGHT side of
//                               the activator's card, inside a teal pulse ring.
//   FRAME 3  FRUIT EXPLODES     The fruit bursts on that same card: teal flash,
//                               rays, shockwave and shards, and the card itself
//                               shakes (the shake is driven by the page).
//   FRAME 4  RESTORING...       A dashed ring spins over the card while the
//                               resources are actually being restored in the
//                               background — this frame is held for as long as
//                               the server round-trip takes.
//   FRAME 5  RESTORE SUMMARY    A modal lists exactly what came back: each
//                               ability fruit with its count, then the bidding
//                               currency total. Dismissed by "Continue", never
//                               on a timer — the player reads it.
//   FRAME 6  RESTORE COMPLETE   The card carries a green "restored" marker and
//                               the wallet in the header is back up.
//
// DEV RULES (from the sheet):
//   - Only RECENTLY USED ability fruits come back (this auction's ledger).
//   - Only the bidding currency the player SPENT comes back — never a top-up
//     of their current wallet balance.
//   - It does NOT affect other players: no other bid on the table changes.
//   - It cannot be used when there is nothing to restore.
//
// The page owns the stage machine, the server commit and the card shake; this
// file draws the on-card frames, the caption pill and the summary modal.
// ============================================================================

import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import Image from 'next/image'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { getAbilityFruit } from '@/lib/abilityFruits'

export type RestorePlayer = {
    id: number | string
    name?: string
    bid?: number
    bidAmount?: number
}

export type RestoreStage = 'idle' | 'appear' | 'explode' | 'restoring' | 'summary' | 'complete'

/** One row of the FRAME 5 summary: a fruit that was used and has come back. */
export type RestoredFruit = {
    id: string
    name: string
    image: string
    count: number
}

const RESTORE = getAbilityFruit('restore')!
const FRUIT_SRC = RESTORE.animationImage ?? RESTORE.image

// The fruit's own accent — teal everywhere in the sequence.
const TEAL = RESTORE.accent.base        // #14b8a6
const TEAL_SOFT = RESTORE.accent.spark  // #ccfbf1
const TEAL_DEEP = RESTORE.accent.deep   // #134e4a

/** Same ease-out the other fruits' bursts use: cubic-bezier(0.22, 1, 0.36, 1). */
export const RESTORE_EASE_OUT = [0.22, 1, 0.36, 1] as const

/** FRAME 2 — how long the fruit sits on the card before it goes off. */
export const RESTORE_APPEAR_MS = 700
/** FRAME 3 — explosion window, inside the 400-600ms band the sheets use. */
export const RESTORE_BURST_MS = 600
/** FRAME 4 — the shortest time "Restoring..." stays up, even on a fast reply. */
export const RESTORE_RESTORING_MIN_MS = 1100
/** FRAME 6 — how long the green "restored" marker is held after Continue. */
export const RESTORE_COMPLETE_MS = 1500

/**
 * The restore fruit orb, haloed in its teal accent. Leads FRAME 2, rides the
 * explosion in FRAME 3 and heads the summary in FRAME 5.
 */
export function RestoreFruitBadge({ size = 54, className = '' }: { size?: number; className?: string }) {
    return (
        <div className={`relative ${className}`} style={{ width: size, height: size }}>
            {/* teal halo bleeding out from behind the orb */}
            <span
                className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full blur-md"
                style={{
                    width: size * 1.45,
                    height: size * 1.45,
                    background: `radial-gradient(circle, ${TEAL_SOFT} 0%, ${TEAL} 45%, transparent 72%)`,
                    opacity: 0.75,
                }}
            />
            <Image
                src={FRUIT_SRC}
                alt="Restore Fruit"
                width={size}
                height={size}
                sizes={`${size}px`}
                className="h-full w-full object-contain"
                style={{ filter: `drop-shadow(0 0 10px ${TEAL})` }}
            />
        </div>
    )
}

/**
 * The caption bar under the table, mirroring the narration strip printed under
 * each frame of the design sheet. Live from activation through "Restoring...".
 */
export function RestoreStatusPill({ stage }: { stage: RestoreStage }) {
    const live = stage === 'appear' || stage === 'explode' || stage === 'restoring'
    const label =
        stage === 'restoring'
            ? 'Restoring your resources...'
            : stage === 'explode'
                ? 'The Restore Fruit explodes'
                : 'Restore Fruit activated'
    return (
        <AnimatePresence>
            {live && (
                <motion.div
                    className="pointer-events-none flex justify-center"
                    initial={{ opacity: 0, y: 8, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3, ease: RESTORE_EASE_OUT }}
                >
                    <div
                        className="mt-4 flex items-center gap-2 rounded-full px-4 py-2 shadow-lg"
                        style={{ backgroundColor: TEAL_DEEP }}
                    >
                        {stage === 'restoring' && (
                            <motion.span
                                className="size-3.5 rounded-full border-2"
                                style={{ borderColor: TEAL_SOFT, borderTopColor: 'transparent' }}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                            />
                        )}
                        <span className="text-sm font-semibold text-white">{label}</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

/**
 * FRAME 5 — RESTORE SUMMARY. "A summary shows exactly what has been restored."
 * Ability fruits first (with their counts), then the bidding currency total,
 * then Continue. There is no auto-dismiss: the player closes it themselves.
 */
export function RestoreSummaryModal({
    open,
    fruits,
    refundAmount,
    onContinue,
}: {
    open: boolean
    fruits: RestoredFruit[]
    refundAmount: number
    onContinue: () => void
}) {
    return (
        <Modal isActive={open} setIsActive={() => onContinue()}>
            <div className="flex flex-col items-center text-center">
                <RestoreFruitBadge size={72} className="mb-4" />
                <h2 className="text-xl font-extrabold tracking-wide" style={{ color: TEAL_DEEP }}>
                    RESTORED
                </h2>
                <p className="mt-1 mb-6 text-sm text-slate-500">
                    Your resources have been successfully restored.
                </p>

                {fruits.length > 0 && (
                    <div className="w-full text-left">
                        <p className="mb-2 text-[11px] font-bold tracking-wider text-gray-400">
                            ABILITY FRUITS RESTORED
                        </p>
                        <div className="space-y-2">
                            {fruits.map((fruit) => (
                                <div
                                    key={fruit.id}
                                    className="flex items-center gap-3 rounded-2xl px-3 py-2"
                                    style={{ backgroundColor: `${TEAL_SOFT}80` }}
                                >
                                    <Image
                                        src={fruit.image}
                                        alt={fruit.name}
                                        width={28}
                                        height={28}
                                        sizes="28px"
                                        className="size-7 shrink-0 object-contain"
                                    />
                                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-gray-800">
                                        {fruit.name}
                                    </span>
                                    <span className="shrink-0 text-sm font-extrabold" style={{ color: TEAL_DEEP }}>
                                        x{fruit.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {refundAmount > 0 && (
                    <div className="mt-4 w-full text-left">
                        <p className="mb-2 text-[11px] font-bold tracking-wider text-gray-400">
                            BIDDING CURRENCY RESTORED
                        </p>
                        <div
                            className="rounded-2xl px-4 py-3 text-lg font-extrabold"
                            style={{ backgroundColor: `${TEAL_SOFT}80`, color: TEAL_DEEP }}
                        >
                            + {refundAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} BC
                        </div>
                    </div>
                )}

                <Button text="Continue" classname="mt-7 w-full py-3.5" onClick={onContinue} />
            </div>
        </Modal>
    )
}

interface RestoreFruitAbilityProps {
    /** Full leaderboard table data. */
    tableData: RestorePlayer[]
    /** The activator's own player id — the sequence runs on this card. */
    activatorId: string | null
    /** Which frame of the restore sequence is live (page-driven). */
    stage: RestoreStage
    /** This card's own player id. */
    playerId: number | string
    /** The bidding currency being refunded, shown on the FRAME 6 marker. */
    refundAmount: number
    /** The player card content these effects overlay. */
    children?: ReactNode
}

export default function RestoreFruitAbility({
    tableData,
    activatorId,
    stage,
    playerId,
    refundAmount,
    children,
}: RestoreFruitAbilityProps) {
    const isActivator = String(activatorId) === String(playerId)

    return (
        <div className="relative">
            {/* FRAME 1 / after the sequence: the plain player card */}
            {children}

            {/* ================================================================
                FRAME 2 — FRUIT ACTIVATED
                The fruit appears small on the RIGHT of the activator's card,
                inside a teal pulse ring, just before it goes off.
               ================================================================ */}
            <AnimatePresence>
                {isActivator && stage === 'appear' && (
                    <motion.div
                        className="pointer-events-none absolute right-3 top-1/2 z-30 -translate-y-1/2"
                        initial={{ opacity: 0, scale: 0.3, x: 28 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 1.6 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                    >
                        <RestoreFruitBadge size={44} />

                        {/* teal pulse ring while the restore is being set up */}
                        <motion.span
                            className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
                            style={{ borderColor: TEAL }}
                            initial={{ opacity: 0, width: 44, height: 44 }}
                            animate={{ opacity: [0, 0.9, 0], width: [44, 110], height: [44, 110] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 3 — FRUIT EXPLODES
                The burst goes off on the activator's OWN card: flash, rays,
                shockwave and shards. The card shake comes from the page.
               ================================================================ */}
            {isActivator && stage === 'explode' && (
                <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden rounded-3xl">
                    {/* teal flash washing over the card, kept translucent so the
                        name + bid stay readable through the burst */}
                    <motion.div
                        className="absolute inset-0"
                        style={{
                            background: `radial-gradient(circle at 50% 50%, #ffffff 0%, ${TEAL_SOFT} 26%, ${TEAL} 62%, ${TEAL_DEEP} 100%)`,
                        }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.85, 0.4, 0] }}
                        transition={{ duration: RESTORE_BURST_MS / 1000, times: [0, 0.12, 0.55, 1], ease: 'easeOut' }}
                    />

                    {/* radiating light rays */}
                    {Array.from({ length: 16 }).map((_, i) => (
                        <motion.span
                            key={`ray-${i}`}
                            className="absolute left-1/2 top-1/2 origin-left rounded-full bg-white"
                            style={{ height: i % 2 === 0 ? 4 : 2, rotate: `${(i / 16) * 360}deg` }}
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: [0, 190, 230], opacity: [0, 0.9, 0] }}
                            transition={{ duration: 0.45, ease: RESTORE_EASE_OUT, delay: 0.02 * (i % 5) }}
                        />
                    ))}

                    {/* expanding shockwave rings */}
                    {[0, 0.12].map((delay, i) => (
                        <motion.span
                            key={`wave-${i}`}
                            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px]"
                            style={{ borderColor: i === 0 ? TEAL_SOFT : TEAL }}
                            initial={{ width: 20, height: 20, opacity: 0.95 }}
                            animate={{ width: 340, height: 340, opacity: 0 }}
                            transition={{ duration: RESTORE_BURST_MS / 1000, ease: RESTORE_EASE_OUT, delay }}
                        />
                    ))}

                    {/* the orb itself blowing apart at the centre of the card */}
                    <motion.div
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                        initial={{ scale: 0.9, opacity: 1, rotate: 0 }}
                        animate={{ scale: [0.9, 1.35, 0.2], opacity: [1, 1, 0], rotate: 140 }}
                        transition={{ duration: RESTORE_BURST_MS / 1000, ease: 'easeOut' }}
                    >
                        <RestoreFruitBadge size={54} />
                    </motion.div>

                    {/* teal shards thrown out of the blast */}
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
                                    backgroundColor: i % 4 === 0 ? TEAL_DEEP : i % 3 === 0 ? TEAL_SOFT : TEAL,
                                }}
                                initial={{ x: 0, y: 0, opacity: 1, scale: 1, rotate: 0 }}
                                animate={{
                                    x: Math.cos(angle) * dist,
                                    y: Math.sin(angle) * dist + Math.sin(angle) * 14,
                                    opacity: [1, 1, 0],
                                    scale: [1, 1.15, 0.3],
                                    rotate: (i % 2 === 0 ? 1 : -1) * 180,
                                }}
                                transition={{ duration: RESTORE_BURST_MS / 1000, ease: 'easeOut' }}
                            />
                        )
                    })}
                </div>
            )}

            {/* ================================================================
                FRAME 4 — RESTORING...
                "Your resources are being restored in the background." A dashed
                teal ring spins over the card for as long as the commit takes.
               ================================================================ */}
            <AnimatePresence>
                {isActivator && stage === 'restoring' && (
                    <motion.div
                        className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden rounded-3xl"
                        style={{ backgroundColor: `${TEAL_SOFT}70` }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                    >
                        <motion.span
                            className="absolute size-16 rounded-full border-[3px] border-dashed"
                            style={{ borderColor: TEAL }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                        />
                        <motion.span
                            className="absolute size-24 rounded-full border-2 border-dotted"
                            style={{ borderColor: `${TEAL_DEEP}66` }}
                            animate={{ rotate: -360 }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                        />
                        <span
                            className="relative text-[11px] font-extrabold tracking-wide"
                            style={{ color: TEAL_DEEP }}
                        >
                            RESTORING
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ================================================================
                FRAME 6 — RESTORE COMPLETE
                The green marker on the card: the stake is back in the wallet.
                (The header balance has already ticked up by the same amount.)
               ================================================================ */}
            <AnimatePresence>
                {isActivator && stage === 'complete' && (
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
                                {refundAmount > 0
                                    ? `B ${refundAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} restored`
                                    : 'Restored'}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
