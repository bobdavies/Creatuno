export const SUPPORTED_CURRENCIES = ['SLE', 'USD', 'EUR', 'GBP'] as const

export const DEFAULT_CURRENCY = 'SLE'

const CURRENCY_ALIASES: Record<string, string> = {
  SLL: 'SLE',
}

/**
 * Normalize legacy or aliased currency codes to their current ISO form.
 * Maps SLL (old Sierra Leonean Leone) to SLE (new Leone, post-2022 redenomination).
 */
export function normalizeCurrency(code: string | null | undefined): string {
  if (!code) return DEFAULT_CURRENCY
  const upper = code.toUpperCase().trim()
  return CURRENCY_ALIASES[upper] || upper
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  SLE: 'Le',
  USD: '$',
  EUR: '€',
  GBP: '£',
  NGN: '₦',
  KES: 'KSh',
  ZAR: 'R',
}

/**
 * Format an amount with the appropriate currency symbol/code.
 * Uses Intl.NumberFormat where possible, with fallback for SLE.
 */
export function formatCurrency(amount: number, currency: string = DEFAULT_CURRENCY): string {
  const normalized = normalizeCurrency(currency)

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalized,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    const symbol = CURRENCY_SYMBOLS[normalized] || normalized
    return `${symbol} ${amount.toLocaleString()}`
  }
}

/**
 * Get the display symbol for a currency code.
 */
export function getCurrencySymbol(currency: string = DEFAULT_CURRENCY): string {
  const normalized = normalizeCurrency(currency)
  return CURRENCY_SYMBOLS[normalized] || normalized
}
