import { useEffect, useRef, useState } from 'react'
import type { ApiCredentials } from '@/api/client'
import { isWalleeApiError } from '@/api/client'
import { searchCustomers } from '@/api/customers'
import type { Customer } from '@/api/customers'

export type CustomerSearchState = {
  results: Customer[]
  hasMore: boolean
  loading: boolean
  error: unknown
  /** True when the text is too short to search. */
  tooShort: boolean
  loadMore: () => void
}

export const SEARCH_MIN_CHARS = 2
const DEBOUNCE_MS = 300
const PAGE = 20

/** Debounced wallee customer search with abort on change and simple offset paging. */
export function useCustomerSearch(creds: ApiCredentials, text: string): CustomerSearchState {
  const [results, setResults] = useState<Customer[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [page, setPage] = useState(0)
  const [lastText, setLastText] = useState(text)
  const abortRef = useRef<AbortController | null>(null)

  const trimmed = text.trim()
  const tooShort = trimmed.length < SEARCH_MIN_CHARS

  if (lastText !== text) {
    // Reset paging while the search text changes (state adjustment during render).
    setLastText(text)
    setPage(0)
  }

  useEffect(() => {
    abortRef.current?.abort()
    if (tooShort) return
    const controller = new AbortController()
    abortRef.current = controller
    const timer = setTimeout(
      () => {
        setLoading(true)
        searchCustomers(creds, trimmed, {
          limit: PAGE,
          offset: page * PAGE,
          signal: controller.signal,
        }).then(
          (res) => {
            if (controller.signal.aborted) return
            setResults((prev) => (page === 0 ? res.data : [...prev, ...res.data]))
            setHasMore(Boolean(res.hasMore))
            setError(null)
            setLoading(false)
          },
          (err: unknown) => {
            if (controller.signal.aborted || (isWalleeApiError(err) && err.kind === 'aborted'))
              return
            setError(err)
            setLoading(false)
          },
        )
      },
      page === 0 ? DEBOUNCE_MS : 0,
    )
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [creds, trimmed, tooShort, page])

  return {
    results: tooShort ? [] : results,
    hasMore: !tooShort && hasMore,
    loading: !tooShort && loading,
    error: tooShort ? null : error,
    tooShort,
    loadMore: () => setPage((p) => p + 1),
  }
}
