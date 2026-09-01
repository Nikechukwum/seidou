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
    // Optional: called when the user cancels within the post-send cancel window
    onCancelBid?: () => void
    disabled?: boolean
    lang?: string
    // Render the mic inline without viewport positioning (caller provides the
    // container, e.g. a fixed footer). Floating status labels stay viewport-anchored.
    renderInline?: boolean
    // Hands-free mode: the mic turns on as soon as this component mounts (i.e.
    // the user selected Voice mode) and stays on. The user just speaks
    // "bid 50000" and it executes the moment the command is recognised — no
    // button holding. Switching away from Voice mode unmounts the component,
    // which stops the mic (privacy).
    alwaysOn?: boolean
    // Pure safety ceiling for a stuck finger in hold-to-talk mode. Release-to-send
    // is what makes the action fast; this only prevents an infinite hold.
    maxHoldMs?: number
}

const SLIDE_CANCEL_PX = 70
const POST_SEND_CANCEL_MS = 4000
const CHECK_MARK_MS = 200
const ERROR_MS = 2000
const TRANSCRIBE_TIMEOUT_MS = 8000

// --- always-on (hands-free) tuning ---
const VAD_INTERVAL_MS = 200
const SPEECH_ENTER_RMS = 0.012
const SPEECH_KEEP_RMS = 0.005
const ENTER_TICKS = 3
const END_SILENCE_MS = 900
const MAX_UTTERANCE_MS = 6000
const RING_WINDOW_MS = 3500
const PREROLL_MS = 700
const FORCED_COMMIT_MS = 3000
const NATIVE_BID_SUPPRESS_MS = 3000
const NATIVE_MAX_ERRORS = 4

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

    // "3 thousand" / "2 hundred" / "1.5 million" -> digit + unit word
    const unitMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(hundred|thousand|million|billion)\b/)
    if (unitMatch) {
        const n = digitsToNumber(unitMatch[1])
        const mul = { hundred: 100, thousand: 1000, million: 1000000, billion: 1000000000 }[unitMatch[2]]
        const total = Math.round(n * mul!)
        if (total > 0) return total
    }

    // "bid 3k" / "3k" / "3.5k" / "1,5k" -> x1000 (last so "thousand" won)
    const kMatch = t.match(/(\d+(?:[.,]\d+)?)\s*k\b/)
    if (kMatch) {
        const n = digitsToNumber(kMatch[1])
        if (n > 0) return Math.round(n * 1000)
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

function readRms(analyser: AnalyserNode): number {
    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
    return Math.sqrt(sum / buf.length)
}

const VOICE_DEFAULTS: MediaTrackConstraints = {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
}

export default function VoiceBidButton({
    onBid,
    onBuy,
    onOptimisticBid,
    onCancelBid,
    disabled,
    lang = 'en-US',
    renderInline = false,
    alwaysOn = false,
    maxHoldMs = 4000,
}: VoiceBidButtonProps) {
    const [phase, setPhase] = useState<Phase>('idle')
    const [label, setLabel] = useState<string | null>(null)

    const phaseRef = useRef<Phase>('idle')
    const alwaysOnRef = useRef(alwaysOn)
    alwaysOnRef.current = alwaysOn
    const startTsRef = useRef(0)
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
    const genRef = useRef(0)
    const sessionActiveRef = useRef(false)

    // --- Native Web Speech engine ---
    const recognitionRef = useRef<any>(null)
    const lastTranscriptRef = useRef('')
    const prevFinalsRef = useRef('')
    const sessionFinalRef = useRef('')
    const srLiveRef = useRef(false)
    const nativeRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastNativeBidAtRef = useRef(0)
    const lastNativeErrorAtRef = useRef(0)
    const nativeErrCountRef = useRef(0)

    // --- Recorded-audio fallback (MediaRecorder -> /api/voice/transcribe) ---
    const recorderRef = useRef<MediaRecorder | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const chunksRef = useRef<Blob[]>([])

    // --- always-on (hands-free) state ---
    const audioCtxRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const lastForcedCommitRef = useRef(0)
    const transcribingRef = useRef(false)
    const ringRef = useRef<{ ts: number; blob: Blob }[]>([])
    const speechRef = useRef({ active: false, enter: 0, exit: 0, startedAt: 0, lastTalk: 0 })

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
        sessionActiveRef.current = false
        genRef.current += 1 // invalidate all in-flight callbacks
        clearTimers()
        stopNative()
        stopRecorder()
        if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null }
        analyserRef.current = null
        try { audioCtxRef.current?.close() } catch {}
        audioCtxRef.current = null
        ringRef.current = []
        lastTranscriptRef.current = ''
        prevFinalsRef.current = ''
        sessionFinalRef.current = ''
    }, [clearTimers, stopNative, stopRecorder])

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

        // Post-send cancel window (slide left in hold mode, tap in always-on).
        cancelWindowRef.current = true
        cancelFiredRef.current = false
        if (cancelWindowTimerRef.current) clearTimeout(cancelWindowTimerRef.current)
        cancelWindowTimerRef.current = setTimeout(() => {
            cancelWindowRef.current = false
        }, POST_SEND_CANCEL_MS)

        // Green check for 200ms. In always-on the mic stays hot for the next
        // command; in hold mode we hand back to the idle (held-mic) state.
        if (checkTimerRef.current) clearTimeout(checkTimerRef.current)
        checkTimerRef.current = setTimeout(() => {
            if (phaseRef.current === 'sending') {
                phaseRef.current = alwaysOnRef.current ? 'listening' : 'idle'
                setPhase(phaseRef.current)
                if (!alwaysOnRef.current) setLabel(null)
            }
        }, CHECK_MARK_MS)
    }, [onBid, onBuy, onOptimisticBid])

    const transcribe = useCallback(async (blob: Blob, gen: number, silent = false) => {
        phaseRef.current = 'listening'
        setPhase('listening')
        if (!silent) setLabel('Checking…')

        if (!blob.size) {
            if (!silent) showError('No speech')
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
                if (!silent) showError(res.status === 503 ? 'Setup missing' : 'No speech')
                return
            }

            const text = String(data.text ?? '').trim()
            const parsed = parseTranscript(text)
            if (!parsed) {
                if (!silent) showError(text ? 'Try again' : 'No speech')
                return
            }

            // In always-on, if the native engine already placed this utterance
            // (it is the fast path), don't double-place from the recorder.
            if (alwaysOnRef.current && Date.now() - lastNativeBidAtRef.current < NATIVE_BID_SUPPRESS_MS) return
            placeBid(parsed, gen)
        } catch {
            if (gen !== genRef.current) return
            if (!silent) showError('Network error')
        }
    }, [placeBid, showError])

    // =====================================================================
    // Always-on loop (hands-free). Recorder keeps a rolling ring buffer; a
    // VAD watcher commits an utterance (speech + 700ms pre-roll + ~900ms tail
    // silence) to Groq once you stop talking. Native engine runs in parallel
    // and places the bid the instant interim results show "bid + number".
    // =====================================================================

    const startAlwaysNative = useCallback((gen: number) => {
        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) return
        if (!sessionActiveRef.current || nativeErrCountRef.current >= NATIVE_MAX_ERRORS) return

        const rec = new SpeechRecognition()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = lang
        rec.maxAlternatives = 1

        rec.onresult = (event: any) => {
            if (gen !== genRef.current || !sessionActiveRef.current) return
            srLiveRef.current = true

            let finals = ''
            let interim = ''
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) finals += event.results[i][0].transcript + ' '
                else interim = event.results[i][0].transcript
            }
            lastTranscriptRef.current = (finals + ' ' + interim).trim()
            const parsed = parseTranscript(lastTranscriptRef.current)
            if (!parsed) return
            if (Date.now() - lastNativeBidAtRef.current <= NATIVE_BID_SUPPRESS_MS) return
            lastNativeBidAtRef.current = Date.now()
            placeBid(parsed, gen)
        }

        rec.onerror = (e: any) => {
            if (gen !== genRef.current) return
            lastNativeErrorAtRef.current = Date.now()
            if (e?.error && e.error !== 'aborted') {
                console.warn('[voice] always-on native error:', e.error)
            }
        }

        rec.onend = () => {
            if (gen !== genRef.current || !sessionActiveRef.current) return
            // Engine ended a session. Ordinary end-of-utterance is normal; a run
            // of error-ended sessions means the engine is dead/broken (the
            // recorder path will carry the feature regardless).
            const afterError = Date.now() - lastNativeErrorAtRef.current < 600
            if (afterError) {
                nativeErrCountRef.current += 1
                if (nativeErrCountRef.current >= NATIVE_MAX_ERRORS) {
                    recognitionRef.current = null
                    return
                }
            } else {
                nativeErrCountRef.current = Math.max(0, nativeErrCountRef.current - 1)
            }
            if (nativeRestartTimerRef.current) clearTimeout(nativeRestartTimerRef.current)
            nativeRestartTimerRef.current = setTimeout(() => {
                nativeRestartTimerRef.current = null
                if (gen === genRef.current && sessionActiveRef.current) startAlwaysNative(gen)
            }, 150)
        }

        recognitionRef.current = rec
        try {
            rec.start()
        } catch {
            recognitionRef.current = null
        }
    }, [lang, placeBid])

    const commitWindow = useCallback((startTs: number, endTs: number, gen: number) => {
        if (transcribingRef.current) return
        const blobs = ringRef.current.filter((c) => c.ts >= startTs - 150)
        if (!blobs.length) return
        const type = recorderRef.current?.mimeType || 'audio/webm'
        const blob = new Blob(blobs.map((c) => c.blob), { type })
        // Reset the ring; it refills from the still-running recorder.
        ringRef.current = []
        transcribingRef.current = true
        void transcribe(blob, gen, true).finally(() => { transcribingRef.current = false })
    }, [transcribe])

    const vadTick = useCallback(() => {
        const ctx = audioCtxRef.current
        const analyser = analyserRef.current
        const gen = genRef.current
        if (!ctx || !analyser || !sessionActiveRef.current) return

        const t = Date.now()

        // Context couldn't run (autoplay/timing). Fall back to time-boxed
        // commits of the most recent audio so a dead engine still works.
        if (ctx.state !== 'running') {
            if (!transcribingRef.current && t - lastForcedCommitRef.current >= FORCED_COMMIT_MS) {
                lastForcedCommitRef.current = t
                const blobs = ringRef.current.filter((c) => c.ts >= t - 2200)
                if (blobs.length) {
                    const blob = new Blob(blobs.map((c) => c.blob), {
                        type: recorderRef.current?.mimeType || 'audio/webm',
                    })
                    ringRef.current = []
                    transcribingRef.current = true
                    void transcribe(blob, gen, true).finally(() => { transcribingRef.current = false })
                }
            }
            return
        }

        const rms = readRms(analyser)
        const s = speechRef.current

        if (rms > SPEECH_ENTER_RMS) { s.enter += 1; s.exit = 0 } else { s.exit += 1; s.enter = 0 }

        if (!s.active && s.enter >= ENTER_TICKS) {
            s.active = true
            s.enter = 0
            s.exit = 0
            s.startedAt = t - PREROLL_MS
            s.lastTalk = t
        }
        if (s.active && rms > SPEECH_KEEP_RMS) s.lastTalk = t

        if (s.active && s.startedAt) {
            const utteranceDone =
                (t - s.lastTalk) >= END_SILENCE_MS || (t - s.startedAt) >= MAX_UTTERANCE_MS
            if (utteranceDone && s.exit >= 4) {
                commitWindow(s.startedAt, t, gen)
                s.active = false
                s.enter = 0
                s.exit = 0
                s.startedAt = 0
                s.lastTalk = 0
            }
        }
    }, [commitWindow, transcribe])

    const startAlwaysOn = useCallback(() => {
        if (sessionActiveRef.current) return
        const gen = ++genRef.current
        sessionActiveRef.current = true
        nativeErrCountRef.current = 0
        lastForcedCommitRef.current = 0
        ringRef.current = []
        speechRef.current = { active: false, enter: 0, exit: 0, startedAt: 0, lastTalk: 0 }
        lastTranscriptRef.current = ''
        prevFinalsRef.current = ''
        sessionFinalRef.current = ''

        phaseRef.current = 'listening'
        setPhase('listening')
        setLabel(null)
        vibrate(20)

        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            showError('Mic unavailable')
            sessionActiveRef.current = false
            return
        }

        navigator.mediaDevices
            .getUserMedia({ audio: VOICE_DEFAULTS })
            .then((stream) => {
                if (gen !== genRef.current || !sessionActiveRef.current) {
                    stream.getTracks().forEach((t) => { try { t.stop() } catch {} })
                    return
                }
                streamRef.current = stream

                // Continuous recorder feeding a rolling ring buffer. Never stops
                // between commands, so the next utterance has warm audio instantly.
                const mime = pickRecorderMime()
                let recorder: MediaRecorder
                try {
                    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
                } catch {
                    stream.getTracks().forEach((t) => { try { t.stop() } catch {} })
                    streamRef.current = null
                    sessionActiveRef.current = false
                    showError('Mic unavailable')
                    return
                }
                recorder.ondataavailable = (e: any) => {
                    if (gen !== genRef.current || !sessionActiveRef.current) return
                    if (e.data && e.data.size > 0) {
                        ringRef.current.push({ ts: Date.now(), blob: e.data })
                        const cutoff = Date.now() - RING_WINDOW_MS
                        ringRef.current = ringRef.current.filter((c) => c.ts >= cutoff)
                    }
                }
                recorderRef.current = recorder
                try { recorder.start(400) } catch { /* recorder-limited mode */ }

                // AudioContext + analyser for voice-activity detection.
                const CTX: any = window.AudioContext || (window as any).webkitAudioContext
                if (CTX) {
                    try {
                        const ctx: AudioContext = new CTX()
                        audioCtxRef.current = ctx
                        const source = ctx.createMediaStreamSource(stream)
                        const analyser = ctx.createAnalyser()
                        analyser.fftSize = 1024
                        analyser.smoothingTimeConstant = 0.35
                        source.connect(analyser)
                        analyserRef.current = analyser
                        try { void ctx.resume() } catch {}
                    } catch {}
                }

                if (vadTimerRef.current) clearInterval(vadTimerRef.current)
                vadTimerRef.current = setInterval(vadTick, VAD_INTERVAL_MS)
                startAlwaysNative(gen)
            })
            .catch(() => {
                sessionActiveRef.current = false
                showError('Tap to enable mic')
            })
    }, [showError, startAlwaysNative, vadTick])

    useEffect(() => {
        if (alwaysOnRef.current) startAlwaysOn()
        return () => { teardownAll() }
    }, [alwaysOn, startAlwaysOn, teardownAll])

    // =====================================================================
    // Hold-to-talk mode (default, when alwaysOn is false)
    // =====================================================================

    // Recording path: capture audio from t=0 so even a dead native engine
    // never loses your speech.
    const startRecorder = useCallback((gen: number) => {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
            return
        }
        navigator.mediaDevices
            .getUserMedia({ audio: VOICE_DEFAULTS })
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

        // Take the latest transcript NOW and try to send immediately. Do not
        // wait for onend.
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
        if (disabled || alwaysOnRef.current || phaseRef.current !== 'idle') return
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
    }, [alwaysOnRef, disabled, maxHoldMs, release, startNative, startRecorder])

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

    // In always-on mode the button is a status indicator + tap-to-cancel/retry.
    const handleTap = useCallback(() => {
        if (!alwaysOnRef.current) return
        if (phaseRef.current === 'sending' && cancelWindowRef.current && !cancelFiredRef.current) {
            cancelFiredRef.current = true
            cancelWindowRef.current = false
            void onCancelBid?.()
            vibrate(10)
            return
        }
        if (phaseRef.current !== 'listening') {
            // Mic permission denied or session died: retry (browser will prompt
            // only on the first request; afterwards it starts silently).
            teardownAll()
            setTimeout(() => startAlwaysOn(), 200)
        }
    }, [onCancelBid, startAlwaysOn, teardownAll])

    const listeningHint = alwaysOn ? 'Say “bid 50000”' : 'Slide left to cancel'
    const sendingHint = alwaysOn ? 'Tap to cancel' : 'Slide left to cancel'

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
                            {label ?? (alwaysOn ? 'Listening for “bid…”' : 'Listening…')}
                        </div>
                        <div className="text-white/50 text-[11px] font-medium">{listeningHint}</div>
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
                        <div className="text-white/50 text-[11px] font-medium">{sendingHint}</div>
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
                onClick={alwaysOn ? handleTap : undefined}
                onPointerDown={alwaysOn ? undefined : handleDown}
                onPointerMove={alwaysOn ? undefined : handleMove}
                onPointerUp={alwaysOn ? undefined : handleUp}
                onPointerCancel={alwaysOn ? undefined : handleUp}
                onTouchStart={!alwaysOn && !(window as any).PointerEvent ? handleDown : undefined}
                onTouchMove={!alwaysOn && !(window as any).PointerEvent ? handleMove : undefined}
                onTouchEnd={!alwaysOn && !(window as any).PointerEvent ? handleUp : undefined}
                onTouchCancel={!alwaysOn && !(window as any).PointerEvent ? handleUp : undefined}
                disabled={alwaysOn ? false : disabled}
                className={`size-14 rounded-full flex items-center justify-center select-none touch-none transition-transform duration-150 disabled:opacity-40 ${
                    disabled && !alwaysOn
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : phase === 'listening'
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/40 active:scale-95 animate-pulse'
                            : phase === 'sending'
                                ? 'bg-green-500 text-white shadow-lg shadow-green-500/40'
                                : 'bg-gray-900 text-white shadow-lg active:scale-95'
                } ${renderInline ? '' : 'fixed bottom-6 left-1/2 -translate-x-1/2 z-50'}`}
                aria-label={alwaysOn ? 'Listening for a voice bid' : 'Hold to speak a bid'}
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