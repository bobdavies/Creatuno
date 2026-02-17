'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cacheData, getCachedData } from '@/lib/offline/indexed-db'
import { useNetworkStatus } from './use-network-status'

interface UseCachedFetchOptions {
  /** Custom cache key (defaults to the URL) */
  cacheKey?: string
  /** Time-to-live in milliseconds (default 30 min) */
  ttlMs?: number
  /** Whether this fetch is enabled (default true) */
  enabled?: boolean
  /** Dependencies array — refetch when these change */
  deps?: unknown[]
}

interface UseCachedFetchReturn<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  isFromCache: boolean
  refresh: () => void
}

const DEFAULT_TTL = 30 * 60 * 1000 // 30 minutes

/**
 * Generic hook that wraps fetch with IndexedDB caching.
 *
 * Behavior:
 * 1. On mount: immediately return cached data from IndexedDB (if exists and not expired)
 * 2. If online: fetch from network, update cache, update state
 * 3. If offline: return cached data only (stale is better than nothing)
 * 4. Expose `refresh()` for manual refetch
 */
export function useCachedFetch<T = unknown>(
  url: string | null,
  options: UseCachedFetchOptions = {}
): UseCachedFetchReturn<T> {
  const {
    cacheKey,
    ttlMs = DEFAULT_TTL,
    enabled = true,
    deps = [],
  } = options

  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFromCache, setIsFromCache] = useState(false)
  const { isOnline } = useNetworkStatus()
  const abortRef = useRef<AbortController | null>(null)

  // Stable cache key derived from URL
  const resolvedCacheKey = cacheKey || url || ''

  const fetchData = useCallback(
    async (isRefresh = false) => {
      if (!url || !enabled) {
        setIsLoading(false)
        return
      }

      // Use a split key — "api" is the table, the resolved key is the id
      const cacheTable = 'api'
      const cacheId = resolvedCacheKey

      try {
        // Step 1: Try to serve cached data immediately (not on refresh)
        if (!isRefresh) {
          try {
            const cached = await getCachedData(cacheTable, cacheId)
            if (cached && cached.payload !== undefined) {
              setData(cached.payload as T)
              setIsFromCache(true)
              setIsLoading(false)
              // If online, continue to revalidate in background
              // If offline, we're done
              if (!navigator.onLine) return
            }
          } catch {
            // IndexedDB may fail — continue to network
          }
        }

        // Step 2: If online, fetch from network
        if (!navigator.onLine) {
          // Already set cached data above if available
          setIsLoading(false)
          if (!data) {
            setError('You are offline and no cached data is available')
          }
          return
        }

        // Cancel previous in-flight request
        abortRef.current?.abort()
        const controller = new AbortController()
        abortRef.current = controller

        if (!data && !isRefresh) {
          setIsLoading(true)
        }

        const response = await fetch(url, { signal: controller.signal })

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`)
        }

        const freshData = await response.json()
        setData(freshData as T)
        setIsFromCache(false)
        setError(null)
        setIsLoading(false)

        // Step 3: Update IndexedDB cache
        try {
          await cacheData(cacheTable, cacheId, { payload: freshData }, ttlMs)
        } catch {
          // Cache write failed — not critical
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return

        const msg = err instanceof Error ? err.message : 'Unknown error'
        setError(msg)
        setIsLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [url, enabled, resolvedCacheKey, ttlMs, isOnline]
  )

  // Initial fetch + deps-triggered refetch
  useEffect(() => {
    fetchData()
    return () => {
      abortRef.current?.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, ...deps])

  // Refetch when coming back online
  useEffect(() => {
    if (isOnline && isFromCache && url && enabled) {
      fetchData(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  const refresh = useCallback(() => {
    fetchData(true)
  }, [fetchData])

  return { data, isLoading, error, isFromCache, refresh }
}
