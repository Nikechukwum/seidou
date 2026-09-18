'use client'

// ============================================================================
// ADAPTIVE LEADERBOARD — PINNED VIEWPORT
// ----------------------------------------------------------------------------
// A FOUR-card viewport that permanently answers both core questions:
//
//   • WHO HOLDS FIRST PLACE?   — position #1 NEVER leaves the viewport.
//   • WHERE AM I?              — the player's card NEVER leaves the viewport.
//
// Layout when the player sits at #45, for example:
//
//        [ 1 ]        first place — always pinned
//        [ 43 ]       the scrolling window between the two pins
//        [ 44 ]
//        [ 45 ]       the player — always pinned
//
// Scrolling (mouse wheel / finger drag) NEVER moves #1 or the player. It only slides
// the two middle cards through everyone who sits between them:
//   scroll up   -> 1, 42, 43, 45 -> 1, 41, 42, 45 -> ... -> 1, 2, 3, 45
//   scroll down -> back to the default 1, 43, 44, 45
//
// The four card FRAMES stay perfectly still — a scroll only swaps the DATA in
// the middle slots, and only the rank number, the bid amount and the player's
// name perform a fast slide in the scroll direction (the "number flip").
//
// Realtime: live bid updates re-derive every rank and update the pinned cards
// immediately. Nothing scrolls under the user, and the pins never break.
// ============================================================================

import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'

export type LeaderboardRow = {
    id: string | number
    userId: string | number
}

/** Passed to renderCard so the page can animate number/bid/name on change. */
export type SlotAnim = {
    /** Stable per visible row — changing it triggers the text flip. */
    flipKey: string
    /** Last scroll direction (1 = scrolling down, -1 = scrolling up). */
    dir: 1 | -1
}

const VIEWPORT = 4
const MIN_DRAG_PX = 30
const SCROLL_LOCK_MS = 140

function clamp(v: number, min: number, max: number) {
    return Math.min(Math.max(v, min), max)
}

function directionOf(delta: number) {
    return delta > 0 ? 1 : delta < 0 ? -1 : 0
}

interface AdaptiveLeaderboardProps {
    /** Live rows for the auction (any order; ranked inside this component). */
    rows: LeaderboardRow[]
    /** The player whose position we track and pin. */
    myUserId: string | null
    /** Renders one card for a visible row; `rank` is its true table position. */
    renderCard: (row: LeaderboardRow, rank: number, anim: SlotAnim) => ReactNode
}

