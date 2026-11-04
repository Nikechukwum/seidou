'use client'

import { useEffect } from 'react'
import { playTapSound, preloadSounds, unlockSounds } from '@/utils/sound'

// Further than this between press and release is a drag, not a tap.
const MAX_TAP_MOVE_PX = 10

// Preloads the sounds and plays the tap sound on every tap in the app. Listening
// once on the document means every button, link, row and tab is covered without
// wiring each one. Browsers do not send a click after a touch scroll, and the
// distance check below filters out mouse drags and slider drags.
export function SoundEffects() {
    useEffect(() => {
        preloadSounds()

        let pressX = 0
        let pressY = 0
        const handlePointerDown = (e: PointerEvent) => {
            pressX = e.clientX
            pressY = e.clientY
        }
        const handleClick = (e: MouseEvent) => {
            if (!e.isTrusted) return
            // Keyboard clicks report no position, so only real pointers are measured
            const moved = e.detail > 0 && Math.hypot(e.clientX - pressX, e.clientY - pressY) > MAX_TAP_MOVE_PX
            if (!moved) playTapSound()
        }

        // Capture phase, so a stopPropagation inside a page can't swallow the sound
        document.addEventListener('pointerdown', handlePointerDown, true)
        document.addEventListener('pointerup', unlockSounds, true)
        document.addEventListener('keydown', unlockSounds, true)
        document.addEventListener('click', handleClick, true)
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown, true)
            document.removeEventListener('pointerup', unlockSounds, true)
            document.removeEventListener('keydown', unlockSounds, true)
            document.removeEventListener('click', handleClick, true)
        }
    }, [])

    return null
}
