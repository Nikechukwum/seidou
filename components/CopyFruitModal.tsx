'use client'

// ============================================================================
// COPY FRUIT MODAL — the "COPY AN ABILITY" picker.
// ----------------------------------------------------------------------------
// Design sheets (video + master prompt), six flows:
//   1. Tap to Activate  — on the Ability Fruits page, handled by the caller.
//   2. History pop-up   — this modal. "COPY AN ABILITY", list of the last 3
//                         ability fruits used on the table before the fruit
//                         was activated (max 3, fewer when fewer used, empty
//                         state when none).
//   3. Select an ability — single-select checkbox rows; row highlights blue
//                         once checked; COPY stays grey until something is
//                         chosen.
//   4. Tap Copy          — COPY turns BLACK with white text when active.
//   5. Success           — "Ability Copied!" checkmark + the copied fruit's
//                         name, OK button in blue (#2D7FF9).
//   6. Copied & ready    — back on the page, the copied fruit's uses carry
//                         the +1 bonus (granted by the caller's onCopied).
//
// Closing the modal without copying consumes NOTHING (the commit only runs on
// the Copy tap). Copy Fruit itself never appears in the list (excluded on the
// server AND the client), and the filler of the flow — who used it, me or a
// rival — does not matter: all activations count.
// ============================================================================

import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Modal } from '@/components/Modal'
import AbilityFruitOrb from '@/components/AbilityFruitOrb'
import { AbilityFruit, COPYABLE_FRUIT_IDS, getAbilityFruit } from '@/lib/abilityFruits'

type CopyHistoryItem = { fruit_id: string; seconds_ago: number }

type Props = {
    isActive: boolean
    onClose: () => void
    auctionId: string
    /** Called once when the copy COMMITS. Fruit is consumed by the caller. */
    onCopied: (fruitId: string) => void
}

type CopyStage = 'loading' | 'pick' | 'success'

