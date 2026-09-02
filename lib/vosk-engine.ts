/**
 * On-device WASM speech recognition via Vosk. Zero network round-trip.
 *
 * The model URL is read from NEXT_PUBLIC_VOSK_MODEL_URL. When unset the
 * engine is disabled and VoiceBidButton falls through to its recorder+Groq
 * path. The model must be a gzipped tar (.tar.gz) of a standard Vosk model
 * folder — the alphacephei .zip downloads need converting first.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const VOSK_GRAMMAR = JSON.stringify([
    'bid', 'buy', 'purchase',
    'zero', 'one', 'two', 'three', 'four', 'five',
    'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
    'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
    'hundred', 'thousand', 'million', 'billion', 'k',
])

// ── Model lifecycle ─────────────────────────────────────────────────────

let cachedModel: any = null
let modelLoadPromise: Promise<any> | null = null

export async function loadVoskModel(url: string): Promise<any> {
    if (cachedModel?.ready) return cachedModel
    if (modelLoadPromise) return modelLoadPromise

    modelLoadPromise = (async () => {
        try {
            const Vosk = await import('vosk-browser')
            const model = await (Vosk.createModel ?? Vosk.default?.createModel)(url)
            cachedModel = model
            return model
        } catch (err) {
            modelLoadPromise = null
            throw err
        }
    })()

    return modelLoadPromise
}

export function isVoskReady(): boolean {
    return cachedModel?.ready === true
}

export function destroyVoskModel(): void {
    if (cachedModel) {
        try { cachedModel.terminate() } catch {}
        cachedModel = null
    }
    modelLoadPromise = null
}

// ── Recognizer ──────────────────────────────────────────────────────────

export interface VoskCallbacks {
    onResult: (text: string) => void
    onPartial?: (text: string) => void
}

export function createVoskRecognizer(
    model: any,
    sampleRate: number,
    callbacks: VoskCallbacks,
): any {
    const grammar = VOSK_GRAMMAR
    const recognizer = new model.KaldiRecognizer(sampleRate, grammar)

    recognizer.on('result', (msg: any) => {
        const text: string | undefined = msg.result?.text?.trim()
        if (text) callbacks.onResult(text)
    })

    recognizer.on('partialresult', (msg: any) => {
        const partial: string | undefined = msg.result?.partial?.trim()
        if (partial) callbacks.onPartial?.(partial)
    })

    return recognizer
}

// ── Audio pipeline ──────────────────────────────────────────────────────
// Pipes a MediaStream through a ScriptProcessorNode into the Vosk
// recognizer. ScriptProcessor is deprecated but is the only path that
// produces AudioBuffers for vosk-browser's acceptWaveform(). A silent gain
// node keeps the processor alive without playing mic audio back.

export function pipeMicToRecognizer(
    stream: MediaStream,
    recognizer: any,
    sampleRate: number,
    bufferSize = 4096,
): { stop: () => void } {
    const AudioCtx: any = (window as any).AudioContext || (window as any).webkitAudioContext
    const ctx: AudioContext = new AudioCtx({ sampleRate })

    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(bufferSize, 1, 1)
    const silentGain = ctx.createGain()
    silentGain.gain.value = 0

    processor.onaudioprocess = (event: AudioProcessingEvent) => {
        try {
            recognizer.acceptWaveform(event.inputBuffer)
        } catch {
            // WASM may throw if the recognizer was removed — harmless.
        }
    }

    source.connect(processor)
    processor.connect(silentGain)
    silentGain.connect(ctx.destination)

    return {
        stop: () => {
            try { processor.disconnect() } catch {}
            try { source.disconnect() } catch {}
            try { silentGain.disconnect() } catch {}
            try { ctx.close() } catch {}
        },
    }
}

// ── Convenience: one-call start ─────────────────────────────────────────

export async function startVoskPipeline(
    modelUrl: string,
    stream: MediaStream,
    callbacks: VoskCallbacks,
): Promise<{ stop: () => void }> {
    const model = await loadVoskModel(modelUrl)

    // Use 16 kHz for the recognizer — Android Chrome honours the request,
    // Safari may return 44.1 kHz; the recognizer handles either gracefully
    // as long as we pass the correct rate.
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const sampleRate = ctx.sampleRate
    ctx.close()

    const recognizer = createVoskRecognizer(model, sampleRate, callbacks)
    const connection = pipeMicToRecognizer(stream, recognizer, sampleRate)

    return {
        stop: () => {
            connection.stop()
            try { recognizer.remove() } catch {}
        },
    }
}
