'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Mic } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

type VoiceAction = 'BID' | 'BUY'

interface VoiceBidButtonProps {
    onBid: (amount: number) => Promise<boolean>
    onBuy?: (amount: number) => void
    disabled?: boolean
}

const CANCEL_THRESHOLD_PX = 80
const MAX_RECORDING_MS = 10000

const WORD_NUMBERS: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
    eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
    million: 1000000, billion: 1000000000,
}

function wordsToNumber(text: string): number | null {
    const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean)
    let total = 0
    let current = 0
    let found = false

    for (const word of words) {
        const val = WORD_NUMBERS[word]
        if (val !== undefined) {
            found = true
            if (val >= 1000) {
                current = current === 0 ? 1 : current
                total += current * val
                current = 0
            } else if (val >= 100) {
                current = current === 0 ? 1 : current
                current *= val
            } else {
                current += val
            }
        }
    }
    total += current
    return found && total > 0 ? total : null
}

function parseTranscript(transcript: string): { action: VoiceAction; amount: number } | null {
    const cleaned = transcript.toLowerCase().replace(/[₦$,]/g, '').replace(/\s+/g, ' ').trim()

    const kMatch = cleaned.match(/(\d+)\s*k\b/)
    if (kMatch) {
        const amount = parseInt(kMatch[1], 10) * 1000
        const action = cleaned.match(/\b(buy|purchase)\b/) ? 'BUY' : 'BID'
        return { action, amount }
    }

    const digitMatch = cleaned.match(/(\d[\d,]*)/)
    if (digitMatch) {
        const amount = parseInt(digitMatch[1].replace(/,/g, ''), 10)
        if (amount > 0) {
            const action = cleaned.match(/\b(buy|purchase)\b/) ? 'BUY' : 'BID'
            return { action, amount }
        }
    }

    const wordAmount = wordsToNumber(cleaned)
    if (wordAmount !== null) {
        const action = cleaned.match(/\b(buy|purchase)\b/) ? 'BUY' : 'BID'
        return { action, amount: wordAmount }
    }

    return null
}

function vibrate(ms: number) {
    try { navigator.vibrate?.(ms) } catch {}
}

