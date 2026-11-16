'use client'

// ============================================================================
// TABLE EVENTS — the "Events" card in the table header and its bottom sheet.
// ----------------------------------------------------------------------------
//   GLOBAL    things that happened on this table (fruit plays by anyone).
//   PERSONAL  things that involve ME (my fruits, fruits aimed at me, my bids,
//             purchases, "Insufficient funds", ...).
// Tapping a pill opens the sheet titled "Global" or "Personal". The page owns
// the event list; this file only draws it.
// ============================================================================

import { DrawerModal } from '@/components/DrawerModal'
import AbilityFruitOrb from '@/components/AbilityFruitOrb'
import { AbilityFruitId, getAbilityFruit } from '@/lib/abilityFruits'
import { CheckCircle2, Globe, Sparkles, User, XCircle } from 'lucide-react'

export type EventScope = 'global' | 'personal'

export type TableEvent = {
    id: number
    text: string
    /** fruit = an ability fruit play; success / error = from a toast. */
    tone: 'fruit' | 'success' | 'error'
    global: boolean
    personal: boolean
    /** Date.now() when it happened. */
    at: number
    /** For fruit plays: which fruit, so the sheet can show its icon. */
    fruitId?: AbilityFruitId
}

export function EventsCard({
    globalCount,
    personalCount,
    onOpen,
}: {
    globalCount: number
    personalCount: number
    onOpen: (scope: EventScope) => void
}) {
    return (
        <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-2 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Events</p>
            {/* Global and Personal side by side: the count on top, its name below. */}
            <div className="mt-0.5 flex w-full">
                {([
                    { scope: 'global', count: globalCount, label: 'Global', Icon: Globe },
                    { scope: 'personal', count: personalCount, label: 'Personal', Icon: User },
                ] as const).map(({ scope, count, label, Icon }) => (
                    <button
                        key={scope}
                        onClick={() => onOpen(scope)}
                        className="flex min-w-0 flex-1 flex-col items-center rounded-xl py-0.5 active:bg-gray-100"
                    >
                        <span className="text-lg font-bold leading-tight text-gray-900 tabular-nums">{count}</span>
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                            <Icon className="size-2.5" />
                            {label}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}

function timeAgo(at: number, now: number) {
    const s = Math.max(0, Math.round((now - at) / 1000))
    if (s < 60) return `${s}s ago`
    const m = Math.round(s / 60)
    if (m < 60) return `${m}m ago`
    return `${Math.round(m / 60)}h ago`
}

export function EventsSheet({
    scope,
    events,
    onClose,
}: {
    /** Which list is open; null = closed. */
    scope: EventScope | null
    events: TableEvent[]
    onClose: () => void
}) {
    const list = scope ? events.filter((e) => (scope === 'global' ? e.global : e.personal)) : []
    const now = Date.now()
    return (
        // z-40: above the z-30 bid bar at the bottom of the table.
        <DrawerModal isActive={scope !== null} setIsActive={(v) => { if (!v) onClose() }} zIndexClass="z-40">
            <h2 className="mb-3 text-lg font-bold text-gray-900">{scope === 'personal' ? 'Personal' : 'Global'}</h2>
            {/* Fixed height: with the bid bar the sheet covers about two of the
                four player cards, and the list scrolls inside it. */}
            <div className="h-44 overflow-y-auto no-scrollbar">
                {list.length === 0 ? (
                    <p className="pt-10 text-center text-sm text-gray-500">No events yet.</p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {[...list].reverse().map((e) => {
                            const fruit = e.fruitId ? getAbilityFruit(e.fruitId) : undefined
                            return (
                            <li key={e.id} className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2">
                                {/* Fruit plays show that fruit's own icon; the rest
                                    keep the generic sparkle / tick / cross. */}
                                {fruit ? (
                                    <AbilityFruitOrb fruit={fruit} size={20} />
                                ) : e.tone === 'fruit' ? (
                                    <Sparkles className="size-4 shrink-0 text-purple-500" />
                                ) : e.tone === 'success' ? (
                                    <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                                ) : (
                                    <XCircle className="size-4 shrink-0 text-red-500" />
                                )}
                                <span className="flex-1 text-sm text-gray-800">{e.text}</span>
                                <span className="shrink-0 text-[11px] text-gray-400">{timeAgo(e.at, now)}</span>
                            </li>
                            )
                        })}
                    </ul>
                )}
            </div>
        </DrawerModal>
    )
}
