'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useDispatch } from 'react-redux'
import { showToast } from '@/redux/toastSlice'

type VoiceAction = 'BID' | 'BUY'| 'I WANT TO BID'

interface ParsedCommand {
    action: VoiceAction
    amount: number
    raw: string
}

interface VoiceBidButtonProps {
    onBid: (amount: number) => void
    onBuy?: (amount: number) => void
    disabled?: boolean
}

function parseVoiceCommand(transcript: string): ParsedCommand | null {
    const cleaned = transcript
        .toLowerCase()
        .replace(/[₦$]/g, '')
        .replace(/,/g, '')
        .replace(/\s+/g, ' ')
        .trim()

    // Match "bid 50000", "bid fifty thousand", "increase by 50000", "add 50000"
    const bidPatterns = [
        /(?:bid|increase\s+(?:by\s+)?)\s+(\d[\d]*)/i,
        /(?:add|raise|place)\s+(?:a\s+)?(?:bid\s+(?:of\s+)?)?(\d[\d]*)/i,
        /(\d[\d]*)\s*(?:bid|credits?|b)/i,
    ]

    for (const pattern of bidPatterns) {
        const match = cleaned.match(pattern)
        if (match) {
            const amount = parseInt(match[1], 10)
            if (amount > 0 && isFinite(amount)) {
                return { action: 'BID', amount, raw: transcript }
            }
        }
    }

    // Match "buy 100000", "purchase 100000", "buy 100k"
    const buyPatterns = [
        /(?:buy|purchase)\s+(\d[\d]*)/i,
        /(?:buy|purchase)\s+(\d+)\s*k/i,
    ]

    for (const pattern of buyPatterns) {
        const match = cleaned.match(pattern)
        if (match) {
            let amount = parseInt(match[1], 10)
            if (cleaned.match(/\d+\s*k/i) && !cleaned.match(/(?:buy|purchase)\s+\d{4,}/i)) {
                amount *= 1000
            }
            if (amount > 0 && isFinite(amount)) {
                return { action: 'BUY', amount, raw: transcript }
            }
        }
    }

    // Fallback: if the transcript contains a number, default to BID
    const fallbackMatch = cleaned.match(/(\d[\d]*)/)
    if (fallbackMatch) {
        const amount = parseInt(fallbackMatch[1], 10)
        if (amount > 0 && isFinite(amount)) {
            return { action: 'BID', amount, raw: transcript }
        }
    }

    return null
}

export default function VoiceBidButton({ onBid, onBuy, disabled }: VoiceBidButtonProps) {
    const [isListening, setIsListening] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [parsedCommand, setParsedCommand] = useState<ParsedCommand | null>(null)
    const recognitionRef = useRef<any>(null)
    const dispatch = useDispatch()

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop() } catch {}
            recognitionRef.current = null
        }
        setIsListening(false)
    }, [])

    useEffect(() => {
        return () => stopListening()
    }, [stopListening])

    const handleVoiceResult = useCallback((transcript: string) => {
        setIsProcessing(true)
        const command = parseVoiceCommand(transcript)
        setIsProcessing(false)

        if (!command) {
            dispatch(showToast({ type: 'error', message: `Couldn't understand: "${transcript}"` }))
            return
        }

        setParsedCommand(command)
        setShowConfirm(true)
    }, [dispatch])

    const startListening = useCallback(() => {
        if (disabled || isProcessing) return

        const SpeechRecognition =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

        if (!SpeechRecognition) {
            dispatch(showToast({ type: 'error', message: 'Voice input is not supported in this browser.' }))
            return
        }

        if (isListening) {
            stopListening()
            return
        }

        const recognition = new SpeechRecognition()
        recognition.continuous = false
        recognition.interimResults = false
        recognition.lang = 'en-US'
        recognition.maxAlternatives = 1

        recognition.onstart = () => setIsListening(true)
        recognition.onend = () => {
            setIsListening(false)
            recognitionRef.current = null
        }
        recognition.onerror = (e: any) => {
            if (e.error !== 'aborted' && e.error !== 'no-speech') {
                dispatch(showToast({ type: 'error', message: 'Voice recognition failed. Try again.' }))
            }
            setIsListening(false)
            recognitionRef.current = null
        }
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript
            handleVoiceResult(transcript)
        }

        recognitionRef.current = recognition
        recognition.start()
    }, [disabled, isProcessing, isListening, stopListening, dispatch, handleVoiceResult])

    const handleConfirm = () => {
        if (!parsedCommand) return
        setShowConfirm(false)

        if (parsedCommand.action === 'BID') {
            onBid(parsedCommand.amount)
        } else if (parsedCommand.action === 'BUY' && onBuy) {
            onBuy(parsedCommand.amount)
        }

        setParsedCommand(null)
    }

    const handleDismiss = () => {
        setShowConfirm(false)
        setParsedCommand(null)
    }

    const formatAmount = (n: number) => n.toLocaleString()

    return createPortal(
        <>
            {/* Floating Mic Button */}
            <button
                onClick={startListening}
                disabled={disabled}
                className={`fixed bottom-6 right-6 z-30 p-4 rounded-full shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                    isListening
                        ? 'bg-red-500 text-white shadow-red-500/30'
                        : 'bg-black text-white hover:bg-neutral-800'
                }`}
                aria-label="Voice Bid"
            >
                {isProcessing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                ) : isListening ? (
                    <div className="relative">
                        <MicOff className="w-6 h-6" />
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full animate-ping" />
                    </div>
                ) : (
                    <Mic className="w-6 h-6" />
                )}
            </button>

            {/* Listening indicator */}
            <AnimatePresence>
                {isListening && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="fixed bottom-24 right-6 z-30 bg-black text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg"
                    >
                        Listening...
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Confirmation Modal */}
            <AnimatePresence>
                {showConfirm && parsedCommand && (
                    <div className="fixed inset-0 z-50 flex justify-center items-center">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/20"
                            onClick={handleDismiss}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="relative bg-white border border-slate-200 p-7 rounded-3xl shadow-lg w-[85%] max-w-sm"
                        >
                            <p className="text-sm text-gray-500 mb-1">You said:</p>
                            <p className="text-base text-gray-800 italic mb-4 truncate">
                                &ldquo;{parsedCommand.raw}&rdquo;
                            </p>

                            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                                <p className="text-sm text-gray-500 mb-1">
                                    {parsedCommand.action === 'BID' ? 'Place Bid' : 'Buy Credits'}
                                </p>
                                <p className="text-2xl font-bold text-gray-900">
                                    B {formatAmount(parsedCommand.amount)}
                                </p>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleDismiss}
                                    className="flex-1 rounded-full border border-gray-200 bg-transparent py-3 text-sm font-bold text-gray-600 active:bg-gray-100 duration-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    className="flex-1 rounded-full bg-black text-white py-3 text-sm font-bold active:bg-neutral-800 duration-100"
                                >
                                    Confirm
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>,
        document.body
    )
}
