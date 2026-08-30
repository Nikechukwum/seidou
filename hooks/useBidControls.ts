'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

// BIG SIS REQUEST: Controls modal + persistent bid mode

export type BidMode = 'increment' | 'slider' | 'voice'

const STORAGE_KEY = 'seidou_bid_mode'
const DEFAULT_MODE: BidMode = 'increment'

// BIG SIS REQUEST: max slider value reduced to 500,000
const SLIDER_STEPS = [
    10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000,
    100000, 200000, 300000, 400000, 500000,
]

export function useBidControls() {
    const [bidMode, setBidMode] = useState<BidMode>(DEFAULT_MODE)

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY) as BidMode | null
            if (saved && ['increment', 'slider', 'voice'].includes(saved)) {
                setBidMode(saved)
            }
        } catch {}
    }, [])

    const setAndPersistMode = useCallback((mode: BidMode) => {
        setBidMode(mode)
        try { localStorage.setItem(STORAGE_KEY, mode) } catch {}
    }, [])

    const incrementAmounts = useMemo(() => [50000, 100000, 1000000], [])

    const sliderConfig = useMemo(() => ({
        min: 10000,
        max: 500000,
        steps: SLIDER_STEPS,
    }), [])

    const getSliderValueFromPosition = useCallback(
        (positionPercent: number): number => {
            const idx = Math.round((positionPercent / 100) * (SLIDER_STEPS.length - 1))
            return SLIDER_STEPS[Math.max(0, Math.min(idx, SLIDER_STEPS.length - 1))]
        },
        []
    )

    return {
        bidMode,
        setBidMode: setAndPersistMode,
        incrementAmounts,
        sliderConfig,
        getSliderValueFromPosition,
    }
}
