'use client'

// ============================================================================
// CLONE FRUIT MODAL — the "CLONE AN ABILITY" carousel.
// ----------------------------------------------------------------------------
// Design sheets (video + master prompt), six flows:
//   1. Tap to Activate  — on the Ability Fruits page, handled by the caller.
//   2. Carousel modal    — "CLONE AN ABILITY": a swipeable carousel of EVERY
//                         fruit the player currently possesses (their testing
//                         allocation minus what they have spent, plus any
//                         copied/cloned bonus). Left/right arrows, white on a
//                         dark circle. Primary button CLONE · Create 2 Copies
//                         (black — see the button-style note below).
//   3. Swipe to a fruit  — the carousel is the picker; whatever fruit is
//                         facing the player is the one that will be cloned.
//   4. Tap Clone         — "CONFIRM CLONE" step: fruit + a "Current x1 →
//                         After Cloning x3" counter, Cancel (grey) and Clone
//                         (black).
//   5. Success           — "Clone Successful!" icon (3 fruits stacked with
//                         green checkmarks) + "You now have N <fruit> fruits."
//                         + a black OK button.
//   6. Cloned & ready    — back on the page, the cloned fruit's uses carry
//                         +2 (granted by the caller's onCloned).
//
// BUTTON STYLE (dev override): the master prompt drew the primary buttons in
// blue #2D7FF9; the client asked for BLACK buttons in their place, matching
// the app's black pill buttons elsewhere — this includes the "After Cloning"
// x-counter pill.
//
// RULES (master prompt):
//   • Clone creates exactly 2 extra copies: formula After = Current + 2.
//   • Any fruit you own can be cloned EXCEPT the Clone fruit itself
//     (prevent infinite loop) — CLONABLE_FRUIT_IDS excludes it client-side,
//     and the server's clone_ability rejects it too.
//   • The Clone fruit used is consumed — the caller's onCloned consumes it.
//   • Zero possession shows the empty state: "You have no fruits to clone".
//   • Closing before the Clone commit (Cancel / overlay) consumes NOTHING.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import AbilityFruitOrb from '@/components/AbilityFruitOrb'
import { AbilityFruit, CLONABLE_FRUIT_IDS, getAbilityFruit } from '@/lib/abilityFruits'
import { availableUses, getFruitBonuses, getFruitUsage } from '@/lib/fruitUsage'

type CloneStage = 'carousel' | 'confirm' | 'success'

/** The fruit + count frozen the moment the player taps CLONE — used by the
 *  confirm screen and the success text, and stable even after the caller's
 *  onCloned mutates the storage ledger mid-flow. */
type PendingClone = {
    fruit: AbilityFruit
    count: number
}

type Props = {
    isActive: boolean
    onClose: () => void
    auctionId: string
    /** Called once when the clone COMMITS. Fruit is consumed by the caller. */
    onCloned: (fruitId: string) => void
}

