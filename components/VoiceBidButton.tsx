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
// Web Speech grace window after release before we stop and read the transcript
const RELEASE_GRACE_MS = 800
// If the native engine shows no sign of life by then, hand off to
// MediaRecorder + server transcription mid-hold (Chrome Android's engine
// is dead on many devices; Edge/iOS bundle their own and start in ~300ms).
const FALLBACK_HANDOFF_MS = 900
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

function parseTranscript(transcript: string): { action: VoiceAction; amount: number } | null {
    const cleaned = transcript.toLowerCase().replace(/[₦$,]/g, '').replace(/\s+/g, ' ').trim()

    const kMatch = cleaned.match(/(\d+(?:[.,]\d+)?)\s*k\b/)
    if (kMatch) {
        const amount = Math.round(parseFloat(kMatch[1].replace(',', '.')) * 1000)
        const action = cleaned.match(/\b(buy|purchase)\b/) ? 'BUY' : 'BID'
        if (amount > 0) return { action, amount }
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

function pickRecorderMime(): string | null {
    if (typeof MediaRecorder === 'undefined') return null
    const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4']
    for (const candidate of candidates) {
        try {
            if (MediaRecorder.isTypeSupported(candidate)) return candidate
        } catch {}
    }
    return null
}

function extForMime(mime: string): string {
    if (mime.includes('webm')) return 'webm'
    if (mime.includes('ogg')) return 'ogg'
    if (mime.includes('mp4')) return 'm4a'
    return 'webm'
}

export default function VoiceBidButton({ onBid, onBuy, disabled }: VoiceBidButtonProps) {
    const [phase, setPhase] = useState<'idle' | 'recording' | 'cancelled'>('idle')
    const [elapsed, setElapsed] = useState(0)
    const [errorText, setErrorText] = useState<string | null>(null)
    const [micReady, setMicReady] = useState(false)
    const [processing, setProcessing] = useState(false)

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
    const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const recognitionActiveRef = useRef(false)
    const processedRef = useRef(false)
    const finishingRef = useRef(false)
    const prevTranscriptRef = useRef('')
    const sessionFinalRef = useRef('')
    const graceExtendedRef = useRef(false)
    const sessionGenRef = useRef(0)
    const warmupRef = useRef<any>(null)
    // Recorded-audio fallback (MediaRecorder -> /api/voice/transcribe)
    const usingFallbackRef = useRef(false)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const chunksRef = useRef<Blob[]>([])
    const pendingReleaseRef = useRef(false)

    const showError = useCallback((msg: string) => {
        setErrorText(msg)
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
        errorTimerRef.current = setTimeout(() => setErrorText(null), 2000)
    }, [])

    const teardownCurrentRecognition = () => {
        if (recognitionRef.current) {
            const rec = recognitionRef.current
            recognitionRef.current = null
            try { rec.abort() } catch {}
        }
    }

    const teardownMedia = useCallback(() => {
        if (mediaRecorderRef.current) {
            const rec = mediaRecorderRef.current
            mediaRecorderRef.current = null
            try { if (rec.state !== 'inactive') rec.stop() } catch {}
        }
        if (mediaStreamRef.current) {
            const stream = mediaStreamRef.current
            mediaStreamRef.current = null
            stream.getTracks().forEach((t) => { try { t.stop() } catch {} })
        }
    }, [])

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (maxTimerRef.current) clearTimeout(maxTimerRef.current)
            if (errorTimerRef.current) clearTimeout(errorTimerRef.current)
            if (graceTimerRef.current) clearTimeout(graceTimerRef.current)
            if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
            if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current)
            teardownMedia()
            teardownCurrentRecognition()
        }
    }, [teardownMedia])

    // Warm up the native speech engine right after mount (only when mic
    // permission is already granted) so capable devices start instantly.
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

    const processResult = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }

        phaseRef.current = 'idle'
        setPhase('idle')
        setElapsed(0)

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
            void onBid(parsed.amount)
        }
    }, [onBid, onBuy, showError])

    const finalize = useCallback((force = false) => {
        // Mic never actually started (slow init): extend the wait once instead
        // of instantly reporting "No speech"
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
        if (handoffTimerRef.current) { clearTimeout(handoffTimerRef.current); handoffTimerRef.current = null }
        if (recognitionRef.current) {
            const rec = recognitionRef.current
            recognitionRef.current = null
            try { rec.stop() } catch {}
        }
        recognitionActiveRef.current = false
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        processResult()
    }, [processResult])

    const submitFallbackAudio = useCallback(async (blob: Blob) => {
        if (processedRef.current) return
        const genAtStart = sessionGenRef.current
        processedRef.current = true
        finishingRef.current = false
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

        if (!blob.size) {
            processResult()
            return
        }

        setProcessing(true)
        try {
            const form = new FormData()
            form.append('audio', blob, `speech.${extForMime(blob.type || 'audio/webm')}`)
            const ctrl = new AbortController()
            const timeout = setTimeout(() => ctrl.abort(), TRANSCRIBE_TIMEOUT_MS)
            const res = await fetch('/api/voice/transcribe', {
                method: 'POST',
                body: form,
                signal: ctrl.signal,
            })
            clearTimeout(timeout)

            // A newer hold gesture started while we were uploading: drop this
            // result entirely rather than corrupting the new session.
            if (sessionGenRef.current !== genAtStart) return

            const data = await res.json().catch(() => ({}))
            setProcessing(false)

            if (!res.ok) {
                showError(res.status === 503 ? 'Voice setup missing' : 'Could not hear you')
                return
            }
            transcriptRef.current = String(data.text ?? '').trim()
        } catch {
            if (sessionGenRef.current !== genAtStart) return
            setProcessing(false)
            showError('Network error')
            return
        }

        processResult()
    }, [processResult, showError])

    const finishFallbackCapture = useCallback(() => {
        const recorder = mediaRecorderRef.current
        if (!recorder) {
            // Stream still being acquired; startFallback will auto-stop it
            pendingReleaseRef.current = true
            return
        }
        try {
            if (recorder.state === 'inactive') {
                mediaRecorderRef.current = null
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
                chunksRef.current = []
                teardownMedia()
                void submitFallbackAudio(blob)
            } else {
                recorder.stop()
            }
        } catch {
            teardownMedia()
            if (!processedRef.current) {
                processedRef.current = true
                showError('Voice failed')
            }
        }
    }, [submitFallbackAudio, teardownMedia, showError])

    const finishRecording = useCallback((cancelled: boolean) => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }

        if (cancelled) {
            processedRef.current = true
            finishingRef.current = false
            if (graceTimerRef.current) { clearTimeout(graceTimerRef.current); graceTimerRef.current = null }
            if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null }
            if (handoffTimerRef.current) { clearTimeout(handoffTimerRef.current); handoffTimerRef.current = null }
            if (recognitionRef.current) {
                const rec = recognitionRef.current
                recognitionRef.current = null
                try { rec.stop() } catch {}
            }
            teardownMedia()
            recognitionActiveRef.current = false
            phaseRef.current = 'idle'
            setPhase('idle')
            setElapsed(0)
            setMicReady(false)
            return
        }

        // Released while recording via MediaRecorder: audio up to this moment
        // is complete, transcribe immediately (no artificial wait)
        if (usingFallbackRef.current) {
            finishingRef.current = true
            phaseRef.current = 'idle'
            setPhase('idle')
            setElapsed(0)
            setMicReady(false)
            finishFallbackCapture()
            return
        }

        // Released on the Web Speech path: keep the recognizer alive briefly
        // so it can flush its pending/final results before we read them.
        finishingRef.current = true
        phaseRef.current = 'idle'
        setPhase('idle')
        setElapsed(0)

        graceTimerRef.current = setTimeout(() => {
            graceTimerRef.current = null
            finalize()
        }, RELEASE_GRACE_MS)
    }, [finalize, finishFallbackCapture, teardownMedia])

    const startRecording = useCallback(async () => {
        if (disabled) return

        // Flush any previous session still winding down
        if (finishingRef.current || graceTimerRef.current || restartTimerRef.current || handoffTimerRef.current) {
            finalize(true)
        }

        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

        if (!SpeechRecognition && !navigator.mediaDevices?.getUserMedia) {
            showError('Voice not supported')
            return
        }

        vibrate(50)
        isCancelledRef.current = false
        releasedDuringStartupRef.current = false
        transcriptRef.current = ''
        prevTranscriptRef.current = ''
        sessionFinalRef.current = ''
        processedRef.current = false
        finishingRef.current = false
        graceExtendedRef.current = false
        recognitionActiveRef.current = false
        usingFallbackRef.current = false
        pendingReleaseRef.current = false
        chunksRef.current = []

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

        const giveUp = (msg: string) => {
            if (processedRef.current) return
            processedRef.current = true
            finishingRef.current = false
            clearHandoff()
            teardownCurrentRecognition()
            teardownMedia()
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
            if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }
            phaseRef.current = 'idle'
            setPhase('idle')
            setElapsed(0)
            setMicReady(false)
            showError(msg)
        }

        const clearHandoff = () => {
            if (handoffTimerRef.current) { clearTimeout(handoffTimerRef.current); handoffTimerRef.current = null }
        }

        const teardownCurrent = () => {
            const rec = recognitionRef.current
            recognitionRef.current = null
            if (rec) { try { rec.abort() } catch {} }
        }

        // ---- Recorded-audio fallback ----

        const startFallback = async () => {
            if (phaseRef.current !== 'recording' || processedRef.current) return
            // Claim a fresh generation: stale native-engine handlers are now inert
            const gen = ++sessionGenRef.current

            if (!navigator.mediaDevices?.getUserMedia) {
                giveUp('Voice not supported')
                return
            }

            usingFallbackRef.current = true

            let stream: MediaStream
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
                })
            } catch (err: any) {
                if (gen !== sessionGenRef.current) return
                const name = err?.name
                giveUp(
                    name === 'NotAllowedError' ? 'Allow mic access'
                        : name === 'NotFoundError' ? 'No microphone found'
                            : 'Mic failed'
                )
                return
            }

            if (gen !== sessionGenRef.current || processedRef.current) {
                stream.getTracks().forEach((t) => { try { t.stop() } catch {} })
                return
            }
            mediaStreamRef.current = stream

            const mime = pickRecorderMime()
            let recorder: MediaRecorder
            try {
                recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
            } catch {
                stream.getTracks().forEach((t) => { try { t.stop() } catch {} })
                giveUp('Voice failed')
                return
            }

            chunksRef.current = []
            recorder.ondataavailable = (e: any) => {
                if (gen !== sessionGenRef.current) return
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
            }
            recorder.onstop = () => {
                if (gen !== sessionGenRef.current) return
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mime || 'audio/webm' })
                chunksRef.current = []
                teardownMedia()
                void submitFallbackAudio(blob)
            }

            mediaRecorderRef.current = recorder
            recognitionActiveRef.current = true
            setMicReady(true)

            try {
                recorder.start(250)
            } catch {
                teardownMedia()
                giveUp('Voice failed')
                return
            }

            // User already released while the mic was still being acquired
            if ((finishingRef.current || pendingReleaseRef.current) && !processedRef.current) {
                finishFallbackCapture()
            }
        }

        // ---- Native Web Speech path ----

        const spawn = () => {
            if (phaseRef.current !== 'recording' || processedRef.current) return

            if (!SpeechRecognition) {
                void startFallback()
                return
            }

            // Generation token: aborted/stale instances fire events late; they
            // must never touch shared state or the live instance's timers.
            const gen = ++sessionGenRef.current

            const recognition = new SpeechRecognition()
            // Android Chrome misbehaves with continuous mode: use single-shot
            // there and restart manually from onend.
            recognition.continuous = !isAndroid()
            recognition.interimResults = true
            recognition.lang = 'en-US'
            recognition.maxAlternatives = 1

            const isLive = () => gen === sessionGenRef.current

            const markLive = () => {
                if (!isLive()) return
                recognitionActiveRef.current = true
                setMicReady(true)
                clearHandoff()
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
                console.warn('[voice] recognition error:', e.error)
                // Engine failing (dead service, network, permission) — switch to
                // the recorded-audio fallback within the same hold gesture.
                teardownCurrent()
                void startFallback()
            }

            recognition.onend = () => {
                if (!isLive()) return
                recognitionActiveRef.current = false
                clearHandoff()

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
                    spawn()
                }, 150)
            }

            recognitionRef.current = recognition

            try {
                recognition.start()
            } catch {
                teardownCurrent()
                void startFallback()
                return
            }

            // If the engine shows no sign of life shortly after start(), hand
            // off to the recorded-audio fallback instead of hanging.
            clearHandoff()
            handoffTimerRef.current = setTimeout(() => {
                handoffTimerRef.current = null
                if (gen !== sessionGenRef.current) return
                if (phaseRef.current !== 'recording' || processedRef.current) return
                if (recognitionActiveRef.current) return
                teardownCurrent()
                void startFallback()
            }, FALLBACK_HANDOFF_MS)
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
    }, [disabled, showError, finishRecording, finalize, finishFallbackCapture, submitFallbackAudio, teardownMedia])

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

    const handlePointerUpEvent = useCallback((_e: React.PointerEvent) => {
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
                            {micReady ? timerText : 'Starting…'}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {processing && (
                    <motion.div
                        key="processing"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white text-xs font-semibold px-4 py-2 rounded-full"
                    >
                        Placing your bid…
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