export default function VoiceBidButton({ onBid, onBuy, disabled }: VoiceBidButtonProps) {
    const [phase, setPhase] = useState<'idle' | 'recording' | 'cancelled'>('idle')
    const [elapsed, setElapsed] = useState(0)
    const [errorText, setErrorText] = useState<string | null>(null)

    // All mutable state tracked via refs to avoid stale closures
    const phaseRef = useRef<'idle' | 'recording' | 'cancelled'>('idle')
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
    const isCancelledRef = useRef(false)
    const recognitionRef = useRef<any>(null)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const startTimeRef = useRef(0)
    const transcriptRef = useRef('')
    const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const releasedDuringStartupRef = useRef(false)

    const showError = useCallback((msg: string) => {
        setErrorText(msg)
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
        errorTimerRef.current = setTimeout(() => setErrorText(null), 2000)
    }, [])

    const cleanup = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }
        if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); errorTimerRef.current = null }
        if (recognitionRef.current) {
            try { recognitionRef.current.stop() } catch {}
            recognitionRef.current = null
        }
        setElapsed(0)
    }, [])

    useEffect(() => {
        return () => cleanup()
    }, [cleanup])

    const processResult = useCallback((cancelled: boolean) => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }

        phaseRef.current = 'idle'
        setPhase('idle')
        setElapsed(0)

        if (cancelled) return

        const transcript = transcriptRef.current

        if (!transcript) {
            showError('No speech')
            return
        }

        const parsed = parseTranscript(transcript)

        if (!parsed) {
            showError('Try again')
            return
        }

        vibrate(30)

        if (parsed.action === 'BUY' && onBuy) {
            onBuy(parsed.amount)
        } else {
            onBid(parsed.amount)
        }
    }, [onBid, onBuy, showError])

    const finishRecording = useCallback((cancelled: boolean) => {
        if (cancelled) {
            // Cancelled: stop everything immediately
            if (recognitionRef.current) {
                try { recognitionRef.current.stop() } catch {}
                recognitionRef.current = null
            }
            processResult(true)
            return
        }

        // Not cancelled: keep recognition alive briefly to catch pending transcript
        // The onresult handler keeps writing to transcriptRef.current
        // After 800ms, process whatever we have
        phaseRef.current = 'idle'
        setPhase('idle')
        setElapsed(0)

        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }

        setTimeout(() => {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop() } catch {}
                recognitionRef.current = null
            }
            processResult(false)
        }, 800)
    }, [processResult])

    const startRecording = useCallback(async () => {
        if (disabled) return

        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

        if (!SpeechRecognition) {
            showError('Voice not supported')
            return
        }

        vibrate(50)
        isCancelledRef.current = false
        releasedDuringStartupRef.current = false
        transcriptRef.current = ''

        // Set phase immediately so UI responds
        phaseRef.current = 'recording'
        setPhase('recording')

        startTimeRef.current = Date.now()
        setElapsed(0)
        timerRef.current = setInterval(() => {
            setElapsed(Date.now() - startTimeRef.current)
        }, 100)

        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.maxAlternatives = 1

        recognition.onresult = (event: any) => {
            let final = ''
            let lastInterim = ''
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript + ' '
                } else {
                    lastInterim = event.results[i][0].transcript
                }
            }
            if (final.trim()) {
                transcriptRef.current = final.trim()
            } else if (lastInterim.trim()) {
                transcriptRef.current = lastInterim.trim()
            }
        }

        recognition.onerror = (e: any) => {
            if (e.error === 'no-speech' || e.error === 'aborted') return
            console.warn('[voice] recognition error:', e.error)
        }

        recognition.onend = () => {
            // If recognition ends naturally (silence timeout), process immediately
            if (phaseRef.current === 'recording') {
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
                if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }
                phaseRef.current = 'idle'
                setPhase('idle')
                setElapsed(0)
                processResult(false)
            }
        }

        recognitionRef.current = recognition

        try {
            recognition.start()
        } catch {
            showError('Voice failed')
            phaseRef.current = 'idle'
            setPhase('idle')
            setElapsed(0)
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
            return
        }

        // Auto-stop after max duration
        maxTimerRef.current = setTimeout(() => {
            finishRecording(false)
        }, MAX_RECORDING_MS)

        // If user released during startup, finish now
        if (releasedDuringStartupRef.current) {
            finishRecording(false)
        }
    }, [disabled, showError, finishRecording])

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (disabled || phaseRef.current === 'recording') return
        e.preventDefault()
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        pointerStartRef.current = { x: e.clientX, y: e.clientY }
        startRecording()
    }, [disabled, startRecording])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (phaseRef.current !== 'recording' || !pointerStartRef.current) return
        const dx = e.clientX - pointerStartRef.current.x
        const dy = e.clientY - pointerStartRef.current.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (dx < -CANCEL_THRESHOLD_PX || distance > CANCEL_THRESHOLD_PX) {
            isCancelledRef.current = true
            phaseRef.current = 'cancelled'
            setPhase('cancelled')
        }
    }, [])

    const handlePointerUp = useCallback(() => {
        // If recognition hasn't started yet, flag it and finishRecording will pick it up
        if (phaseRef.current === 'idle') {
            releasedDuringStartupRef.current = true
            return
        }
        if (phaseRef.current !== 'recording' && phaseRef.current !== 'cancelled') return

        pointerStartRef.current = null
        const cancelled = isCancelledRef.current
        finishRecording(cancelled)
    }, [finishRecording])

    const handlePointerUpEvent = useCallback((e: React.PointerEvent) => {
        handlePointerUp()
    }, [handlePointerUp])

    const elapsedSec = Math.floor(elapsed / 1000)
    const elapsedMs = Math.floor((elapsed % 1000) / 100)
    const timerText = `${elapsedSec}.${elapsedMs}s`

    const button = (
        <>
            <AnimatePresence>
                {(phase === 'recording' || phase === 'cancelled') && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/30"
                        onPointerUp={handlePointerUpEvent}
                        onPointerMove={handlePointerMove}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {phase === 'recording' && (
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3"
                    >
                        <div className="bg-black/70 text-white text-sm font-mono font-bold px-4 py-1.5 rounded-full">
                            {timerText}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {phase === 'recording' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="fixed bottom-44 left-1/2 -translate-x-1/2 z-50 text-white/50 text-xs font-medium"
                    >
                        Slide left to cancel
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {phase === 'cancelled' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white/70 text-sm font-medium px-5 py-2.5 rounded-full"
                    >
                        Release to cancel
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {errorText && (
                    <motion.div
                        key={errorText}
                        initial={{ opacity: 0, y: 6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.25 }}
                        className="fixed bottom-22 right-4 z-50 bg-red-500/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md pointer-events-none"
                    >
                        {errorText}
                    </motion.div>
                )}
            </AnimatePresence>

            <button
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUpEvent}
                onPointerMove={handlePointerMove}
                onPointerCancel={() => { if (phaseRef.current === 'recording') { isCancelledRef.current = true; finishRecording(true) } }}
                disabled={disabled}
                className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-black text-white shadow-lg flex items-center justify-center select-none touch-none transition-transform duration-150 disabled:opacity-40 active:scale-95"
                aria-label="Hold to speak a bid"
            >
                <Mic className="size-6" />
            </button>
        </>
    )

    return createPortal(button, document.body)
}
