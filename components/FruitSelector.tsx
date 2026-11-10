'use client'

// ============================================================================
// FRUIT SELECTOR — the compact ability-fruit picker in the table header.
// ----------------------------------------------------------------------------
// One fruit at a time: the left/right arrows step through the fruits, a
// DOUBLE TAP on the fruit activates it, and the (i) icon opens the full
// Ability Fruits page. The tap sound comes from the app-wide <SoundEffects />
// listener, so the arrows already play it.
// ============================================================================

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Info } from 'lucide-react'
import AbilityFruitOrb from '@/components/AbilityFruitOrb'
import { AbilityFruit } from '@/lib/abilityFruits'

/** Two taps closer together than this count as a double tap. */
const DOUBLE_TAP_MS = 350

type Props = {
    fruits: { fruit: AbilityFruit; label: string }[]
    usesLeft: (fruit: AbilityFruit) => number
    onActivate: (fruit: AbilityFruit) => void
    onInfo: () => void
}

export default function FruitSelector({ fruits, usesLeft, onActivate, onInfo }: Props) {
    const [index, setIndex] = useState(0)
    const lastTapRef = useRef(0)

    if (fruits.length === 0) return null
    const { fruit, label } = fruits[index % fruits.length]

    const step = (dir: 1 | -1) => {
        lastTapRef.current = 0
        setIndex((i) => (i + dir + fruits.length) % fruits.length)
    }

    // Our own double-tap check: mobile browsers do not reliably fire dblclick.
    const handleTap = () => {
        const now = Date.now()
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
            lastTapRef.current = 0
            onActivate(fruit)
            return
        }
        lastTapRef.current = now
    }

    return (
        <div className="relative flex h-full items-center rounded-2xl border border-gray-200 bg-white px-1 py-2">
            <button
                onClick={onInfo}
                aria-label="About ability fruits"
                className="absolute top-1.5 right-1.5 p-1 text-gray-400 active:text-gray-700"
            >
                <Info className="size-4" />
            </button>

            <button onClick={() => step(-1)} aria-label="Previous fruit" className="shrink-0 p-1 text-gray-600 active:text-black">
                <ChevronLeft className="size-5" />
            </button>

            <button
                onClick={handleTap}
                className="flex min-w-0 flex-1 select-none flex-col items-center touch-manipulation"
            >
                <AbilityFruitOrb fruit={fruit} size={30} />
                {/* Name under the fruit, with the uses left beside the name. */}
                <div className="mt-0.5 flex min-w-0 max-w-full items-baseline gap-1">
                    <span className="truncate text-sm font-bold text-gray-900">{label}</span>
                    <span className="shrink-0 text-xs font-semibold text-gray-500">x{usesLeft(fruit)}</span>
                </div>
                <span className="text-[10px] leading-tight text-gray-500">Double tap to activate</span>
            </button>

            <button onClick={() => step(1)} aria-label="Next fruit" className="shrink-0 p-1 text-gray-600 active:text-black">
                <ChevronRight className="size-5" />
            </button>
        </div>
    )
}
