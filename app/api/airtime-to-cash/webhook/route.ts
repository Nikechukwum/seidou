import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// POST /api/airtime-to-cash/webhook — VTUAfrica's final-status notification.
// ----------------------------------------------------------------------------
// VTUAfrica docs: "For your account on VTU Africa to be successfully funded,
// you will have to supply a valid webhook response such as "code":"101" or
// "status":"Completed"". So this MUST answer with that body, or the VTUAfrica
// wallet may not be credited.
//
// TEST PHASE: it only logs the payload (visible in the Vercel function logs)
// and acknowledges it. It does NOT credit anything in Seidou. VTUAfrica does
// not sign webhooks, so before this is ever used to credit users, the payload
// must be confirmed with queryTransaction(ref) first — anyone can POST here.
// ============================================================================

export async function POST(request: NextRequest) {
    let payload: unknown = null
    try {
        const text = await request.text()
        try {
            payload = JSON.parse(text)
        } catch {
            payload = Object.fromEntries(new URLSearchParams(text))
        }
    } catch {
        // an unreadable body still gets acknowledged below
    }
    console.log('[airtime-to-cash/webhook] received', payload)
    return NextResponse.json({ code: 101, status: 'Completed', message: 'Received' })
}
