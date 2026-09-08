'use client'

// ============================================================================
// ABILITY FRUITS PAGE
// ----------------------------------------------------------------------------
// BIG SIS REQUEST: tapping the "Ability Fruits" tab on the table — or saying
// "activate ability fruit" while in voice mode — lands here FIRST. The player
// picks a fruit here, then Activate takes them back to the table to choose a
// target.
//
// Testing phase: every user holds all 10 fruits, 10 uses each.
// ============================================================================

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageLayout } from '@/components/PageLayout'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/Button'
import AbilityFruitOrb from '@/components/AbilityFruitOrb'
import { ABILITY_FRUITS, AbilityFruit, TESTING_PHASE_FRUIT_COUNT } from '@/lib/abilityFruits'

const AbilityFruitsPage = () => {
    const params = useParams()
    const auctionId = params.id as string
    const router = useRouter()

    const [learnMore, setLearnMore] = useState<AbilityFruit | null>(null)
    const [comingSoon, setComingSoon] = useState<AbilityFruit | null>(null)

    const handleActivate = (fruit: AbilityFruit) => {
        if (!fruit.available) {
            setComingSoon(fruit)
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
                {ABILITY_FRUITS.map((fruit) => (
                    <div
                        key={fruit.id}
                        className="flex gap-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-sm"
                    >
                        <div className="flex shrink-0 flex-col items-center gap-2 pt-1">
                            <AbilityFruitOrb fruit={fruit} size={64} glow />
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-600">
                                x{TESTING_PHASE_FRUIT_COUNT}
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
                            </div>
                            <p className="mt-1 text-sm text-gray-500">{fruit.tagline}</p>

                            <div className="mt-3 flex gap-2">
                                <Button
                                    text="Activate"
                                    size="xs"
                                    classname="flex-1"
                                    onClick={() => handleActivate(fruit)}
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
                ))}
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
        </PageLayout>
    )
}

export default AbilityFruitsPage
