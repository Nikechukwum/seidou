'use client'

// ============================================================================
// AUCTION COUNTDOWN — "AUCTION ENDS IN" with live Days / Hours / Minutes /
// Seconds columns, in the style of a music pre-save countdown, on a white card.
// Ticks every second from the auction's endTime; stops at all zeros.
// ============================================================================

import { useEffect, useState } from 'react'

type Props = {
    /** The auction's end time (ISO string). Null while it is still loading. */
    endTime: string | null
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function remainingParts(endMs: number, nowMs: number) {
    const left = Math.max(0, endMs - nowMs)
    return {
        days: Math.floor(left / DAY),
        hours: Math.floor((left % DAY) / HOUR),
        minutes: Math.floor((left % HOUR) / MINUTE),
        seconds: Math.floor((left % MINUTE) / SECOND),
    }
}

export default function AuctionCountdown({ endTime }: Props) {
    const endMs = endTime ? Date.parse(endTime) : NaN
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        if (!Number.isFinite(endMs)) return
        const timer = setInterval(() => {
            const t = Date.now()
            setNow(t)
            if (t >= endMs) clearInterval(timer)
        }, SECOND)
        return () => clearInterval(timer)
    }, [endMs])

    const known = Number.isFinite(endMs)
    const parts = known ? remainingParts(endMs, now) : null
    const columns = [
        { label: 'Days', value: parts?.days },
        { label: 'Hours', value: parts?.hours },
        { label: 'Minutes', value: parts?.minutes },
        { label: 'Seconds', value: parts?.seconds },
    ]

    return (
        <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-1 py-1.5">
            <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-500">
                {known && now >= endMs ? 'Auction ended' : 'Auction ends in'}
            </p>
            <div className="mt-0.5 flex w-full items-stretch justify-between">
                {columns.map((col, i) => (
                    <div key={col.label} className="flex min-w-0 flex-1 items-stretch">
                        {i > 0 && <span className="my-1 w-px shrink-0 bg-gray-200" />}
                        <div className="flex min-w-0 flex-1 flex-col items-center">
                            <span className="text-sm font-bold leading-tight text-gray-900 tabular-nums">
                                {col.value === undefined ? '--' : String(col.value).padStart(2, '0')}
                            </span>
                            <span className="text-[7px] tracking-tight text-gray-500">{col.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