export default function AdaptiveLeaderboard({ rows, myUserId, renderCard }: AdaptiveLeaderboardProps) {
    // Slide offset for the two middle cards (0 = resting at the player's
    // doorstep: 1, P-2, P-1, P). Negative = scrolled toward first place.
    const [offset, setOffset] = useState(0)
    const dirRef = useRef<1 | -1>(1)

    const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null)
    const scrollLockRef = useRef(0)

    // Ranks come from a stable sort: highest bid first, ties broken by row id.
    const rankedRows = useMemo(() => {
        const sorted = [...rows]
        sorted.sort((a, b) => {
            const amountA = Number((a as Record<string, unknown>).bidAmount ?? 0)
            const amountB = Number((b as Record<string, unknown>).bidAmount ?? 0)
            if (amountB !== amountA) return amountB - amountA
            return String(a.id).localeCompare(String(b.id))
        })
        return sorted
    }, [rows])

    const total = rankedRows.length

    const playerRank = useMemo(() => {
        if (!myUserId) return null
        const idx = rankedRows.findIndex((r) => String(r.userId) === String(myUserId))
        return idx === -1 ? null : idx + 1
    }, [myUserId, rankedRows])

    // The pins only leave if the player has no bid yet, or their true position
    // already fits inside the natural top-4 window (then it is simply visible).
    const playerPinnedBelow = playerRank !== null && playerRank > VIEWPORT

    // A live bid change can move the player. Snap the middle window back to its
    // resting place (1, P-2, P-1, P) so the pinned view always "re-finds" them.
    useEffect(() => {
        setOffset(0)
    }, [playerRank])

    // Four static slots:
    //   [0] = #1 (always)        [1], [2] = the sliding middle window
    //   [3] = the player (always, when pinned below)
    const slots = useMemo(() => {
        if (total === 0) return [] as { row: LeaderboardRow; rank: number }[]
        if (!playerPinnedBelow) {
            const count = Math.min(VIEWPORT, total)
            return Array.from({ length: count }, (_, i) => ({
                row: rankedRows[i],
                rank: i + 1,
            }))
        }

        const p = playerRank as number
        const off = clamp(offset, 4 - p, 0)
        return [
            { row: rankedRows[0], rank: 1 },
            { row: rankedRows[p - 3 + off], rank: p - 2 + off },
            { row: rankedRows[p - 2 + off], rank: p - 1 + off },
            { row: rankedRows[p - 1], rank: p },
        ]
    }, [total, playerPinnedBelow, playerRank, offset, rankedRows])

    const scrollable = playerPinnedBelow && total > VIEWPORT

    const scrollBy = (delta: number, throttle = true) => {
        const dir = directionOf(delta)
        if (dir === 0 || !scrollable || playerRank === null) return
        if (throttle) {
            const now = Date.now()
            if (now < scrollLockRef.current) return
            scrollLockRef.current = now + SCROLL_LOCK_MS
        }
        dirRef.current = dir
        setOffset((o) => clamp(o + dir, 4 - playerRank, 0))
    }

    // Non-passive wheel + drag handling (React's synthetic events are passive).
    // Keep the latest values reachable from the always-mounted DOM listeners.
    const scrollableRef = useRef(scrollable)
    scrollableRef.current = scrollable
    const scrollByRef = useRef(scrollBy)
    scrollByRef.current = scrollBy

    useEffect(() => {
        const el = containerEl
        if (!el) return
        let dragY: number | null = null

        const onWheel = (e: WheelEvent) => {
            if (!scrollableRef.current) return
            e.preventDefault()
            scrollByRef.current(e.deltaY)
        }
        const onTouchStart = (e: TouchEvent) => {
            if (!scrollableRef.current) return
            if (e.touches.length === 1) dragY = e.touches[0].clientY
        }
        // Step one user per MIN_DRAG_PX of finger travel, live while dragging,
        // so a long swipe walks through many users.
        const onTouchMove = (e: TouchEvent) => {
            if (dragY === null || !scrollableRef.current) return
            e.preventDefault()
            const y = e.touches[0].clientY
            const dy = dragY - y
            if (Math.abs(dy) >= MIN_DRAG_PX) {
                scrollByRef.current(dy, false)
                dragY = y
            }
        }
        const onTouchEnd = () => {
            dragY = null
        }

        el.addEventListener('wheel', onWheel, { passive: false })
        el.addEventListener('touchstart', onTouchStart, { passive: true })
        el.addEventListener('touchmove', onTouchMove, { passive: false })
        el.addEventListener('touchend', onTouchEnd)
        return () => {
            el.removeEventListener('wheel', onWheel)
            el.removeEventListener('touchstart', onTouchStart)
            el.removeEventListener('touchmove', onTouchMove)
            el.removeEventListener('touchend', onTouchEnd)
        }
    }, [containerEl])

    if (total === 0) return null

    const animFor = (row: LeaderboardRow): SlotAnim => ({
        flipKey: String(row.id),
        dir: dirRef.current,
    })

    return (
        <div className="relative flex items-stretch gap-1">
            <div ref={setContainerEl} className={`min-w-0 flex-1 ${scrollable ? 'touch-none select-none' : 'touch-pan-y'}`}>
                <div className="flex flex-col gap-3.5">
                    {slots.map((slot, i) => (
                        // The frame stays mounted forever — the data inside it
                        // changes, never the frame itself.
                        <div key={i} className="relative">
                            {renderCard(slot.row, slot.rank, animFor(slot.row))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}