'use client'

// Ability fruit INTERACTION — the REACT picker.
// ----------------------------------------------------------------------------
// Shown when a pending interaction targets ME: the fruit that is coming for
// me, a live countdown of the 5s reaction window, and the two defensive
// fruits I can hold up — SHIELD (block my share) or MIRROR (block AND throw
// it back at the caster). Only one reaction per interaction and only while
// the window is open; the server enforces both, the page surfaces failures
// as toasts.
// ============================================================================

import { Modal } from '@/components/Modal'
import Image from 'next/image'
import {
    AbilityInteraction,
    effectFruitId,
    effectLabel,
    windowRemainingSeconds,
} from '@/lib/abilityInteractions'
import { getAbilityFruit } from '@/lib/abilityFruits'

type Props = {
    interaction: AbilityInteraction | null
    serverNowMs: number
    responding: boolean
    myUserId: string | null
    cooldowns?: Partial<Record<'shield' | 'mirror', number>>
    onRespond: (interactionId: number, fruitId: 'shield' | 'mirror') => void
    onDismiss: () => void
}

export default function ReactFruitPicker({
    interaction,
    serverNowMs,
    responding,
    myUserId,
    cooldowns = {},
    onRespond,
    onDismiss,
}: Props) {
    const fruit = interaction ? getAbilityFruit(effectFruitId(interaction.effect_type)!) : undefined
    const seconds = interaction ? windowRemainingSeconds(interaction, serverNowMs) : 0

    const iAlreadyBlocked = !!interaction && !!myUserId && (interaction.blocked_by ?? []).includes(myUserId)
    const iAlreadyMirrored = !!interaction && !!myUserId && (interaction.reflected_by ?? []).includes(myUserId)

    return (
        <Modal isActive={interaction !== null} setIsActive={(v) => { if (!v && !responding) onDismiss() }}>
            {interaction && (
                <div className="flex flex-col items-center text-center">
                    <div className="relative mb-4">
                        <div className="size-16 rounded-full bg-red-50 flex items-center justify-center">
                            {fruit && (
                                <Image
                                    src={fruit.image}
                                    alt=""
                                    width={44}
                                    height={44}
                                    sizes="44px"
                                    className="size-11 object-contain"
                                />
                            )}
                        </div>
                        {/* live reaction-window ring */}
                        <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-60" />
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 mb-1">Incoming fruit!</h2>
                    <p className="text-sm text-slate-500 mb-1">
                        <span className="font-semibold text-gray-800">{effectLabel(interaction.effect_type)}</span>
                        {' '}is targeting you — it lands in
                    </p>
                    <p className="text-3xl font-extrabold text-red-500 mb-6">{seconds}s</p>

                    <p className="text-xs text-slate-400 mb-5">
                        Hold up the Shield to block your share, or the Mirror to throw the fruit straight back at its caster.
                    </p>

                    <div className="flex w-full gap-3">
                        <button
                            onClick={() => onRespond(interaction.id, 'shield')}
                            disabled={responding || iAlreadyBlocked || seconds <= 0}
                            className="flex-1 rounded-full bg-black py-3.5 text-sm font-bold text-white active:bg-black/70 duration-100 disabled:opacity-40"
                        >
                            {iAlreadyBlocked ? 'Blocked' : 'Shield · Block'}
                            {!!cooldowns.shield && !iAlreadyBlocked ? ` (${cooldowns.shield}s)` : ''}
                        </button>
                        <button
                            onClick={() => onRespond(interaction.id, 'mirror')}
                            disabled={responding || iAlreadyMirrored || seconds <= 0}
                            className="flex-1 rounded-full bg-black py-3.5 text-sm font-bold text-white active:bg-black/70 duration-100 disabled:opacity-40"
                        >
                            {iAlreadyMirrored ? 'Reflected' : 'Mirror · Reflect'}
                            {!!cooldowns.mirror && !iAlreadyMirrored ? ` (${cooldowns.mirror}s)` : ''}
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    )
}