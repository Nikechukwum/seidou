'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Mic, Check } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'

type Phase = 'idle' | 'listening' | 'sending' | 'error'

interface VoiceBidButtonProps {
    onBid: (amount: number) => Promise<boolean>
    onBuy?: (amount: number) => void
    // Fire the optimistic UI (balance drop, leaderboard bump, "Bid Placed" toast)
    // the instant we parse an amount. Do NOT wait for the server.
    onOptimisticBid?: (amount: number) => void
    // Optional: called if the user slides left within the post-send cancel window
    onCancelBid?: () => void
    disabled?: boolean
    lang?: string
    // Render the mic inline without viewport positioning (caller provides the
    // container, e.g. a fixed footer). Floating status labels stay viewport-anchored.
    renderInline?: boolean
    // Pure safety ceiling for a stuck finger. Release-to-send is what makes the
    // action fast; this only prevents an infinite hold. (Spec suggested 1300ms,
    // but that would force-send while longer phrases are still being spoken.)
    maxHoldMs?: number
}

const SLIDE_CANCEL_PX = 70
const POST_SEND_CANCEL_MS = 4000
const CHECK_MARK_MS = 200
const ERROR_MS = 2000
const TRANSCRIBE_TIMEOUT_MS = 8000

const isAndroid = () =>
    typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent)

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

function digitsToNumber(digits: string): number {
    return parseFloat(digits.replace(/,/g, '.'))
}

function tryNumber(text: string): number | null {
    const t = text.toLowerCase()

    // "bid 3k" / "3k" / "3.5k" / "1,5k" -> x1000
    const kMatch = t.match(/(\d+(?:[.,]\d+)?)\s*k\b/)
    if (kMatch) {
        const n = digitsToNumber(kMatch[1])
        if (n > 0) return Math.round(n * 1000)
    }

    // "3 thousand" / "2 hundred" / "1.5 million" -> digit + unit word
    const unitMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(hundred|thousand|million|billion)\b/)
    if (unitMatch) {
        const n = digitsToNumber(unitMatch[1])
        const mul = { hundred: 100, thousand: 1000, million: 1000000, billion: 1000000000 }[unitMatch[2]]
        const total = Math.round(n * mul!)
        if (total > 0) return total
    }

    // plain digits: "100", "3,000"
    const digitMatch = t.match(/(\d[\d,]*)/)
    if (digitMatch) {
        const n = parseInt(digitMatch[1].replace(/,/g, ''), 10)
        if (n > 0) return n
    }

    // word form: "three thousand", "one hundred", "hundred"
    return wordsToNumber(t)
}

interface Parsed {
    action: 'BID' | 'BUY'
    amount: number
}

function parseTranscript(transcript: string): Parsed | null {
    const cleaned = transcript.toLowerCase().replace(/[₦$]/g, '').replace(/\s+/g, ' ').trim()
    if (!cleaned) return null

    const amount = tryNumber(cleaned)
    if (amount === null) return null

    const action = /\b(buy|purchase)\b/.test(cleaned) ? 'BUY' : 'BID'
    return { action, amount }
}

function vibrate(pattern: number | number[]) {
    try { navigator.vibrate?.(pattern) } catch {}
}

function pickRecorderMime(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
    for (const candidate of candidates) {
        try {
            if (MediaRecorder.isTypeSupported(candidate)) return candidate
        } catch {}
    }
    return ''
}

function extForMime(mime: string): string {
    if (mime.includes('webm')) return 'webm'
    if (mime.includes('ogg')) return 'ogg'
    if (mime.includes('mp4')) return 'm4a'
    return 'webm'
}