/** Left/right carousel arrow — white on a dark circle. */
const Arrow = ({ direction, onClick, disabled }: { direction: 'left' | 'right'; onClick: () => void; disabled?: boolean }) => (
    <button
        type="button"
        aria-label={direction === 'left' ? 'Previous fruit' : 'Next fruit'}
        onClick={onClick}
        disabled={disabled}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 disabled:opacity-30"
    >
        <svg viewBox="0 0 24 24" className="size-5" fill="none">
            {direction === 'left' ? (
                <path d="M14.5 5 8 12l6.5 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
                <path d="m9.5 5 6.5 7-6.5 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            )}
        </svg>
    </button>
)

/** Green check badge used on the success icon's stacked fruit. */
const GreenCheck = ({ className = '' }: { className?: string }) => (
    <span
        className={`flex size-6 items-center justify-center rounded-full border-2 border-white bg-[#22c55e] ${className}`}
    >
        <svg viewBox="0 0 12 12" className="size-3.5 text-white" fill="none">
            <path
                d="M2 6.4 4.8 9 10 3.2"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    </span>
)

const CloneFruitModal = ({ isActive, onClose, auctionId, onCloned }: Props) => {
    const [stage, setStage] = useState<CloneStage>('carousel')
    const [index, setIndex] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [pending, setPending] = useState<PendingClone | null>(null)

    // Live possession: testing-base 10 minus spent, plus copied/cloned bonuses.
    // The carousel re-reads the ledger on every render, so it stays honest
    // across the whole open.
    const usage = getFruitUsage(auctionId)
    const bonuses = getFruitBonuses(auctionId)

    // Every fruit the player genuinely owns RIGHT NOW, except the Clone fruit
    // itself. If a fruit's uses hit zero in this auction it leaves the
    // carousel, exactly like the roster does.
    const fruits = useMemo(() => {
        return CLONABLE_FRUIT_IDS.map((id) => getAbilityFruit(id)).filter(
            (f): f is AbilityFruit => !!f && availableUses(auctionId, usage, bonuses, f.id) > 0
        )
    }, [auctionId, usage, bonuses])

    // Each time the modal opens, restart at the first fruit and clear errors.
    // This is a pure client flow — nothing to fetch.
    useEffect(() => {
        if (!isActive) return
        setStage('carousel')
        setIndex(0)
        setError(null)
        setBusy(false)
        setPending(null)
    }, [isActive])

    const clampedIndex = fruits.length === 0 ? 0 : Math.min(index, fruits.length - 1)
    const current = fruits[clampedIndex]
    const currentCount = current ? availableUses(auctionId, usage, bonuses, current.id) : 0

    // Snapshot when the CLONE button is tapped (carousel → confirm): the
    // confirm counter and success text must match the state at pick time, not
    // whatever the storage ledger holds AFTER the commit lands.
    const confirm = pending ?? (current ? { fruit: current, count: currentCount } : null)
    const confirmAfter = confirm ? confirm.count + 2 : 0

    const handleClone = async () => {
        if (!confirm || busy) return
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/landwars/clone-fruit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auctionId, targetFruitId: confirm.fruit.id }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data?.error ?? 'Could not clone that fruit.')
                setBusy(false)
                return
            }
            onCloned(confirm.fruit.id)
            setStage('success')
        } catch {
            setError('Could not clone that fruit. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal isActive={isActive} setIsActive={() => onClose()}>
            {/* 2–3. CAROUSEL — pick a fruit to clone */}
            {stage === 'carousel' && (
                <div>
                    <h2 className="mb-1 text-center text-xl font-bold text-gray-900">CLONE AN ABILITY</h2>
                    <p className="mb-5 text-center text-sm text-slate-500">
                        Choose a fruit from your possession to create 2 additional copies.
                    </p>

                    {fruits.length === 0 ? (
                        <div className="mb-6 rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                            <p className="font-semibold text-slate-600">You have no fruits to clone</p>
                            <p className="mt-1 text-xs">Use any ability fruit on this table first, then come back.</p>
                        </div>
                    ) : (
                        <div className="mb-6 flex items-center gap-3">
                            <Arrow
                                direction="left"
                                disabled={fruits.length <= 1}
                                onClick={() => setIndex((clampedIndex - 1 + fruits.length) % fruits.length)}
                            />
                            <div className="min-w-0 flex-1 overflow-hidden">
                                <motion.div
                                    key={current?.id ?? 'none'}
                                    initial={{ opacity: 0, x: 24 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="flex flex-col items-center rounded-3xl border border-gray-100 bg-white py-6 text-center shadow-sm"
                                >
                                    <AbilityFruitOrb fruit={current!} size={84} glow className="mb-3" />
                                    <span className="block px-2 text-sm font-bold text-gray-900">{current!.name}</span>
                                    <span className="mt-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-600">
                                        You have {currentCount}
                                    </span>
                                </motion.div>
                            </div>
                            <Arrow
                                direction="right"
                                disabled={fruits.length <= 1}
                                onClick={() => setIndex((clampedIndex + 1) % fruits.length)}
                            />
                        </div>
                    )}

                    {error && <p className="mb-4 text-center text-sm font-medium text-red-500">{error}</p>}

                    <button
                        type="button"
                        disabled={!current || busy}
                        onClick={() => {
                            setPending({ fruit: current, count: currentCount })
                            setStage('confirm')
                        }}
                        className="w-full rounded-full bg-black py-3.5 text-sm font-bold text-white transition-colors active:bg-black/70 disabled:opacity-40 disabled:active:bg-black"
                    >
                        CLONE · Create 2 Copies
                    </button>
                </div>
            )}

            {/* 4. CONFIRM CLONE */}
            {stage === 'confirm' && pending && (
                <div className="flex flex-col items-center text-center">
                    <h2 className="mb-5 text-xl font-bold text-gray-900">CONFIRM CLONE</h2>
                    <AbilityFruitOrb fruit={pending.fruit} size={72} glow className="mb-3" />
                    <span className="mb-4 text-sm font-bold text-gray-900">{pending.fruit.name}</span>

                    <div className="mb-5 flex items-center gap-3 rounded-2xl bg-gray-50 px-5 py-3 text-sm font-bold text-gray-900">
                        <span className="text-slate-500">Current</span>
                        <span className="rounded-full bg-white px-2.5 py-0.5 shadow-sm">x{pending.count}</span>
                        <svg viewBox="0 0 24 24" className="size-4 text-slate-400" fill="none">
                            <path d="M4 12h16m0 0-5-5m5 5-5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-slate-500">After Cloning</span>
                        <span className="rounded-full bg-black px-2.5 py-0.5 text-white shadow-sm">x{confirmAfter}</span>
                    </div>

                    {error && <p className="mb-4 text-sm font-medium text-red-500">{error}</p>}

                    <div className="flex w-full gap-3">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                setError(null)
                                setStage('carousel')
                            }}
                            className="flex-1 rounded-full bg-gray-200 py-3.5 text-sm font-bold text-gray-600 transition-colors active:bg-gray-300"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleClone()}
                            className="flex-1 rounded-full bg-black py-3.5 text-sm font-bold text-white transition-colors active:bg-black/70"
                        >
                            {busy ? 'Cloning…' : 'Clone'}
                        </button>
                    </div>
                </div>
            )}

            {/* 5. CLONE SUCCESSFUL */}
            {stage === 'success' && pending && (
                <div className="flex flex-col items-center text-center">
                    <motion.div
                        initial={{ scale: 0.7, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                        className="mb-5 flex items-center justify-center py-1"
                    >
                        <div className="relative flex items-end justify-center">
                            <div className="relative z-0 -mr-1.5">
                                <AbilityFruitOrb fruit={pending.fruit} size={44} />
                                <GreenCheck className="absolute -bottom-1 -right-1 z-10" />
                            </div>
                            <div className="relative -mr-1.5 translate-y-1.5 z-10">
                                <AbilityFruitOrb fruit={pending.fruit} size={52} />
                                <GreenCheck className="absolute -bottom-1 -right-1 z-10" />
                            </div>
                            <div className="relative translate-y-3 z-20">
                                <AbilityFruitOrb fruit={pending.fruit} size={60} />
                                <GreenCheck className="absolute -bottom-1 -right-1 z-10" />
                            </div>
                        </div>
                    </motion.div>
                    <h2 className="mb-2 text-xl font-bold text-gray-900">Clone Successful!</h2>
                    <p className="mb-8 text-sm text-slate-500">
                        You now have <span className="font-bold text-gray-900">{confirmAfter} {pending.fruit.name}s</span>.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-full bg-black py-3.5 text-sm font-bold text-white transition-colors active:bg-black/70"
                    >
                        OK
                    </button>
                </div>
            )}
        </Modal>
    )
}

export default CloneFruitModal