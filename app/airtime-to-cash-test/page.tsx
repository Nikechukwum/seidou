'use client'

// ============================================================================
// AIRTIME TO CASH — TEST PAGE (/airtime-to-cash-test) — VTUAfrica
// ----------------------------------------------------------------------------
// A step-by-step page for testing VTUAfrica's Airtime-to-Cash API by hand.
// Not linked from the app. Every VTUAfrica answer is shown raw so the result
// can be written up exactly.
//   1. Check     -> is the service up, and which number to send airtime to
//   2. Send      -> the tester transfers the airtime from their own phone
//   3. Convert   -> only after ticking "I have sent the airtime"
//   4. Status    -> query the conversion by its reference
// In SANDBOX mode only step 3 works: VTUAfrica has no sandbox for steps 1 and
// 4, and their live system rejects a sandbox key.
// ============================================================================

import { useState } from 'react'
import { PageLayout } from '@/components/PageLayout'

const NETWORKS = ['mtn', 'airtel', 'glo', '9mobile'] as const

/** The example receiving number from VTUAfrica's docs, for sandbox runs. */
const DOCS_SAMPLE_PHONE = '08124139638'

type ApiResult = { mode?: string; ref?: string; webhookUrl?: string | null; vtu?: Record<string, unknown>; error?: string }

async function call(body: Record<string, unknown>): Promise<ApiResult> {
    try {
        const res = await fetch('/api/airtime-to-cash', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        return await res.json()
    } catch {
        return { error: 'Network error — could not reach the server.' }
    }
}

function Raw({ data }: { data: unknown }) {
    return (
        <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-gray-900 p-3 text-[11px] leading-relaxed text-green-300 whitespace-pre-wrap break-all">
            {JSON.stringify(data, null, 2)}
        </pre>
    )
}

export default function AirtimeToCashTestPage() {
    const [network, setNetwork] = useState<(typeof NETWORKS)[number]>('mtn')
    const [busy, setBusy] = useState(false)

    const [check, setCheck] = useState<ApiResult | null>(null)
    const [sitePhone, setSitePhone] = useState('')

    const [senderNumber, setSenderNumber] = useState('')
    const [amount, setAmount] = useState('1000')
    const [sent, setSent] = useState(false)
    const [convert, setConvert] = useState<ApiResult | null>(null)

    const [ref, setRef] = useState('')
    const [status, setStatus] = useState<ApiResult | null>(null)

    const runCheck = async () => {
        setBusy(true)
        const r = await call({ action: 'check', network })
        setCheck(r)
        const phone = (r.vtu?.description as Record<string, unknown> | undefined)?.Phone_Number
        if (typeof phone === 'string') setSitePhone(phone)
        setBusy(false)
    }

    const runConvert = async () => {
        if (!sent) return
        setBusy(true)
        const r = await call({ action: 'convert', network, senderNumber, amount: Number(amount), sitePhone, airtimeSent: true })
        setConvert(r)
        if (r.ref) setRef(r.ref)
        setSent(false) // a new conversion needs a new confirmation
        setBusy(false)
    }

    const runStatus = async () => {
        setBusy(true)
        setStatus(await call({ action: 'status', ref }))
        setBusy(false)
    }

    const mode = convert?.mode ?? check?.mode ?? status?.mode
    const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black'
    const button = 'w-full rounded-full bg-black py-3 text-sm font-bold text-white disabled:opacity-40'

    return (
        <PageLayout pageTitle="Airtime to Cash (test)" className="px-4 bg-white space-y-6">
            {mode && (
                <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${mode === 'live' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'}`}>
                    Mode: {mode.toUpperCase()} {mode === 'live'
                        ? '— real airtime and real money'
                        : '— VTUAfrica sandbox, no real money. Only step 3 works with a sandbox key; steps 1 and 4 need the live key.'}
                </p>
            )}

            {/* STEP 1 */}
            <section>
                <h2 className="mb-2 font-bold">1. Check the service</h2>
                <select value={network} onChange={(e) => setNetwork(e.target.value as typeof network)} className={input}>
                    {NETWORKS.map((n) => <option key={n} value={n}>{n.toUpperCase()}</option>)}
                </select>
                <button onClick={runCheck} disabled={busy} className={`${button} mt-2`}>Check availability</button>
                {check && <Raw data={check} />}
            </section>

            {/* STEP 2 */}
            <section>
                <h2 className="mb-1 font-bold">2. Send the airtime</h2>
                <p className="mb-2 text-sm text-gray-600">
                    From your phone, transfer the <b>exact</b> amount of {network.toUpperCase()} airtime to the number from step 1.
                </p>
                <label className="mb-1 block text-xs text-gray-500">Number to send to (filled in by step 1)</label>
                <input value={sitePhone} onChange={(e) => setSitePhone(e.target.value)} className={input} placeholder="08xxxxxxxxx" />
                {mode === 'sandbox' && !sitePhone && (
                    <button onClick={() => setSitePhone(DOCS_SAMPLE_PHONE)} className="mt-1 text-xs font-semibold text-blue-600">
                        Sandbox: use the docs&apos; sample number
                    </button>
                )}
            </section>

            {/* STEP 3 */}
            <section>
                <h2 className="mb-2 font-bold">3. Convert</h2>
                <label className="mb-1 block text-xs text-gray-500">Your number (the one you sent the airtime FROM)</label>
                <input value={senderNumber} onChange={(e) => setSenderNumber(e.target.value)} className={input} placeholder="08012345678" inputMode="numeric" />
                <label className="mt-2 mb-1 block text-xs text-gray-500">Amount sent (₦)</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} className={input} inputMode="numeric" />
                <label className="mt-3 flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={sent} onChange={(e) => setSent(e.target.checked)} className="mt-0.5 size-4" />
                    <span>I have <b>already sent</b> the airtime. (VTUAfrica blocks accounts that request conversions without sending airtime.)</span>
                </label>
                <button onClick={runConvert} disabled={busy || !sent} className={`${button} mt-2`}>Convert airtime to cash</button>
                {convert && <Raw data={convert} />}
            </section>

            {/* STEP 4 */}
            <section>
                <h2 className="mb-2 font-bold">4. Check the status</h2>
                <input value={ref} onChange={(e) => setRef(e.target.value)} className={input} placeholder="Reference (filled in by step 3)" />
                <button onClick={runStatus} disabled={busy || !ref} className={`${button} mt-2`}>Check status</button>
                {status && <Raw data={status} />}
            </section>
        </PageLayout>
    )
}
