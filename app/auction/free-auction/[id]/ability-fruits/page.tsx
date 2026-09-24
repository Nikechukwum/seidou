'use client'

// ============================================================================
// ABILITY FRUITS PAGE
// ----------------------------------------------------------------------------
//  tapping the "Ability Fruits" tab on the table — or saying
// "activate ability fruit" while in voice mode — lands here FIRST. The player
// picks a fruit here, then Activate takes them back to the table to choose a
// target.
//
// Testing phase: every user holds all 10 fruits, 10 uses each.
// ============================================================================

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageLayout } from '@/components/PageLayout'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import AbilityFruitOrb from '@/components/AbilityFruitOrb'
import CopyFruitModal from '@/components/CopyFruitModal'
import CloneFruitModal from '@/components/CloneFruitModal'
import { ABILITY_FRUITS, AbilityFruit, AbilityFruitId, TESTING_PHASE_FRUIT_COUNT, getAbilityFruit } from '@/lib/abilityFruits'
import { getFruitUsage, getFruitBonuses, recordFruitUse, grantFruitBonus, availableUses } from '@/lib/fruitUsage'

const AbilityFruitsPage = () => {
    const params = useParams()
    const auctionId = params.id as string
    const router = useRouter()

    const [learnMore, setLearnMore] = useState<AbilityFruit | null>(null)
    const [comingSoon, setComingSoon] = useState<AbilityFruit | null>(null)
    // Set by the frozen check on Activate: "You are currently frozen — wait Xs".
    const [freezeNotice, setFreezeNotice] = useState<{ remaining: number } | null>(null)
    // Seconds left before each fruit can fire again, keyed by fruit id. Every
    // fruit shares the negate-style cooldown; the count here is read once from
    // the server and ticked down locally while this page is open.
    const [cooldowns, setCooldowns] = useState<Record<string, number>>({})
    // Set when Activate is tapped on a fruit that is still cooling down.
    const [cooldownNotice, setCooldownNotice] = useState<AbilityFruit | null>(null)

    //  The Copy Fruit flow. Activate on the Copy Fruit opens this
    // picker inline (it does NOT navigate to the table — there is no target).
    // Closing without copying consumes nothing; a successful copy consumes one
    // Copy Fruit use and adds a bonus use of the copied fruit (both in
    // onCopied below). The badges below re-read the storage-backed ledger on
    // every render, so they refresh the moment the modal closes.
    const [copyOpen, setCopyOpen] = useState(false)

    //  The Clone Fruit flow. Activate on the Clone Fruit opens this
    // carousel inline (it does NOT navigate to the table — there is no
    // target): pick a fruit you own, confirm, and it becomes Current + 2.
    // Closing without cloning consumes nothing; a successful clone consumes
    // one Clone Fruit use and adds 2 bonus uses of the chosen fruit (both in
    // onCloned below).
    const [cloneOpen, setCloneOpen] = useState(false)

    // Live uses for the x-badges: base 10 − spent + copied bonuses. Re-read
    // on every render, so the badges are fresh once the copy modal closes.
    const usage = getFruitUsage(auctionId)
    const bonuses = getFruitBonuses(auctionId)

    // Read the live cooldowns when the page opens (whatever you just cast runs
    // its countdown server-side, so re-entering the page shows the truth).
    useEffect(() => {
        let cancelled = false
        const load = async () => {
            try {
                const res = await fetch(`/api/landwars/fruit-cooldown?auctionId=${encodeURIComponent(auctionId)}`)
                const data = await res.json()
                if (!cancelled && res.ok && data?.cooldowns) {
                    setCooldowns(data.cooldowns)
                }
            } catch {
                // keep whatever we already have — a failed read must not block the page
            }
        }
        void load()
        return () => {
            cancelled = true
        }
    }, [auctionId])

    // Count the on-screen "N s" pills down locally between reads.
    useEffect(() => {
        if (Object.keys(cooldowns).length === 0) return
        const t = setInterval(() => {
            setCooldowns((prev) => {
                const next: Record<string, number> = {}
                for (const [id, secs] of Object.entries(prev)) {
                    if (secs > 1) next[id] = secs - 1
                }
                return next
            })
        }, 1000)
        return () => clearInterval(t)
    }, [cooldowns])

    const handleActivate = async (fruit: AbilityFruit) => {
        if (!fruit.available) {
            setComingSoon(fruit)
            return
        }
        // COOLDOWN: the same fruit cannot be fired twice within 20s — stopped
        // here with a notice, before the table arms it. Applies to Negate too.
        const coolingFor = cooldowns[fruit.id] ?? 0
        if (coolingFor > 0) {
            setCooldownNotice(fruit)
            return
        }
        // A player frozen by someone else's Freeze Fruit cannot activate any
        // fruit except NEGATE — the freeze's one designed counter. Checking here
        // means the "you are currently frozen" response arrives the moment they
        // tap Activate, before the table ever arms the fruit and plays a frame
        // that the server would have to refuse and revert.
        if (fruit.id !== 'negate') {
            try {
                const res = await fetch(`/api/landwars/freeze-bid?auctionId=${encodeURIComponent(auctionId)}`)
                const data = await res.json()
                if (res.ok && data?.frozen) {
                    setFreezeNotice({ remaining: Number(data?.remaining_seconds ?? 0) })
                    return
                }
            } catch {
                // network hiccup — fall through and let the table decide
            }
        }
        // COPY FRUIT flow: no target to pick on the table — the picker modal
        // opens here instead. Stays on this page; nothing is consumed until a
        // copy actually commits.
        if (fruit.id === 'copy') {
            setCopyOpen(true)
            return
        }
        // CLONE FRUIT flow: also an on-page picker (a carousel of fruits you
        // own). Stays on this page; nothing is consumed until a clone commits.
        if (fruit.id === 'clone') {
            setCloneOpen(true)
            return
        }
        // Back to the table with the fruit armed — the table drops straight into
        // "tap a player" targeting mode.
        router.push(`/auction/free-auction/${auctionId}?fruit=${fruit.id}`)
    }

    return (
        <PageLayout pageTitle="Ability Fruits" className="px-4 bg-[#f5f5f5]">
            <div className="mb-4 rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3">
                <p className="text-sm font-semibold text-purple-900">Testing phase</p>
                <p className="mt-0.5 text-xs text-purple-700">
                    All {ABILITY_FRUITS.length} ability fruits are unlocked, {TESTING_PHASE_FRUIT_COUNT} uses each.
                </p>
            </div>

            <div className="flex flex-col gap-4">
                {ABILITY_FRUITS.map((fruit) => {
                    const coolingFor = cooldowns[fruit.id] ?? 0
                    const usesLeft = availableUses(auctionId, usage, bonuses, fruit.id)
                    return (
                    <div
                        key={fruit.id}
                        className="flex gap-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
                    >
                        <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
                            <AbilityFruitOrb fruit={fruit} size={64} glow />
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                                x{usesLeft}
                            </span>
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <h2 className="truncate text-base font-bold text-gray-900">{fruit.name}</h2>
                                {!fruit.available && (
                                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                                        SOON
                                    </span>
                                )}
                                {fruit.available && coolingFor > 0 && (
                                    <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                                        COOLING {coolingFor}s
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-sm text-gray-500">{fruit.tagline}</p>

                            <div className="mt-3 flex gap-2">
                                <Button
                                    text={coolingFor > 0 ? `Activate · ${coolingFor}s` : 'Activate'}
                                    size="xs"
                                    classname="flex-1"
                                    onClick={() => void handleActivate(fruit)}
                                />
                                <Button
                                    text="Learn More"
                                    size="xs"
                                    bordered
                                    classname="flex-1"
                                    onClick={() => setLearnMore(fruit)}
                                />
                            </div>
                        </div>
                    </div>
                    )
                })}
            </div>

            <Modal isActive={!!learnMore} setIsActive={() => setLearnMore(null)}>
                {learnMore && (
                    <div className="flex flex-col items-center text-center">
                        <AbilityFruitOrb fruit={learnMore} size={96} glow className="mb-5" />
                        <h2 className="mb-2 text-xl font-bold text-gray-900">{learnMore.name}</h2>
                        <p className="mb-8 text-sm text-slate-500">{learnMore.description}</p>
                        <Button text="Close" classname="w-full py-3.5" onClick={() => setLearnMore(null)} />
                    </div>
                )}
            </Modal>

            <Modal isActive={!!comingSoon} setIsActive={() => setComingSoon(null)}>
                {comingSoon && (
                    <div className="flex flex-col items-center text-center">
                        <AbilityFruitOrb fruit={comingSoon} size={96} glow className="mb-5" />
                        <h2 className="mb-2 text-xl font-bold text-gray-900">{comingSoon.name}</h2>
                        <p className="mb-8 text-sm text-slate-500">
                            This fruit is not playable yet. It will be available in a future update.
                        </p>
                        <Button text="Got it" classname="w-full py-3.5" onClick={() => setComingSoon(null)} />
                    </div>
                )}
            </Modal>

            <Modal isActive={!!freezeNotice} setIsActive={() => setFreezeNotice(null)}>
                {freezeNotice && (
                    <div className="flex flex-col items-center text-center">
                        <AbilityFruitOrb fruit={getAbilityFruit('freeze') as AbilityFruit} size={96} glow className="mb-5" />
                        <h2 className="mb-2 text-xl font-bold text-gray-900">You are frozen</h2>
                        <p className="mb-8 text-sm text-slate-500">
                            You are currently frozen. Wait {Math.max(1, Math.ceil(freezeNotice.remaining))} seconds
                            for the effect of the Freeze Fruit to wear off — or use the Negate Fruit to break out now.
                        </p>
                        <Button text="Got it" classname="w-full py-3.5" onClick={() => setFreezeNotice(null)} />
                    </div>
                )}
            </Modal>

            <Modal isActive={!!cooldownNotice} setIsActive={() => setCooldownNotice(null)}>
                {cooldownNotice && (
                    <div className="flex flex-col items-center text-center">
                        <AbilityFruitOrb fruit={cooldownNotice} size={96} glow className="mb-5" />
                        <h2 className="mb-2 text-xl font-bold text-gray-900">Cooling down</h2>
                        <p className="mb-8 text-sm text-slate-500">
                            {cooldownNotice.name} was used very recently. Wait {Math.max(1, cooldowns[cooldownNotice.id] ?? 1)} seconds
                            before you can use it again.
                        </p>
                        <Button text="Got it" classname="w-full py-3.5" onClick={() => setCooldownNotice(null)} />
                    </div>
                )}
            </Modal>

            <CopyFruitModal
                isActive={copyOpen}
                onClose={() => setCopyOpen(false)}
                auctionId={auctionId}
                onCopied={(copiedId) => {
                    // Copy Fruit is consumed the moment the copy commits — a
                    // failed / abandoned attempt never reaches this callback.
                    recordFruitUse(auctionId, 'copy')
                    // …and the copied ability earns a bonus use above the
                    // testing-phase base (availableUses adds it back on).
                    grantFruitBonus(auctionId, copiedId as AbilityFruitId)
                }}
            />

            <CloneFruitModal
                isActive={cloneOpen}
                onClose={() => setCloneOpen(false)}
                auctionId={auctionId}
                onCloned={(clonedId) => {
                    // Clone Fruit is consumed the moment the clone commits — a
                    // failed / abandoned attempt never reaches this callback.
                    recordFruitUse(auctionId, 'clone')
                    // …and the cloned fruit earns 2 extra copies above the
                    // testing-phase base (master prompt: x1 becomes x3).
                    grantFruitBonus(auctionId, clonedId as AbilityFruitId, 2)
                }}
            />
        </PageLayout>
    )
}

export default AbilityFruitsPage
