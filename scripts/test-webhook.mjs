/**
 * Simulate Monime webhook events locally for development testing.
 *
 * Usage:
 *   node scripts/test-webhook.mjs checkout_completed <escrow_id>
 *   node scripts/test-webhook.mjs payout_completed <payout_id>
 *   node scripts/test-webhook.mjs payout_failed <payout_id>
 *
 * This sends a properly signed webhook payload to your local
 * /api/payments/webhook endpoint, simulating what Monime sends.
 */

import { createHmac, randomUUID } from 'crypto'
import { readFileSync } from 'fs'

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
  } catch { /* ignore */ }
}

loadEnv()

const [, , eventType, objectId] = process.argv
const secret = process.env.MONIME_WEBHOOK_SECRET
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

if (!eventType || !objectId) {
  console.log('Usage: node scripts/test-webhook.mjs <event_type> <object_id>')
  console.log('')
  console.log('Event types:')
  console.log('  checkout_completed  <escrow_id>   - Simulate successful payment')
  console.log('  payout_completed    <payout_id>   - Simulate payout sent')
  console.log('  payout_failed       <payout_id>   - Simulate payout failure')
  process.exit(1)
}

if (!secret) {
  console.error('MONIME_WEBHOOK_SECRET not found in env.')
  process.exit(1)
}

const payloads = {
  checkout_completed: {
    event: { name: 'checkout_session.completed', id: `evt-${randomUUID()}` },
    object: { id: `cs-${randomUUID()}`, type: 'checkout_session' },
    data: {
      status: 'completed',
      metadata: { escrow_id: objectId },
    },
  },
  payout_completed: {
    event: { name: 'payout.completed', id: `evt-${randomUUID()}` },
    object: { id: objectId, type: 'payout' },
    data: { status: 'completed' },
  },
  payout_failed: {
    event: { name: 'payout.failed', id: `evt-${randomUUID()}` },
    object: { id: objectId, type: 'payout' },
    data: {
      status: 'failed',
      failureDetail: {
        code: 'INSUFFICIENT_FUNDS',
        message: 'Simulated payout failure for testing',
      },
    },
  },
}

const payload = payloads[eventType]
if (!payload) {
  console.error(`Unknown event type: ${eventType}`)
  console.error('Valid types: checkout_completed, payout_completed, payout_failed')
  process.exit(1)
}

const rawBody = JSON.stringify(payload)
const signature = createHmac('sha256', secret).update(rawBody).digest('hex')

const webhookUrl = `${appUrl}/api/payments/webhook`

console.log(`Sending ${eventType} webhook to ${webhookUrl}`)
console.log(`Object ID: ${objectId}`)
console.log('')

try {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-monime-signature': signature,
    },
    body: rawBody,
  })

  const data = await res.text()
  console.log(`Response: ${res.status} ${res.statusText}`)
  console.log(data)
} catch (err) {
  console.error('Failed to send webhook:', err.message)
  console.error('Make sure your dev server is running (npm run dev)')
}
