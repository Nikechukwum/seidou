// ============================================================================
// VTUAFRICA — Airtime to Cash (server-only helper). Chosen provider.
// ----------------------------------------------------------------------------
// Docs: https://vtuafrica.com.ng/api/airtime2cash.php
//
// The flow:
//   1. verifyAirtime2Cash(network)  -> is the service up? + the phone number
//                                      the user must send the airtime TO.
//   2. the user transfers the EXACT amount of airtime from their own phone
//      (they keep their SIM PIN to themselves — Seidou never sees it).
//   3. convertAirtime(...)          -> tells VTUAfrica the airtime was sent.
//   4. queryTransaction(ref) / webhook -> the final status; the cash lands in
//                                      the VTUAfrica wallet (then any bank).
//
// WARNING (from the docs): calling convert repeatedly WITHOUT having sent the
// airtime gets the account blocked automatically.
//
// SANDBOX: only convert has a sandbox URL. verify and the status query always
// hit the live system, which rejects a sandbox key ("INVALID ACCOUNT") —
// tested 18 Nov 2026. They need the LIVE key (Reseller account).
//
// Every call is a GET with the parameters in the query string, exactly like
// the docs' PHP samples (same Accept header and a browser User-Agent).
// The API key is read from VTUAFRICA_API_KEY and never leaves the server.
// ============================================================================

export const VTU_NETWORKS = ['mtn', 'airtel', 'glo', '9mobile'] as const
export type VtuNetwork = (typeof VTU_NETWORKS)[number]

const VERIFY_URL = 'https://vtuafrica.com.ng/portal/api/merchant-verify/'
const CONVERT_LIVE_URL = 'https://vtuafrica.com.ng/portal/api/airtime-cash/'
const CONVERT_SANDBOX_URL = 'https://vtuafrica.com.ng/portal/api-test/airtime-cash/'

/** 'live' only when VTUAFRICA_MODE=live is set; anything else is the sandbox. */
export function vtuMode(): 'live' | 'sandbox' {
    return process.env.VTUAFRICA_MODE === 'live' ? 'live' : 'sandbox'
}

export class VtuConfigError extends Error {}

function apiKey(): string {
    const key = process.env.VTUAFRICA_API_KEY
    if (!key) throw new VtuConfigError('VTUAFRICA_API_KEY is not set in .env.local.')
    return key
}

export function isVtuNetwork(value: unknown): value is VtuNetwork {
    return typeof value === 'string' && (VTU_NETWORKS as readonly string[]).includes(value)
}

/** A unique reference for every conversion (the docs require one per call). */
export function newVtuRef(): string {
    return `A2C${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`
}

/** VTUAfrica answers code 101 when a call succeeded. */
export type VtuResponse = {
    code?: number | string
    description?: Record<string, unknown>
    [key: string]: unknown
}

async function vtuGet(url: string, params: Record<string, string>): Promise<VtuResponse> {
    const qs = new URLSearchParams(params).toString()
    const res = await fetch(`${url}?${qs}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
    })
    const text = await res.text()
    try {
        return JSON.parse(text) as VtuResponse
    } catch {
        // Not JSON (an HTML error page, a block notice, ...): hand it back as-is
        // so the test page shows exactly what VTUAfrica said.
        return { code: res.status, description: { raw: text.slice(0, 2000) } }
    }
}

/** Step 1 — is Airtime2Cash available on this network? Returns the number to send airtime to. */
export function verifyAirtime2Cash(network: VtuNetwork) {
    return vtuGet(VERIFY_URL, { apikey: apiKey(), serviceName: 'Airtime2Cash', network })
}

/** Step 3 — only AFTER the airtime has really been sent to `sitePhone`. */
export function convertAirtime(args: {
    network: VtuNetwork
    /** Who to credit on our side (the user's email). */
    sender: string
    /** The phone number the airtime was sent FROM. */
    senderNumber: string
    amount: number
    ref: string
    /** The number from step 1 the airtime was sent TO. */
    sitePhone?: string
    webhookUrl?: string
}) {
    const params: Record<string, string> = {
        apikey: apiKey(),
        network: args.network,
        sender: args.sender,
        sendernumber: args.senderNumber,
        amount: String(args.amount),
        ref: args.ref,
    }
    if (args.sitePhone) params.sitephone = args.sitePhone
    if (args.webhookUrl) params.webhookURL = args.webhookUrl
    return vtuGet(vtuMode() === 'live' ? CONVERT_LIVE_URL : CONVERT_SANDBOX_URL, params)
}

/** Step 4 — the status of a conversion by its reference. */
export function queryTransaction(ref: string) {
    return vtuGet(VERIFY_URL, { apikey: apiKey(), serviceName: 'Transaction', ref })
}
