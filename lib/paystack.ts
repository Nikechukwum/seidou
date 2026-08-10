'use client'

type PaystackSuccessResponse = {
  reference: string
  trans?: string
  transaction?: string
  status?: string
  message?: string
}

export type PaystackConfig = {
  key: string
  email: string
  amount: number // amount in kobo (Paystack uses the lowest currency unit)
  currency?: string
  reference: string
  metadata?: Record<string, unknown>
  channels?: string[]
}

type PaystackCallbacks = {
  onSuccess: (reference: string) => void
  onCancel?: () => void
}

declare global {
  interface Window {
    PaystackPop?: {
      setup(options: {
        key: string
        email: string
        amount: number
        currency: string
        ref: string
        metadata?: Record<string, unknown>
        channels?: string[]
        callback: (response: PaystackSuccessResponse) => void
        onClose: () => void
      }): { openIframe(): void }
    }
  }
}

const PAYSTACK_INLINE_URL = 'https://js.paystack.co/v1/inline.js'

let scriptLoadPromise: Promise<void> | null = null

/**
 * Loads the Paystack inline.js script once and caches the promise so
 * subsequent calls reuse the already-loaded global `window.PaystackPop`.
 */
function loadPaystackScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.PaystackPop) return Promise.resolve()
  if (scriptLoadPromise) return scriptLoadPromise

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${PAYSTACK_INLINE_URL}"]`
    )
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Paystack script.')))
      return
    }

    const script = document.createElement('script')
    script.src = PAYSTACK_INLINE_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoadPromise = null
      reject(new Error('Failed to load Paystack script.'))
    }
    document.head.appendChild(script)
  })

  return scriptLoadPromise
}

/**
 * Generates a unique, human-readable Paystack reference for a deposit.
 * Example: seidou_dep_<userId>_<epochMillis>
 */
export function generateDepositReference(userId: string): string {
  return `seidou_dep_${userId}_${Date.now()}`
}

/**
 * Initializes the Paystack payment modal and wires up the success/cancel
 * callbacks. Resolves once the modal has been opened; use the `onSuccess`
 * callback (not the resolved promise) to react to a completed payment.
 */
export async function initializePaystack(
  config: PaystackConfig,
  callbacks: PaystackCallbacks
): Promise<void> {
  if (!config.key) {
    throw new Error('Paystack public key is missing.')
  }
  if (!config.email) {
    throw new Error('A customer email is required for payment.')
  }
  if (!config.amount || config.amount <= 0) {
    throw new Error('A valid amount is required for payment.')
  }
  if (!config.reference) {
    throw new Error('A reference is required for payment.')
  }

  await loadPaystackScript()

  if (!window.PaystackPop) {
    throw new Error('Paystack failed to initialize.')
  }

  const handler = window.PaystackPop.setup({
    key: config.key,
    email: config.email,
    amount: config.amount,
    currency: config.currency ?? 'NGN',
    ref: config.reference,
    metadata: config.metadata,
    channels: config.channels,
    callback: (response) => callbacks.onSuccess(response.reference || config.reference),
    onClose: () => callbacks.onCancel?.(),
  })

  handler.openIframe()
}
