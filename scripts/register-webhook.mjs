/**
 * Register a Monime webhook for the Creatuno payment system.
 *
 * Usage:
 *   node scripts/register-webhook.mjs <public-url>
 *
 * Example:
 *   node scripts/register-webhook.mjs https://abc123.loca.lt
 *   node scripts/register-webhook.mjs https://creatuno.com
 *
 * Requires a LIVE token (not test mode) — Monime does not support
 * webhook registration with test tokens.
 *
 * Set these environment variables (or they'll be read from .env.local):
 *   MONIME_ACCESS_TOKEN  — a live (non-test) Monime token
 *   MONIME_SPACE_ID
 *   MONIME_WEBHOOK_SECRET
 */

import { readFileSync } from 'fs'
import { randomUUID } from 'crypto'

function loadEnv() {
  try {
    const content = readFileSync('.env.local', 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIdx = trimmed.indexOf('=')
      if (eqIdx === -1) continue
      const key = trimmed.slice(0, eqIdx).trim()
      const val = trimmed.slice(eqIdx + 1).trim()
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    // .env.local not found — rely on shell env
  }
}

loadEnv()

const publicUrl = process.argv[2]
if (!publicUrl) {
  console.error('Usage: node scripts/register-webhook.mjs <public-url>')
  console.error('  e.g. node scripts/register-webhook.mjs https://abc123.loca.lt')
  process.exit(1)
}

const token = process.env.MONIME_ACCESS_TOKEN
const spaceId = process.env.MONIME_SPACE_ID
const secret = process.env.MONIME_WEBHOOK_SECRET

if (!token || !spaceId || !secret) {
  console.error('Missing env vars. Ensure MONIME_ACCESS_TOKEN, MONIME_SPACE_ID, MONIME_WEBHOOK_SECRET are set.')
  process.exit(1)
}

if (token.startsWith('mon_test_')) {
  console.warn('WARNING: Your token is a test-mode token (mon_test_...).')
  console.warn('Monime does not support webhook registration in test mode.')
  console.warn('You need a live token (mon_...) to register webhooks via the API.')
  console.warn('Alternatively, register the webhook through the Monime dashboard at:')
  console.warn('  https://my.monime.io → your Space → Developer → Webhooks')
  console.warn('')
  console.warn('Attempting anyway in case this restriction has been lifted...')
  console.warn('')
}

const webhookUrl = publicUrl.replace(/\/+$/, '') + '/api/payments/webhook'

console.log('Registering webhook:')
console.log('  URL:', webhookUrl)
console.log('  Events: checkout_session.completed, payout.completed, payout.failed, payout.delayed')
console.log('')

const body = JSON.stringify({
  name: 'Creatuno Payment Webhook',
  url: webhookUrl,
  enabled: true,
  apiRelease: 'caph',
  events: [
    'checkout_session.completed',
    'payout.completed',
    'payout.failed',
    'payout.delayed',
  ],
  verificationMethod: {
    type: 'HS256',
    secret: secret,
  },
})

try {
  const res = await fetch('https://api.monime.io/v1/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Monime-Space-Id': spaceId,
      'Monime-Version': 'caph.2025-08-23',
      'Idempotency-Key': randomUUID(),
      'Content-Type': 'application/json',
    },
    body,
  })

  const data = await res.json()

  if (res.ok) {
    console.log('Webhook registered successfully!')
    console.log('  ID:', data.result?.id || data.id)
    console.log(JSON.stringify(data, null, 2))
  } else {
    console.error('Registration failed:', res.status)
    console.error(JSON.stringify(data, null, 2))

    if (res.status === 403 && data.error?.reason === 'access_denied') {
      console.error('')
      console.error('This is likely because you are using a test-mode token.')
      console.error('Register the webhook manually via the Monime dashboard:')
      console.error('  1. Go to https://my.monime.io')
      console.error('  2. Select your "Creatuno" space')
      console.error('  3. Go to Developer → Webhooks')
      console.error('  4. Create a new webhook with:')
      console.error('     - URL:', webhookUrl)
      console.error('     - Events: checkout_session.completed, payout.completed, payout.failed, payout.delayed')
      console.error('     - Verification: HS256')
      console.error('     - Secret:', secret)
    }
  }
} catch (err) {
  console.error('Network error:', err.message)
}
