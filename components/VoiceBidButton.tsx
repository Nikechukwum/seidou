'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Mic } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useDispatch } from 'react-redux'
import { showToast } from '@/redux/toastSlice'

type VoiceAction = 'BID' | 'BUY'

interface VoiceBidButtonProps {
    onBid: (amount: number) => void
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

    // Try digit-based patterns first: "bid 50000", "50k", "50000"
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

    // Try word-to-number: "fifty thousand", "hundred k"
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
    const [volume, setVolume] = useState(0)

    const pointerStartRef = useRef<{ x: number; y: number } | null>(null)
    const isCancelledRef = useRef(false)
    const recognitionRef = useRef<any>(null)
    const audioCtxRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const animFrameRef = useRef<number>(0)
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const startTimeRef = useRef(0)
    const transcriptRef = useRef('')
    const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const dispatch = useDispatch()

    const cleanup = useCallback(() => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }
        if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = 0 }
        if (recognitionRef.current) {
            try { recognitionRef.current.stop() } catch {}
            recognitionRef.current = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        if (audioCtxRef.current) {
            try { audioCtxRef.current.close() } catch {}
            audioCtxRef.current = null
        }
        analyserRef.current = null
        setVolume(0)
        setElapsed(0)
    }, [])

    useEffect(() => {
        return () => cleanup()
    }, [cleanup])

    const startRecording = useCallback(async () => {
        if (disabled) return

        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

        if (!SpeechRecognition) {
            dispatch(showToast({ type: 'error', message: 'Voice input is not supported in this browser.' }))
            return
        }

        // Haptic
        vibrate(50)

        // Get mic stream for waveform
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            streamRef.current = stream

            const audioCtx = new AudioContext()
            audioCtxRef.current = audioCtx
            const source = audioCtx.createMediaStreamSource(stream)
            const analyser = audioCtx.createAnalyser()
            analyser.fftSize = 256
            source.connect(analyser)
            analyserRef.current = analyser

            const dataArray = new Uint8Array(analyser.frequencyBinCount)
            const tick = () => {
                analyser.getByteFrequencyData(dataArray)
                let sum = 0
                for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]
                setVolume(sum / dataArray.length / 255)
                animFrameRef.current = requestAnimationFrame(tick)
            }
            tick()
        } catch {
            dispatch(showToast({ type: 'error', message: 'Microphone access denied.' }))
            return
        }

        // Start Web Speech in background
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.maxAlternatives = 1

        recognition.onresult = (event: any) => {
            let final = ''
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    final += event.results[i][0].transcript + ' '
                }
            }
            if (final.trim()) transcriptRef.current = final.trim()
        }

        recognition.onerror = () => {}
        recognition.onend = () => {}

        recognitionRef.current = recognition
        recognition.start()

        // Timer
        startTimeRef.current = Date.now()
        setElapsed(0)
        timerRef.current = setInterval(() => {
            setElapsed(Date.now() - startTimeRef.current)
        }, 100)

        setPhase('recording')
        isCancelledRef.current = false
        transcriptRef.current = ''

        // Auto-stop after max duration
        maxTimerRef.current = setTimeout(() => {
            handlePointerUp()
        }, MAX_RECORDING_MS)
    }, [disabled, dispatch])

    const handlePointerUp = useCallback(() => {
        if (phase !== 'recording') return

        const cancelled = isCancelledRef.current
        const transcript = transcriptRef.current

        // Clean up resources
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
        if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null }
        if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = 0 }

        if (recognitionRef.current) {
            try { recognitionRef.current.stop() } catch {}
            recognitionRef.current = null
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop())
            streamRef.current = null
        }
        if (audioCtxRef.current) {
            try { audioCtxRef.current.close() } catch {}
            audioCtxRef.current = null
        }
        analyserRef.current = null
        setVolume(0)

        if (cancelled) {
            setPhase('idle')
            dispatch(showToast({ type: 'error', message: 'Recording cancelled.' }))
            return
        }

        if (!transcript) {
            setPhase('idle')
            setElapsed(0)
            dispatch(showToast({ type: 'error', message: 'No speech detected. Try again.' }))
            return
        }

        const parsed = parseTranscript(transcript)

        if (!parsed) {
            setPhase('idle')
            setElapsed(0)
            dispatch(showToast({ type: 'error', message: `Couldn't understand: "${transcript}"` }))
            return
        }

        setPhase('idle')
        setElapsed(0)
        vibrate(30)

        if (parsed.action === 'BUY' && onBuy) {
            onBuy(parsed.amount)
        } else {
            onBid(parsed.amount)
        }
    }, [phase, dispatch, onBid, onBuy])

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        if (disabled || phase === 'recording') return
        e.preventDefault()
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        pointerStartRef.current = { x: e.clientX, y: e.clientY }
        startRecording()
    }, [disabled, phase, startRecording])

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (phase !== 'recording' || !pointerStartRef.current) return
        const dx = e.clientX - pointerStartRef.current.x
        const dy = e.clientY - pointerStartRef.current.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (dx < -CANCEL_THRESHOLD_PX || distance > CANCEL_THRESHOLD_PX) {
            isCancelledRef.current = true
            setPhase('cancelled')
        }
    }, [phase])

    const handlePointerUpEvent = useCallback((e: React.PointerEvent) => {
        if (phase !== 'recording' && phase !== 'cancelled') return
        pointerStartRef.current = null
        handlePointerUp()
    }, [phase, handlePointerUp])

    const elapsedSec = Math.floor(elapsed / 1000)
    const elapsedMs = Math.floor((elapsed % 1000) / 100)
    const timerText = `${elapsedSec}.${elapsedMs}s`

    const button = (
        <>
            {/* Overlay during recording */}
            <AnimatePresence>
                {(phase === 'recording' || phase === 'cancelled') && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 bg-black/40"
                        onPointerUp={handlePointerUpEvent}
                        onPointerMove={handlePointerMove}
                    />
                )}
            </AnimatePresence>

            {/* Waveform + timer bar at bottom */}
            <AnimatePresence>
                {phase === 'recording' && (
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3"
                    >
                        {/* Waveform bars */}
                        <div className="flex items-end gap-1 h-10">
                            {Array.from({ length: 12 }).map((_, i) => {
                                const offset = i * 0.15
                                const barVol = Math.min(1, volume * (1 + Math.sin(Date.now() * 0.005 + offset) * 0.4))
                                const height = 6 + barVol * 34
                                return (
                                    <div
                                        key={i}
                                        className="w-1 rounded-full bg-red-500 transition-all duration-75"
                                        style={{ height: `${height}px` }}
                                    />
                                )
                            })}
                        </div>

                        {/* Timer */}
                        <div className="bg-black/80 text-white text-sm font-mono font-bold px-4 py-1.5 rounded-full">
                            {timerText}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Slide to cancel text */}
            <AnimatePresence>
                {phase === 'recording' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="fixed bottom-44 left-1/2 -translate-x-1/2 z-50 text-white/70 text-xs font-medium"
                    >
                        Slide left to cancel
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cancelled label */}
            <AnimatePresence>
                {phase === 'cancelled' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 bg-red-500 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-lg"
                    >
                        Release to cancel
                    </motion.div>
                )}
            </AnimatePresence>

            {/* The mic button */}
            <button
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUpEvent}
                onPointerMove={handlePointerMove}
                onPointerCancel={() => { if (phase === 'recording') { isCancelledRef.current = true; handlePointerUp() } }}
                disabled={disabled}
                className={`fixed bottom-6 right-6 z-50 size-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-150 select-none touch-none ${
                    phase === 'recording'
                        ? 'bg-red-500 text-white shadow-red-500/40 scale-110'
                        : phase === 'cancelled'
                        ? 'bg-red-400 text-white shadow-red-400/30'
                        : 'bg-black text-white hover:bg-neutral-800'
                } ${disabled ? 'opacity-40' : 'active:scale-95'}`}
                aria-label="Hold to speak a bid"
            >
                {phase === 'recording' ? (
                    <div className="relative">
                        <Mic className="size-6" />
                        {/* Pulsing ring */}
                        <span className="absolute inset-0 rounded-full border-2 border-white/40 animate-ping" />
                    </div>
                ) : (
                    <Mic className="size-6" />
                )}
            </button>
        </>
    )

    return createPortal(button, document.body)
}
