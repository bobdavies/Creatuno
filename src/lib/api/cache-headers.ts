import { NextResponse } from 'next/server'

/**
 * Return a JSON response with appropriate Cache-Control headers.
 *
 * @param data   - Response payload
 * @param maxAge - max-age in seconds (browser + SW cache)
 * @param swr    - stale-while-revalidate window in seconds (0 = disabled)
 * @param isPrivate - true for per-user data (adds `private`)
 */
export function cachedJson(
  data: unknown,
  {
    maxAge = 0,
    swr = 0,
    isPrivate = false,
    status = 200,
  }: {
    maxAge?: number
    swr?: number
    isPrivate?: boolean
    status?: number
  } = {}
) {
  const directives: string[] = []

  if (isPrivate) {
    directives.push('private')
  } else {
    directives.push('public')
  }

  directives.push(`max-age=${maxAge}`)

  if (swr > 0) {
    directives.push(`stale-while-revalidate=${swr}`)
  }

  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': directives.join(', '),
    },
  })
}

/** Public, heavily-cached data (stats, public portfolios, mentors list) */
export function publicCachedJson(data: unknown, maxAge = 60, swr = 300) {
  return cachedJson(data, { maxAge, swr })
}

/** Private, short-lived cache (notifications, messages, user-specific) */
export function privateCachedJson(data: unknown, maxAge = 0) {
  return cachedJson(data, { maxAge, isPrivate: true })
}
