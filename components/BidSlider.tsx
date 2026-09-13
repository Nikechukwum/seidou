'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'

// Land Wars bid slider: drag to pick an amount, release to bid, swipe up to cancel.
//
// The thumb and fill are driven by a motion value, so they follow the finger
// on every pointer move without re-rendering React. State changes only when
// the amount crosses to another step or the swipe-up state flips, and only
// this component re-renders — never the table page around it.

interface BidSliderProps {
    // Ascending bid amounts, spaced evenly along the track
    steps: number[]
    disabled?: boolean
    onBid: (amount: number) => void
    onCancel: () => void
}

const CANCEL_SWIPE_PX = 80
const SETTLE_SPRING = { type: 'spring', stiffness: 600, damping: 40 } as const

export default function BidSlider({ steps, disabled, onBid, onCancel }: BidSliderProps) {
    const trackRef = useRef<HTMLDivElement>(null)
    const lastIndex = steps.length - 1

    // 0–100: where the thumb sits along the track
    const percent = useMotionValue(0)
    const thumbX = useTransform(percent, (p) => `${p}%`)
    const fillX = useTransform(percent, (p) => `${p - 100}%`)

    // Refs are read by the pointer handlers, so a move that arrives before
    // React re-renders is never dropped
    const draggingRef = useRef(false)
    const startYRef = useRef(0)
    const stepIndexRef = useRef(0)
    const cancelledRef = useRef(false)

    const [dragging, setDragging] = useState(false)
    const [stepIndex, setStepIndex] = useState(0)
    const [cancelled, setCancelled] = useState(false)

    const updateFromPointer = (clientX: number, clientY: number) => {
        const rect = trackRef.current?.getBoundingClientRect()
        if (!rect || rect.width === 0) return

        const p = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
        percent.set(p)

        const idx = Math.round((p / 100) * lastIndex)
        if (idx !== stepIndexRef.current) {
            stepIndexRef.current = idx
            setStepIndex(idx)
        }

        const isCancelled = startYRef.current - clientY > CANCEL_SWIPE_PX
        if (isCancelled !== cancelledRef.current) {
            cancelledRef.current = isCancelled
            setCancelled(isCancelled)
        }
    }

    // Ends the drag and settles the thumb onto the chosen step's mark
    const finishDrag = () => {
        draggingRef.current = false
        setDragging(false)
        const wasCancelled = cancelledRef.current
        cancelledRef.current = false
        setCancelled(false)
        animate(percent, (stepIndexRef.current / lastIndex) * 100, SETTLE_SPRING)
        return wasCancelled
    }

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (disabled || e.button !== 0) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        percent.stop()
        draggingRef.current = true
        startYRef.current = e.clientY
        setDragging(true)
        updateFromPointer(e.clientX, e.clientY)
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return
        updateFromPointer(e.clientX, e.clientY)
    }

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return
        updateFromPointer(e.clientX, e.clientY)
        const wasCancelled = finishDrag()
        if (wasCancelled) onCancel()
        else onBid(steps[stepIndexRef.current])
    }

    // The browser took the gesture (e.g. a system swipe): end without bidding
    const handlePointerCancel = () => {
        if (!draggingRef.current) return
        finishDrag()
    }

    return (
        <>
            {/* 40px-tall touch area around the 8px track; the negative margin keeps the footer's height unchanged */}
            <div
                className={`relative -my-4 flex h-10 w-full items-center ${disabled ? 'opacity-60' : 'cursor-pointer'}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                style={{ touchAction: 'none' }}
            >
                <div ref={trackRef} className="relative h-2 w-full">
                    <div className="absolute inset-0 overflow-hidden rounded-full bg-gray-200">
                        <motion.div className="h-full w-full bg-blue-500" style={{ x: fillX }} />
                    </div>
                    <motion.div className="pointer-events-none absolute inset-0" style={{ x: thumbX }}>
                        <div className="absolute left-0 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500 bg-white shadow-md" />
                    </motion.div>
                </div>
            </div>
            <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>{steps[0].toLocaleString()}</span>
                <span>{steps[lastIndex].toLocaleString()}</span>
            </div>

            {/* Overlay: dims the page and shows the amount. Portalled to body so the
                footer's stacking context can't place it under the table. */}
            {dragging && createPortal(
                <>
                    <div className="fixed inset-0 z-50 bg-black/50 pointer-events-none" />
                    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center pointer-events-none">
                        <div className="bg-black/80 text-white text-5xl font-bold px-10 py-6 rounded-3xl">
                            B {steps[stepIndex].toLocaleString()}
                        </div>
                        {/* Same padding in both states so the text doesn't shift; a solid red pill keeps the cancel state readable over the dimmed page */}
                        <p className={`mt-3 rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                            cancelled ? 'bg-red-500 text-white' : 'text-white'
                        }`}>
                            {cancelled ? 'Release to cancel' : 'Swipe up to cancel'}
                        </p>
                    </div>
                </>,
                document.body
            )}
        </>
    )
}
