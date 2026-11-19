import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
    VtuConfigError,
    convertAirtime,
    isVtuNetwork,
    newVtuRef,
    queryTransaction,
    verifyAirtime2Cash,
    vtuMode,
} from '@/lib/vtuafrica'

// ============================================================================
// POST /api/airtime-to-cash — the server side of the Airtime-to-Cash TEST,
// using VTUAfrica (lib/vtuafrica.ts). Signed-in users only; the API key stays
// on the server.
//   { action: 'check',   network }                                 -> verify
//   { action: 'convert', network, senderNumber, amount, sitePhone,
//     airtimeSent: true }                                          -> convert
//   { action: 'status',  ref }                                     -> query
// The response always includes `mode` ('sandbox' | 'live') and VTUAfrica's
// raw answer, so the test page can show exactly what came back.
// ============================================================================

const PHONE_RE = /^0\d{10}$/ // Nigerian format: 11 digits starting with 0

export async function POST(request: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
        return NextResponse.json({ error: 'Sign in first.' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const mode = vtuMode()

    try {
        if (body.action === 'check') {
            if (!isVtuNetwork(body.network)) {
                return NextResponse.json({ error: 'Pick a network: mtn, airtel, glo or 9mobile.' }, { status: 400 })
            }
            const vtu = await verifyAirtime2Cash(body.network)
            return NextResponse.json({ mode, vtu })
        }

        if (body.action === 'convert') {
            // The docs warn that convert requests without the airtime having
            // been sent get the account BLOCKED — so the page must confirm it.
            if (body.airtimeSent !== true) {
                return NextResponse.json({ error: 'Send the airtime first, then confirm.' }, { status: 400 })
            }
            if (!isVtuNetwork(body.network)) {
                return NextResponse.json({ error: 'Pick a network.' }, { status: 400 })
            }
            const senderNumber = String(body.senderNumber ?? '').trim()
            if (!PHONE_RE.test(senderNumber)) {
                return NextResponse.json({ error: 'Enter the 11-digit number you sent the airtime from (e.g. 08012345678).' }, { status: 400 })
            }
            const amount = Number(body.amount)
            if (!Number.isInteger(amount) || amount < 50) {
                return NextResponse.json({ error: 'Enter the whole amount you sent (₦50 or more).' }, { status: 400 })
            }
            const sitePhone = String(body.sitePhone ?? '').trim()

            const ref = newVtuRef()
            // VTUAfrica can only reach a public URL, so the webhook is sent
            // only when the app runs on its real domain (not localhost).
            const origin = request.nextUrl.origin
            const webhookUrl = origin.includes('localhost') ? undefined : `${origin}/api/airtime-to-cash/webhook`

            console.log('[airtime-to-cash] convert', { mode, ref, network: body.network, amount, userId: user.id })
            let vtu
            try {
                vtu = await convertAirtime({
                    network: body.network,
                    sender: user.email ?? user.id,
                    senderNumber,
                    amount,
                    ref,
                    sitePhone: sitePhone || undefined,
                    webhookUrl,
                })
            } catch (err) {
                // The connection can break AFTER VTUAfrica got the request, so
                // whether it arrived is unknown. Hand back the reference so the
                // status check can find out — never just retry the convert.
                console.error('[airtime-to-cash] convert failed', { ref, err })
                const e = err as Error & { cause?: { code?: string; message?: string } }
                return NextResponse.json({
                    mode,
                    ref,
                    error: 'The connection to VTUAfrica broke. Do NOT convert again — check the status of this reference first.',
                    detail: `${e?.message ?? String(err)}${e?.cause ? ` — ${e.cause.code ?? ''} ${e.cause.message ?? ''}` : ''}`.trim(),
                }, { status: 502 })
            }
            console.log('[airtime-to-cash] convert response', { ref, vtu })
            return NextResponse.json({ mode, ref, webhookUrl: webhookUrl ?? null, vtu })
        }

        if (body.action === 'status') {
            const ref = String(body.ref ?? '').trim()
            if (!ref) return NextResponse.json({ error: 'Missing reference.' }, { status: 400 })
            const vtu = await queryTransaction(ref)
            return NextResponse.json({ mode, ref, vtu })
        }

        return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
    } catch (err) {
        if (err instanceof VtuConfigError) {
            return NextResponse.json({ error: err.message }, { status: 500 })
        }
        console.error('[airtime-to-cash] request failed', err)
        // TEST PAGE: show the real cause (e.g. a timeout or a TLS error) so it
        // can be fixed; trim this to a generic message before real users see it.
        const e = err as Error & { cause?: { code?: string; message?: string } }
        return NextResponse.json({
            error: 'Could not reach VTUAfrica. Try again.',
            detail: `${e?.message ?? String(err)}${e?.cause ? ` — ${e.cause.code ?? ''} ${e.cause.message ?? ''}` : ''}`.trim(),
        }, { status: 502 })
    }
}