/** Unchecked = empty circle, checked = blue circle with a white check. */
const CheckCircle = ({ checked }: { checked: boolean }) => (
    <span
        className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            checked ? 'border-[#2D7FF9] bg-[#2D7FF9]' : 'border-slate-300 bg-white'
        }`}
    >
        {checked && (
            <svg viewBox="0 0 12 12" className="size-3 text-white" fill="none">
                <path
                    d="M2 6.4 4.8 9 10 3.2"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        )}
    </span>
)

const CopyFruitModal = ({ isActive, onClose, auctionId, onCopied }: Props) => {
    const [stage, setStage] = useState<CopyStage>('loading')
    const [history, setHistory] = useState<CopyHistoryItem[]>([])
    const [selected, setSelected] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    // Each time the modal opens, pull the live history snapshot. Anything used
    // after this open belongs to a LATER snapshot.
    useEffect(() => {
        if (!isActive) return
        let cancelled = false
        setStage('loading')
        setSelected(null)
        setError(null)
        void (async () => {
            try {
                const res = await fetch(`/api/landwars/copy-fruit?auctionId=${encodeURIComponent(auctionId)}`)
                const data = await res.json()
                if (cancelled) return
                if (res.ok) {
                    setHistory(Array.isArray(data?.history) ? data.history : [])
                } else {
                    setError(data?.error ?? 'Could not load the ability history.')
                    setHistory([])
                }
            } catch {
                if (!cancelled) {
                    setError('Could not load the ability history.')
                    setHistory([])
                }
            } finally {
                if (!cancelled) setStage('pick')
            }
        })()
        return () => {
            cancelled = true
        }
    }, [isActive, auctionId])

    // Only real, coppable fruits render — Copy Fruit can never be copied.
    // Max 3, in recency order straight from the server.
    const rows = history
        .map((h) => {
            const fruit = getAbilityFruit(h.fruit_id)
            return fruit && COPYABLE_FRUIT_IDS.includes(fruit.id) ? { fruit, item: h } : null
        })
        .filter((r): r is { fruit: AbilityFruit; item: CopyHistoryItem } => r !== null)
        .slice(0, 3)

    const copiedFruit = selected ? getAbilityFruit(selected) : undefined

    const handleCopy = async () => {
        if (!selected || busy) return
        setBusy(true)
        setError(null)
        try {
            const res = await fetch('/api/landwars/copy-fruit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auctionId, targetFruitId: selected }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data?.error ?? 'Could not copy that ability.')
                setBusy(false)
                return
            }
            onCopied(selected)
            setStage('success')
        } catch {
            setError('Could not copy that ability. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal isActive={isActive} setIsActive={() => onClose()}>
            {stage === 'loading' && (
                <div className="flex min-h-48 flex-col items-center justify-center text-sm text-slate-500">
                    Loading abilities…
                </div>
            )}

            {stage === 'pick' && (
                <div>
                    <h2 className="mb-1 text-center text-xl font-bold text-gray-900">COPY AN ABILITY</h2>
                    <p className="mb-5 text-center text-sm text-slate-500">
                        Choose one of the last 3 abilities activated.
                    </p>

                    {rows.length === 0 ? (
                        <div className="mb-6 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                            <p className="font-semibold text-slate-600">No abilities have been used yet</p>
                            <p className="mt-1 text-xs">Use any ability fruit on this table first, then come back.</p>
                        </div>
                    ) : (
                        <div className="mb-5 flex flex-col gap-2">
                            {rows.map(({ fruit, item }) => {
                                const isSelected = selected === fruit.id
                                return (
                                    <button
                                        key={fruit.id}
                                        type="button"
                                        onClick={() => setSelected(isSelected ? null : fruit.id)}
                                        className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                                            isSelected
                                                ? 'border-[#2D7FF9] bg-blue-50'
                                                : 'border-gray-100 bg-white hover:border-gray-200'
                                        }`}
                                    >
                                        <AbilityFruitOrb fruit={fruit} size={40} glow={isSelected} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-bold text-gray-900">
                                                {fruit.name}
                                            </span>
                                            <span className="block text-xs text-slate-400">
                                                Activated {item.seconds_ago <= 0 ? 'just now' : `${item.seconds_ago}s ago`}
                                            </span>
                                        </span>
                                        <CheckCircle checked={isSelected} />
                                    </button>
                                )
                            })}
                        </div>
                    )}

                    {error && <p className="mb-4 text-center text-sm font-medium text-red-500">{error}</p>}

                    <button
                        type="button"
                        disabled={!selected || busy}
                        onClick={() => void handleCopy()}
                        className={`w-full rounded-full py-3.5 text-sm font-bold transition-colors ${
                            selected && !busy
                                ? 'bg-black text-white active:bg-black/70'
                                : 'bg-[#D3D3D3] text-white'
                        }`}
                    >
                        {busy ? 'Copying…' : 'Copy'}
                    </button>
                </div>
            )}

            {stage === 'success' && copiedFruit && (
                <div className="flex flex-col items-center text-center">
                    <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                        className="mb-5 flex size-20 items-center justify-center rounded-full bg-[#dbeafe]"
                    >
                        <svg viewBox="0 0 40 40" className="size-10 text-[#2D7FF9]" fill="none">
                            <path
                                d="M10 21 17 28 31 12"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </motion.div>
                    <h2 className="mb-2 text-xl font-bold text-gray-900">Ability Copied!</h2>
                    <AbilityFruitOrb fruit={copiedFruit} size={64} glow className="mb-2" />
                    <p className="mb-8 text-sm text-slate-500">
                        <span className="font-bold text-gray-900">{copiedFruit.name}</span> is now in your abilities.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-full bg-[#2D7FF9] py-3.5 text-sm font-bold text-white active:bg-[#2D7FF9]/70 transition-colors"
                    >
                        OK
                    </button>
                </div>
            )}
        </Modal>
    )
}

export default CopyFruitModal