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
const RELEASE_GRACE_MS = 800
const RESTART_DELAY_MS = 150
// Chrome's speech service sometimes never fires onstart (wedged instance);
// if the mic isn't live by then, discard it and spawn a fresh one.
const START_WATCHDOG_MS = 1200
const MAX_START_ATTEMPTS = 3

// Android Chrome ignores `continuous` and ends recognition after every
// utterance / silence gap, with slow startup and result delivery.
const isAndroid = () =>
    typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)

const FATAL_ERROR_MESSAGES: Record<string, string> = {
    'not-allowed': 'Allow mic access',
    'service-not-allowed': 'Voice service blocked',
    'audio-capture': 'No microphone found',
    'network': 'Network error',
}

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
    const [micReady, setMicReady] = useState(false)
    const [retryCount, setRetryCount] = useState(0)

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
    const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const recognitionActiveRef = useRef(false)
    const fatalErrorRef = useRef<string | null>(null)
    const processedRef = useRef(false)
    const finishingRef = useRef(false)
    const prevTranscriptRef = useRef('')
    const sessionFinalRef = useRef('')
    const graceExtendedRef = useRef(false)
    const sessionGenRef = useRef(0)
    const warmupRef = useRef<any>(null)

    const showError = useCallback((msg: string) => {
        setErrorText(msg)
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
        errorTimerRef.current = setTimeout(() => setErrorText(null), 2000)
    }, [])

    const cleanup = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }
        if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); errorTimerRef.current = null }
        if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null }
        if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
        if (watchdogTimerRef.current) { clearTimeout(watchdogTimerRef.current); watchdogTimerRef.current = null }
        if (recognitionRef.current) {
            const rec = recognitionRef.current
            recognitionRef.current = null
            try { rec.stop() } catch {}
        }
        recognitionActiveRef.current = false
        finishingRef.current = false
        setElapsed(0)
    }, [])

    useEffect(() => {
        return () => cleanup()
    }, [cleanup])

    // Warm up the speech service right after mount (only when mic permission
    // is already granted) so the first bid starts instantly instead of paying
    // the engine's cold-start latency.
    useEffect(() => {
        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) return

        let cancelled = false
        ;(async () => {
            try {
                const st = await (navigator as any).permissions?.query?.({ name: 'microphone' })
                if (st?.state !== 'granted') return
            } catch {
                return
            }
            if (cancelled || phaseRef.current !== 'idle') return
            try {
                const rec = new SpeechRecognition()
                warmupRef.current = rec
                rec.continuous = false
                rec.interimResults = false
                rec.lang = 'en-US'
                rec.start()
                setTimeout(() => {
                    try { rec.abort() } catch {}
                    if (warmupRef.current === rec) warmupRef.current = null
                }, 400)
            } catch {}
        })()

        return () => {
            cancelled = true
            try { warmupRef.current?.abort() } catch {}
            warmupRef.current = null
        }
    }, [])

    const processResult = useCallback((cancelled: boolean) => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }

        phaseRef.current = 'idle'
        setPhase('idle')
        setElapsed(0)

        if (cancelled) return

        const transcript = transcriptRef.current

        if (!transcript) {
            showError(fatalErrorRef.current ?? 'No speech')
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

    const finalize = useCallback((force = false) => {
        // Mic never actually started (slow Android init / permission prompt):
        // extend the wait once instead of instantly reporting "No speech"
        if (!force && !processedRef.current && finishingRef.current &&
            !recognitionActiveRef.current && !transcriptRef.current &&
            !graceExtendedRef.current) {
            graceExtendedRef.current = true
            graceTimerRef.current = setTimeout(() => {
                graceTimerRef.current = null
                finalize()
            }, RELEASE_GRACE_MS)
            return
        }
        if (processedRef.current) return
        processedRef.current = true
        finishingRef.current = false
        if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null }
        if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
        if (watchdogTimerRef.current) { clearTimeout(watchdogTimerRef.current); watchdogTimerRef.current = null }
        if (recognitionRef.current) {
            const rec = recognitionRef.current
            recognitionRef.current = null
            try { rec.stop() } catch {}
        }
        recognitionActiveRef.current = false
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        processResult(false)
    }, [processResult])

    const finishRecording = useCallback((cancelled: boolean) => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }

        if (cancelled) {
            processedRef.current = true
            finishingRef.current = false
            if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null }
            if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
            if (watchdogTimerRef.current) { clearTimeout(watchdogTimerRef.current); watchdogTimerRef.current = null }
            if (recognitionRef.current) {
                const rec = recognitionRef.current
                recognitionRef.current = null
                try { rec.stop() } catch {}
            }
            recognitionActiveRef.current = false
            phaseRef.current = 'idle'
            setPhase('idle')
            setElapsed(0)
            return
        }

        // Released: keep the recognizer alive briefly so Android can flush its
        // pending/final results before we stop it and read the transcript.
        finishingRef.current = true
        phaseRef.current = 'idle'
        setPhase('idle')
        setElapsed(0)

        graceTimerRef.current = setTimeout(() => {
            graceTimerRef.current = null
            finalize()
        }, RELEASE_GRACE_MS)
    }, [finalize])

    const startRecording = useCallback(async () => {
        if (disabled) return

        // Flush any previous session still in its grace window
        if (finishingRef.current || graceTimerRef.current || restartTimerRef.current || watchdogTimerRef.current) {
            finalize(true)
        }

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
        prevTranscriptRef.current = ''
        sessionFinalRef.current = ''
        fatalErrorRef.current = null
        processedRef.current = false
        finishingRef.current = false
        graceExtendedRef.current = false
        recognitionActiveRef.current = false
        setRetryCount(0)

        // Kill any pending warm-up session so it can't collide with the mic
        try { warmupRef.current?.abort() } catch {}
        warmupRef.current = null

        // Set phase immediately so UI responds
        phaseRef.current = 'recording'
        setPhase('recording')

        startTimeRef.current = Date.now()
        setElapsed(0)
        timerRef.current = setInterval(() => {
            setElapsed(Date.now() - startTimeRef.current)
        }, 100)

        let attempt = 0

        const teardownCurrent = () => {
            const rec = recognitionRef.current
            recognitionRef.current = null
            if (rec) { try { rec.abort() } catch {} }
        }

        const clearWatchdog = () => {
            if (watchdogTimerRef.current) { clearTimeout(watchdogTimerRef.current); watchdogTimerRef.current = null }
        }

        const giveUp = (msg: string) => {
            processedRef.current = true
            clearWatchdog()
            teardownCurrent()
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
            if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }
            phaseRef.current = 'idle'
            setPhase('idle')
            setElapsed(0)
            setMicReady(false)
            showError(msg)
        }

        const armWatchdog = (gen: number) => {
            clearWatchdog()
            watchdogTimerRef.current = setTimeout(() => {
                watchdogTimerRef.current = null
                if (gen !== sessionGenRef.current) return
                if (phaseRef.current !== 'recording' || processedRef.current) return
                if (recognitionActiveRef.current) return
                attempt++
                if (attempt >= MAX_START_ATTEMPTS) {
                    giveUp(fatalErrorRef.current ?? 'Voice unavailable')
                    return
                }
                setRetryCount(attempt)
                teardownCurrent()
                spawn()
            }, START_WATCHDOG_MS)
        }

        const spawn = () => {
            if (phaseRef.current !== 'recording' || processedRef.current) return

            // Generation token: aborted/stale instances fire events late; they
            // must never touch shared state or the live instance's watchdog.
            const gen = ++sessionGenRef.current

            const recognition = new SpeechRecognition()
            // Android Chrome misbehaves with continuous mode: it stops after each
            // utterance anyway and can deliver no results at all. Use single-shot
            // mode there and restart manually from onend.
            recognition.continuous = !isAndroid()
            recognition.interimResults = true
            recognition.lang = 'en-US'
            recognition.maxAlternatives = 1

            const isLive = () => gen === sessionGenRef.current

            const markLive = () => {
                if (!isLive()) return
                recognitionActiveRef.current = true
                setMicReady(true)
                clearWatchdog()
            }

            recognition.onstart = markLive
            recognition.onaudiostart = markLive

            recognition.onresult = (event: any) => {
                if (!isLive()) return
                markLive()

                let sessionFinal = ''
                let lastInterim = ''
                for (let i = 0; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        sessionFinal += event.results[i][0].transcript + ' '
                    } else {
                        lastInterim = event.results[i][0].transcript
                    }
                }
                sessionFinal = sessionFinal.trim()
                sessionFinalRef.current = sessionFinal

                const base = prevTranscriptRef.current ? prevTranscriptRef.current + ' ' : ''
                if (sessionFinal) {
                    transcriptRef.current = (base + sessionFinal).trim()
                } else if (lastInterim.trim()) {
                    transcriptRef.current = (base + lastInterim.trim()).trim()
                }

                // While waiting out the release window, a final result means we're done
                if (finishingRef.current && sessionFinal && graceTimerRef.current) {
                    clearTimeout(graceTimerRef.current)
                    graceTimerRef.current = setTimeout(() => {
                        graceTimerRef.current = null
                        finalize()
                    }, 100)
                }
            }

            recognition.onerror = (e: any) => {
                if (!isLive()) return
                if (e.error === 'no-speech' || e.error === 'aborted') return
                const msg = FATAL_ERROR_MESSAGES[e.error]
                if (msg) fatalErrorRef.current = msg
                console.warn('[voice] recognition error:', e.error)
            }

            recognition.onend = () => {
                if (!isLive()) return
                recognitionActiveRef.current = false
                clearWatchdog()

                // Ended during the post-release window: results are flushed, wrap up
                if (finishingRef.current) {
                    if (graceTimerRef.current) clearTimeout(graceTimerRef.current)
                    graceTimerRef.current = setTimeout(() => {
                        graceTimerRef.current = null
                        finalize()
                    }, 100)
                    return
                }

                if (phaseRef.current !== 'recording') return

                if (fatalErrorRef.current) {
                    const msg = fatalErrorRef.current
                    processedRef.current = true
                    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
                    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }
                    recognitionRef.current = null
                    phaseRef.current = 'idle'
                    setPhase('idle')
                    setElapsed(0)
                    setMicReady(false)
                    showError(msg)
                    return
                }

                if (Date.now() - startTimeRef.current >= MAX_RECORDING_MS - 500) {
                    finishRecording(false)
                    return
                }

                // Still holding: the engine ends the session after each utterance
                // or silence gap. Carry over what we heard and listen again.
                if (sessionFinalRef.current) {
                    prevTranscriptRef.current =
                        (prevTranscriptRef.current + ' ' + sessionFinalRef.current).trim()
                    sessionFinalRef.current = ''
                }

                if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
                restartTimerRef.current = setTimeout(() => {
                    restartTimerRef.current = null
                    if (phaseRef.current !== 'recording' || processedRef.current) return
                    attempt = 0
                    spawn()
                }, RESTART_DELAY_MS)
            }

            recognitionRef.current = recognition

            try {
                recognition.start()
            } catch {
                teardownCurrent()
                if (++attempt >= MAX_START_ATTEMPTS) {
                    giveUp('Voice failed')
                    return
                }
                if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
                restartTimerRef.current = setTimeout(() => {
                    restartTimerRef.current = null
                    spawn()
                }, RESTART_DELAY_MS)
                return
            }

            armWatchdog(gen)
        }

        spawn()

        // Auto-stop after max duration
        maxTimerRef.current = setTimeout(() => {
            maxTimerRef.current = null
            if (phaseRef.current === 'recording') finishRecording(false)
        }, MAX_RECORDING_MS)

        // If user released during startup, finish now
        if (releasedDuringStartupRef.current) {
            finishRecording(false)
        }
    }, [disabled, showError, finishRecording, finalize])

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
        // Ignore duplicate/late pointerups (e.g. during the release grace window)
        if (finishingRef.current) return
        // If recognition hasn't started yet, flag it and finishRecording will pick it up
        if (phaseRef.current === 'idle') {
            releasedDuringStartupRef.current = true
            return
        }
        if (phaseRef.current !== 'recording' && phaseRef.current !== 'cancelled') return

        pointerStartRef.current = null
        setMicReady(false)
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
                            {micReady ? timerText : retryCount > 0 ? 'Retrying mic…' : 'Starting…'}
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
