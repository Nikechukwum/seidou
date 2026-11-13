// Game sound effects. Everything plays through one shared Web Audio context
// rather than <audio> tags: the decoded buffers start with no delay, the same
// sound can overlap itself on fast taps, and once a tap has unlocked the
// context, sounds that follow a server response or a realtime update still play.

const SOUND_URLS = {
    tap: '/sounds/ui-tap.wav',
    bidIncrease: '/sounds/bid-increase.wav',
    slideUp: '/sounds/slide-up.wav',
    slideDown: '/sounds/slide-down.wav',
    // Ability fruit lifecycle: introduction -> growth -> manifestation.
    abilityIntro: '/sounds/ability-intro-v2.wav',
    // 2s, the same length as the growth phase.
    abilityGrowth: '/sounds/ability-growth-2s.wav',
    multiplyManifest: '/sounds/multiply-manifestation.wav',
} as const

type SoundName = keyof typeof SOUND_URLS

// A sound asked for while the context is still locked plays only if the unlock
// follows straight away, so it can never go off late on the player's next tap.
const MAX_UNLOCK_WAIT_MS = 300

let context: AudioContext | null = null
const buffers = new Map<SoundName, AudioBuffer>()

function getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!context) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
        if (!AudioCtx) return null
        context = new AudioCtx() as AudioContext
    }
    return context
}

export function preloadSounds() {
    const ctx = getContext()
    if (!ctx) return
    for (const [name, url] of Object.entries(SOUND_URLS) as [SoundName, string][]) {
        if (buffers.has(name)) continue
        fetch(url)
            .then((res) => res.arrayBuffer())
            .then((data) => ctx.decodeAudioData(data))
            .then((buffer) => buffers.set(name, buffer))
            .catch(() => {
                // a missing sound must never break the page
            })
    }
}

// Browsers keep audio locked until a user gesture, so this runs on every tap.
export function unlockSounds() {
    const ctx = getContext()
    if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {})
}

function play(name: SoundName) {
    const ctx = getContext()
    const buffer = buffers.get(name)
    if (!ctx || !buffer) return

    const start = () => {
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.connect(ctx.destination)
        source.start()
    }

    if (ctx.state === 'running') {
        start()
        return
    }
    const requestedAt = Date.now()
    ctx.resume()
        .then(() => {
            if (Date.now() - requestedAt < MAX_UNLOCK_WAIT_MS) start()
        })
        .catch(() => {})
}

export const playTapSound = () => play('tap')
export const playBidIncreaseSound = () => play('bidIncrease')
export const playSlideUp = () => play('slideUp')
export const playSlideDown = () => play('slideDown')
export const playAbilityIntroSound = () => play('abilityIntro')
export const playAbilityGrowthSound = () => play('abilityGrowth')
export const playMultiplyManifestSound = () => play('multiplyManifest')
