import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, UserRole } from '@/types/database'
import type { PayoutDestination } from '@/lib/monime'

type AdminClient = SupabaseClient<Database>

export type WalletEntryType = 'credit' | 'debit' | 'hold' | 'release' | 'adjustment'
export type WalletSourceType = 'delivery_escrow' | 'pitch_investment' | 'cashout_request' | 'system_adjustment'

export interface PaymentProfile {
  payment_provider: string | null
  payment_provider_id: string | null
  payment_account: string | null
}

export interface WalletMutationInput {
  userId: string
  currency: string
  availableDelta: number
  pendingDelta: number
  entryType: WalletEntryType
  amount: number
  sourceType: WalletSourceType
  sourceId: string | null
  idempotencyKey?: string | null
  metadata?: Record<string, unknown>
}

export function isCashoutEligibleRole(role: UserRole | null | undefined): role is 'creative' | 'mentor' {
  return role === 'creative' || role === 'mentor'
}

export function maskAccount(value: string | null | undefined): string {
  if (!value) return '****'
  if (value.length <= 4) return `****${value}`
  return `****${value.slice(-4)}`
}

export function toWalletCurrency(value: string | null | undefined): string {
  return (value || 'SLE').toUpperCase()
}

export function buildWalletIdempotencyKey(parts: Array<string | number | null | undefined>): string {
  const payload = parts.map(p => String(p ?? '')).join('|')
  return createHash('sha256').update(payload).digest('hex')
}

export function buildPayoutDestinationFromProfile(profile: PaymentProfile): PayoutDestination | null {
  if (!profile.payment_provider || !profile.payment_provider_id || !profile.payment_account) {
    return null
  }

  const destination: PayoutDestination = {
    type: profile.payment_provider as 'momo' | 'bank' | 'wallet',
    providerId: profile.payment_provider_id,
  }

  if (profile.payment_provider === 'momo') {
    destination.phoneNumber = profile.payment_account
  } else if (profile.payment_provider === 'bank') {
    destination.accountNumber = profile.payment_account
  } else if (profile.payment_provider === 'wallet') {
    destination.walletId = profile.payment_account
  } else {
    return null
  }

  return destination
}

export async function applyWalletMutation(supabase: AdminClient, input: WalletMutationInput): Promise<string> {
  const { data, error } = await supabase.rpc('wallet_apply_mutation', {
    p_user_id: input.userId,
    p_currency: toWalletCurrency(input.currency),
    p_available_delta: input.availableDelta,
    p_pending_delta: input.pendingDelta,
    p_entry_type: input.entryType,
    p_amount: input.amount,
    p_source_type: input.sourceType,
    p_source_id: input.sourceId,
    p_idempotency_key: input.idempotencyKey || null,
    p_metadata: input.metadata || {},
  })

  if (error) {
    throw new Error(`wallet mutation failed: ${error.message}`)
  }

  if (!data) {
    throw new Error('wallet mutation failed: no ledger id returned')
  }

  return data
}

export async function creditWalletForSource(
  supabase: AdminClient,
  userId: string,
  currency: string,
  amount: number,
  sourceType: Extract<WalletSourceType, 'delivery_escrow' | 'pitch_investment'>,
  sourceId: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const idempotencyKey = buildWalletIdempotencyKey([
    'wallet-credit',
    sourceType,
    sourceId,
    userId,
    toWalletCurrency(currency),
    amount.toFixed(2),
  ])

  return applyWalletMutation(supabase, {
    userId,
    currency,
    availableDelta: amount,
    pendingDelta: 0,
    entryType: 'credit',
    amount,
    sourceType,
    sourceId,
    idempotencyKey,
    metadata,
  })
}
