import { randomUUID } from 'crypto'
import { createHmac } from 'crypto'

const MONIME_API_BASE = 'https://api.monime.io'
const MONIME_API_VERSION = 'caph.2025-08-23'

function getConfig() {
  const token = process.env.MONIME_ACCESS_TOKEN
  const spaceId = process.env.MONIME_SPACE_ID
  const financialAccountId = process.env.MONIME_FINANCIAL_ACCOUNT_ID
  const webhookSecret = process.env.MONIME_WEBHOOK_SECRET

  if (!token || !spaceId) {
    throw new Error('Monime credentials not configured. Set MONIME_ACCESS_TOKEN and MONIME_SPACE_ID.')
  }

  return { token, spaceId, financialAccountId, webhookSecret }
}

function baseHeaders(idempotencyKey?: string) {
  const { token, spaceId } = getConfig()
  return {
    'Authorization': `Bearer ${token}`,
    'Monime-Space-Id': spaceId,
    'Monime-Version': MONIME_API_VERSION,
    'Idempotency-Key': idempotencyKey || randomUUID(),
    'Content-Type': 'application/json',
  }
}

/** Convert a decimal SLE amount to minor units (cents) */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100)
}

/** Convert minor units (cents) back to SLE decimal */
export function fromMinorUnits(value: number): number {
  return value / 100
}

// Provider ID mapping for reference
export const MONIME_PROVIDERS = {
  ORANGE_MONEY: { id: 'm17', name: 'Orange Money', type: 'momo' as const },
  AFRIMONEY: { id: 'm18', name: 'Afrimoney', type: 'momo' as const },
  SAFULPAY: { id: 'dw001', name: 'SafulPay', type: 'wallet' as const },
  SLCB: { id: 'slb001', name: 'Sierra Leone Commercial Bank', type: 'bank' as const },
  ROKEL: { id: 'slb004', name: 'Rokel Commercial Bank', type: 'bank' as const },
  ZENITH: { id: 'slb007', name: 'Zenith Bank SL', type: 'bank' as const },
} as const

export type ProviderType = 'momo' | 'bank' | 'wallet'

export interface CheckoutSessionParams {
  name: string
  description?: string
  amount: number
  currency?: string
  reference?: string
  metadata?: Record<string, string>
  successUrl: string
  cancelUrl: string
  idempotencyKey?: string
}

export interface CheckoutSessionResult {
  id: string
  status: string
  redirectUrl: string
  orderNumber?: string
}

export interface PayoutDestination {
  type: ProviderType
  providerId: string
  phoneNumber?: string
  accountNumber?: string
  walletId?: string
}

export interface PayoutParams {
  amount: number
  currency?: string
  destination: PayoutDestination
  metadata?: Record<string, string>
  idempotencyKey?: string
}

export interface PayoutResult {
  id: string
  status: string
  amount: { currency: string; value: number }
}

/**
 * Create a Monime Checkout Session.
 * Redirects the employer to Monime's hosted payment page.
 */
export async function createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
  const { financialAccountId } = getConfig()

  const body: Record<string, unknown> = {
    name: params.name,
    description: params.description,
    successUrl: params.successUrl,
    cancelUrl: params.cancelUrl,
    lineItems: [
      {
        type: 'custom',
        name: params.name,
        price: {
          currency: params.currency || 'SLE',
          value: toMinorUnits(params.amount),
        },
        quantity: 1,
      },
    ],
    reference: params.reference,
    metadata: params.metadata,
    brandingOptions: {
      primaryColor: '#7C3AED', // Creatuno brand purple
    },
  }

  if (financialAccountId) {
    body.financialAccountId = financialAccountId
  }

  const res = await fetch(`${MONIME_API_BASE}/v1/checkout-sessions`, {
    method: 'POST',
    headers: baseHeaders(params.idempotencyKey),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Monime checkout session creation failed (${res.status}): ${errorText}`)
  }

  const data = await res.json()
  const result = data?.result

  return {
    id: result?.id,
    status: result?.status,
    redirectUrl: result?.redirectUrl,
    orderNumber: result?.orderNumber,
  }
}

/**
 * Retrieve a Checkout Session by ID to verify its status.
 */
export async function getCheckoutSession(sessionId: string) {
  const { token, spaceId } = getConfig()

  const res = await fetch(`${MONIME_API_BASE}/v1/checkout-sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Monime-Space-Id': spaceId,
      'Monime-Version': MONIME_API_VERSION,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Monime get checkout session failed (${res.status}): ${errorText}`)
  }

  const data = await res.json()
  return data?.result
}

/**
 * Create a Monime Payout to disburse funds to the creative.
 */
export async function createPayout(params: PayoutParams): Promise<PayoutResult> {
  const dest = params.destination

  const destination: Record<string, unknown> = {
    type: dest.type,
    providerId: dest.providerId,
  }

  if (dest.type === 'momo' && dest.phoneNumber) {
    destination.phoneNumber = dest.phoneNumber
  } else if (dest.type === 'bank' && dest.accountNumber) {
    destination.accountNumber = dest.accountNumber
  } else if (dest.type === 'wallet' && dest.walletId) {
    destination.walletId = dest.walletId
  }

  const body = {
    amount: {
      currency: params.currency || 'SLE',
      value: toMinorUnits(params.amount),
    },
    destination,
    metadata: params.metadata,
  }

  const res = await fetch(`${MONIME_API_BASE}/v1/payouts`, {
    method: 'POST',
    headers: baseHeaders(params.idempotencyKey),
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Monime payout creation failed (${res.status}): ${errorText}`)
  }

  const data = await res.json()
  const result = data?.result

  return {
    id: result?.id,
    status: result?.status,
    amount: result?.amount,
  }
}

/**
 * Retrieve a Payout by ID.
 */
export async function getPayoutStatus(payoutId: string) {
  const { token, spaceId } = getConfig()

  const res = await fetch(`${MONIME_API_BASE}/v1/payouts/${payoutId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Monime-Space-Id': spaceId,
      'Monime-Version': MONIME_API_VERSION,
    },
  })

  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`Monime get payout failed (${res.status}): ${errorText}`)
  }

  const data = await res.json()
  return data?.result
}

/**
 * Verify Monime webhook HMAC signature.
 * Returns true if the signature is valid.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const { webhookSecret } = getConfig()
  if (!webhookSecret) {
    console.warn('MONIME_WEBHOOK_SECRET not set — skipping signature verification')
    return true
  }

  const computed = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')

  return computed === signature
}
