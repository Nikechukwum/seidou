import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MAX_AUDIO_BYTES = 2_000_000

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
        }

        const apiKey = process.env.GROQ_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'Voice service not configured.' }, { status: 503 })
        }

        let form: FormData
        try {
            form = await request.formData()
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
        }

        const audio = form.get('audio')
        if (!(audio instanceof File)) {
            return NextResponse.json({ error: 'audio file is required.' }, { status: 400 })
        }
        if (audio.size === 0) {
            return NextResponse.json({ error: 'audio file is empty.' }, { status: 400 })
        }
        if (audio.size > MAX_AUDIO_BYTES) {
            return NextResponse.json({ error: 'audio file too large.' }, { status: 413 })
        }

        const upstream = new FormData()
        upstream.append('file', audio, audio.name || 'speech.webm')
        upstream.append('model', 'whisper-large-v3')
        upstream.append('language', 'en')
        upstream.append('response_format', 'json')
        upstream.append('temperature', '0')
        upstream.append(
            'prompt',
            'Auction voice command. The words bid, buy or purchase followed by an amount, e.g. "bid 100", "buy 5000 naira", "purchase 1.5k".'
        )

        const res = await fetch(GROQ_STT_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}` },
            body: upstream,
        })

        if (!res.ok) {
            const detail = await res.text().catch(() => '')
            console.error('[voice/transcribe] upstream error:', res.status, detail.slice(0, 300))
            return NextResponse.json({ error: 'Transcription failed.' }, { status: 502 })
        }

        const data = await res.json().catch(() => null)
        const text = typeof data?.text === 'string' ? data.text.trim() : ''
        return NextResponse.json({ text })
    } catch (err) {
        console.error('[voice/transcribe] unexpected error:', err)
        return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
    }
}