export default function VoiceBidButton({
    onBid,
    onBuy,
    onOptimisticBid,
    onCancelBid,
    disabled,
    lang = 'en-US',
    renderInline = false,
    maxHoldMs = 4000,
}: VoiceBidButtonProps) {
    const [phase, setPhase] = useState<Phase>('idle')
    const [label, setLabel] = useState<string | null>(null)

    const phaseRef = useRef<Phase>('idle')
    const startTsRef = useRef(0)
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
    const genRef = useRef(0)

    // --- Native Web Speech engine ---
    const recognitionRef = useRef<any>(null)
    const lastTranscriptRef = useRef('')
    const prevFinalsRef = useRef('')
    const sessionFinalRef = useRef('')
    const srLiveRef = useRef(false)
    const nativeRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // --- Recorded-audio fallback (MediaRecorder -> /api/voice/transcribe) ---
    const recorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const chunksRef = useRef<Blob[]>([])

    const maxHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const cancelWindowRef = useRef(false)
    const cancelWindowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const cancelFiredRef = useRef(false)

    const showError = useCallback((msg: string) => {
        phaseRef.current = 'error'
        setPhase('error')
        setLabel(msg)
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
        errorTimerRef.current = setTimeout(() => {
            phaseRef.current = 'idle'
            setPhase('idle')
            setLabel(null)
        }, ERROR_MS)
    }, [])

    const clearTimers = useCallback(() => {
        if (maxHoldTimerRef.current) { clearTimeout(maxHoldTimerRef.current); maxHoldTimerRef.current = null }
        if (nativeRestartTimerRef.current) { clearTimeout(nativeRestartTimerRef.current); nativeRestartTimerRef.current = null }
        if (checkTimerRef.current) { clearTimeout(checkTimerRef.current); checkTimerRef.current = null }
        if (errorTimerRef.current) { clearTimeout(errorTimerRef.current); errorTimerRef.current = null }
        if (cancelWindowTimerRef.current) { clearTimeout(cancelWindowTimerRef.current); cancelWindowTimerRef.current = null }
    }, [])

    // stopNative: on iOS Safari, stop() leaves the recognizer's session/audio
    // holding the mic with the speech service, which can lag, swallow results,
    // or make the NEXT start() throw InvalidStateError. abort() hard-cancels and
    // frees everything immediately so a fast press-release-press works cleanly.
    // Safe to call on every browser.
    const stopNative = useCallback(() => {
        const rec = recognitionRef.current
        recognitionRef.current = null
        if (!rec) return
        try { rec.stop() } catch {}
        try { rec.abort() } catch {}
    }, [])

    const stopRecorder = useCallback(() => {
        const rec = recorderRef.current
        const stream = streamRef.current
        recorderRef.current = null
        streamRef.current = null
        if (rec && rec.state !== 'inactive') {
            try { rec.stop() } catch {}
        }
        if (stream) {
            stream.getTracks().forEach((t) => { try { t.stop() } catch {} })
        }
    }, [])

    const teardownAll = useCallback(() => {
        clearTimers()
        stopNative()
        stopRecorder()
    }, [clearTimers, stopNative, stopRecorder])

    useEffect(() => {
        return () => teardownAll()
    }, [teardownAll])

    const placeBid = useCallback((parsed: Parsed, gen: number) => {
        if (phaseRef.current !== 'listening') return
        phaseRef.current = 'sending'
        setPhase('sending')
        setLabel(null)
        vibrate(30)

        // Optimistic UI FIRST, server call after. Page owns balance/leaderboard.
        onOptimisticBid?.(parsed.amount)
        void onBid(parsed.amount)

        if (parsed.action === 'BUY' && onBuy) {
            onBuy(parsed.amount)
        }

        // Post-send "slide left to cancel" window
        cancelWindowRef.current = true
        cancelFiredRef.current = false
        if (cancelWindowTimerRef.current) clearTimeout(cancelWindowTimerRef.current)
        cancelWindowTimerRef.current = setTimeout(() => {
            cancelWindowRef.current = false
        }, POST_SEND_CANCEL_MS)

        // Green check for 200ms, then idle (hand control back to held mic state)
        if (checkTimerRef.current) clearTimeout(checkTimerRef.current)
        checkTimerRef.current = setTimeout(() => {
            if (phaseRef.current === 'sending') {
                phaseRef.current = 'idle'
                setPhase('idle')
            }
        }, CHECK_MARK_MS)
    }, [onBid, onBuy, onOptimisticBid])

    const transcribe = useCallback(async (blob: Blob, gen: number) => {
        phaseRef.current = 'listening'
        setPhase('listening')
        setLabel('Checking…')

        if (!blob.size) {
            showError('No speech')
            return
        }

        try {
            const form = new FormData()
            form.append('audio', blob, `speech.${extForMime(blob.type)}`)
            const ctrl = new AbortController()
            const timeout = setTimeout(() => ctrl.abort(), TRANSCRIBE_TIMEOUT_MS)
            const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form, signal: ctrl.signal })
            clearTimeout(timeout)

            if (gen !== genRef.current) return

            const data = await res.json().catch(() => ({}))
            if (!res.ok) {
                showError(res.status === 503 ? 'Setup missing' : 'No speech')
                return
            }

            const text = String(data.text ?? '').trim()
            lastTranscriptRef.current = text
            const parsed = parseTranscript(text)
            if (!parsed) {
                showError(text ? 'Try again' : 'No speech')
                return
            }
            placeBid(parsed, gen)
        } catch {
            if (gen !== genRef.current) return
            showError('Network error')
        }
    }, [placeBid, showError])

    // ==== Recording path: capture audio from t=0 so even a dead native engine
    // never loses your speech. ====
    const startRecorder = useCallback((gen: number) => {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            return
        }
        navigator.mediaDevices
            .getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
            .then((stream) => {
                if (gen !== genRef.current || phaseRef.current !== 'listening') {
                    stream.getTracks().forEach((t) => { try { t.stop() } catch {} })
                    return
                }
                const mime = pickRecorderMime()
                let recorder: MediaRecorder
                try {
                    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
                } catch {
                    stream.getTracks().forEach((t) => { try { t.stop() } catch {} })
                    return
                }
                chunksRef.current = []
                recorder.ondataavailable = (e: any) => {
                    if (gen === genRef.current && e.data && e.data.size > 0) chunksRef.current.push(e.data)
                }
                recorder.onstop = () => {
                    if (gen !== genRef.current) return
                    const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || 'audio/webm' })
                    stopRecorder()
                    void transcribe(blob, gen)
                }
                recorderRef.current = recorder
                streamRef.current = stream
                try { recorder.start(200) } catch {
                    stopRecorder()
                }
            })
            .catch(() => {})
    }, [stopRecorder, transcribe])

    const startNative = useCallback((gen: number) => {
        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) return

        const rec = new SpeechRecognition()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = lang
        rec.maxAlternatives = 1

        rec.onstart = () => { if (gen === genRef.current) { srLiveRef.current = true } }
        rec.onaudiostart = () => { if (gen === genRef.current) { srLiveRef.current = true } }

        rec.onresult = (event: any) => {
            if (gen !== genRef.current) return
            srLiveRef.current = true

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

            const base = prevFinalsRef.current ? prevFinalsRef.current + ' ' : ''
            lastTranscriptRef.current = (base + (sessionFinal || lastInterim)).trim()
        }

        rec.onerror = (e: any) => {
            if (gen !== genRef.current) return
            // A dead/failing engine is fine — the recorder has the audio.
            console.warn('[voice] native error:', e.error)
        }

        rec.onend = () => {
            if (gen !== genRef.current) return
            // Engine ended the session on its own (typical on Android, where the
            // recognizer stops after an utterance even with continuous=true).
            // Carry the last finals and re-open it if the user is still holding.
            if (phaseRef.current !== 'listening') return
            if (sessionFinalRef.current) {
                prevFinalsRef.current = (prevFinalsRef.current + ' ' + sessionFinalRef.current).trim()
                sessionFinalRef.current = ''
            }
            if (Date.now() - startTsRef.current >= maxHoldMs - 200) return
            if (nativeRestartTimerRef.current) clearTimeout(nativeRestartTimerRef.current)
            nativeRestartTimerRef.current = setTimeout(() => {
                nativeRestartTimerRef.current = null
                if (gen !== genRef.current || phaseRef.current !== 'listening') return
                startNative(gen)
            }, 120)
        }

        recognitionRef.current = rec
        try {
            rec.start()
        } catch {
            recognitionRef.current = null
        }
    }, [lang, maxHoldMs])

    const release = useCallback(() => {
        if (phaseRef.current !== 'listening') return

        if (maxHoldTimerRef.current) { clearTimeout(maxHoldTimerRef.current); maxHoldTimerRef.current = null }
        if (nativeRestartTimerRef.current) { clearTimeout(nativeRestartTimerRef.current); nativeRestartTimerRef.current = null }

        // The GRACE notes: take the latest transcript NOW and try to send
        // immediately. Do not wait for onend.
        const transcript = lastTranscriptRef.current
        const parsed = parseTranscript(transcript)
        if (parsed) {
            const gen = genRef.current
            stopNative()
            stopRecorder()
            placeBid(parsed, gen)
            return
        }

        // No usable native result. If the recorder has audio from this hold,
        // stop it and transcribe (the reliable path for broken-engine devices).
        if (recorderRef.current && recorderRef.current.state === 'recording') {
            stopNative()
            try { recorderRef.current.stop() } catch {}
            return // recorder.onstop will transcribe for this gen
        }

        // Neither source produced anything.
        const gen = genRef.current
        stopNative()
        stopRecorder()
        showError('No speech')
    }, [placeBid, showError, stopNative, stopRecorder])

    const handleDown = useCallback((e: React.PointerEvent | React.TouchEvent) => {
        if (disabled || phaseRef.current !== 'idle') return
        e.preventDefault()

        let x = 0, y = 0
        if ('clientX' in e) {
            x = e.clientX; y = e.clientY
        } else if (e.touches && e.touches[0]) {
            x = e.touches[0].clientX; y = e.touches[0].clientY
        }
        pointerStartRef.current = { x, y }

        phaseRef.current = 'listening'
        setPhase('listening')
        setLabel('Listening…')
        vibrate(20)

        const gen = ++genRef.current
        lastTranscriptRef.current = ''
        prevFinalsRef.current = ''
        sessionFinalRef.current = ''
        srLiveRef.current = false
        cancelWindowRef.current = false
        cancelFiredRef.current = false
        startTsRef.current = Date.now()

        // Run both in parallel: native engine (instant results where it works)
        // and the recorder (guaranteed capture where it doesn't).
        startRecorder(gen)
        startNative(gen)

        if (maxHoldTimerRef.current) clearTimeout(maxHoldTimerRef.current)
        maxHoldTimerRef.current = setTimeout(() => {
            maxHoldTimerRef.current = null
            if (phaseRef.current === 'listening') release()
        }, maxHoldMs)
    }, [disabled, maxHoldMs, release, startNative, startRecorder])

    const handleMove = useCallback((e: React.PointerEvent | React.TouchEvent) => {
        if (phaseRef.current !== 'listening' && phaseRef.current !== 'sending') return
        if (!pointerStartRef.current) return

        let x = 0, y = 0
        if ('clientX' in e) {
            x = e.clientX; y = e.clientY
        } else if (e.touches && e.touches[0]) {
            x = e.touches[0].clientX; y = e.touches[0].clientY
        }
        const dx = x - pointerStartRef.current.x
        const dy = y - pointerStartRef.current.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dx < -SLIDE_CANCEL_PX || dist > SLIDE_CANCEL_PX * 1.5) {
            if (phaseRef.current === 'listening') {
                // Slide-left while holding = abort, don't send anything.
                phaseRef.current = 'idle'
                setPhase('idle')
                setLabel(null)
                pointerStartRef.current = null
                const gen = ++genRef.current // invalidate everything
                stopNative()
                stopRecorder()
                vibrate(10)
            } else if (phaseRef.current === 'sending' && cancelWindowRef.current && !cancelFiredRef.current) {
                // Slide-left within the post-send cancel window = undo the bid
                cancelFiredRef.current = true
                cancelWindowRef.current = false
                void onCancelBid?.()
                vibrate(10)
            }
        }
    }, [onCancelBid, stopNative, stopRecorder])

    const handleUp = useCallback((_e: React.PointerEvent | React.TouchEvent) => {
        pointerStartRef.current = null

        if (phaseRef.current === 'listening') {
            release()
            return
        }
        if (phaseRef.current === 'sending') {
            return // keep showing the green check until the 200ms timer flips it
        }
        if (phaseRef.current === 'error') {
            return
        }
    }, [release])

    const overlays = (
        <>
            <AnimatePresence>
                {(phase === 'listening') && (
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2"
                    >
                        <div className="bg-black/80 text-white text-sm font-bold px-4 py-1.5 rounded-full animate-pulse">
                            {label ?? 'Listening…'}
                        </div>
                        <div className="text-white/50 text-[11px] font-medium">Slide left to cancel</div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {phase === 'sending' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2"
                    >
                        <div className="bg-green-500 text-white text-sm font-bold px-4 py-1.5 rounded-full">
                            Bid placed ✓
                        </div>
                        <div className="text-white/50 text-[11px] font-medium">Slide left to cancel</div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {phase === 'error' && label && (
                    <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white text-xs font-semibold px-4 py-1.5 rounded-full"
                    >
                        {label}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )

    const button = (
        <>
            <button
                onPointerDown={handleDown}
                onPointerMove={handleMove}
                onPointerUp={handleUp}
                onPointerCancel={handleUp}
                onTouchStart={!(window as any).PointerEvent ? handleDown : undefined}
                onTouchMove={!(window as any).PointerEvent ? handleMove : undefined}
                onTouchEnd={!(window as any).PointerEvent ? handleUp : undefined}
                onTouchCancel={!(window as any).PointerEvent ? handleUp : undefined}
                disabled={disabled}
                className={`size-14 rounded-full flex items-center justify-center select-none touch-none transition-transform duration-150 disabled:opacity-40 ${
                    disabled
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : phase === 'listening'
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 active:scale-95 animate-pulse'
                            : phase === 'sending'
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/40'
                                : 'bg-gray-900 text-white shadow-lg active:scale-95'
                } ${renderInline ? '' : 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50'}`}
                aria-label="Hold to speak a bid"
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={phase === 'sending' ? 'check' : 'mic'}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        transition={{ duration: 0.1 }}
                    >
                        {phase === 'sending' ? <Check className="size-6" /> : <Mic className="size-6" />}
                    </motion.span>
                </AnimatePresence>
            </button>
        </>
    )

    return renderInline ? (
        <>
            {createPortal(overlays, document.body)}
            {button}
        </>
    ) : createPortal(
        <>
            {overlays}
            {button}
        </>,
        document.body,
    )
}