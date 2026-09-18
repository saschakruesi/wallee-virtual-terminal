import { useCallback, useEffect, useRef, useState } from 'react'
import { getTransaction, isTerminal } from '@/api/transactions'
import type { Transaction } from '@/api/transactions'
import type { ApiCredentials } from '@/api/client'

export type PollingOptions = {
  /** 2 s for the first minute, then 5 s (docs/02-wallee-api.md §3). */
  fastIntervalMs?: number
  slowIntervalMs?: number
  fastPhaseMs?: number
  /** Give up after this long (15 min for MOTO). */
  maxDurationMs?: number
  /** After COMPLETED keep polling this long for FULFILL. */
  completedGraceMs?: number
  /** Start polling immediately (false for pages that only poll on demand). */
  enabled?: boolean
}

export type PollingState = {
  transaction: Transaction | null
  error: unknown
  loading: boolean
  polling: boolean
  lastUpdated: Date | null
  refresh: () => Promise<Transaction | null>
  /** Replace the transaction locally (e.g. after complete-online) and restart polling. */
  setTransaction: (t: Transaction) => void
  stop: () => void
}

type Snapshot = {
  transaction: Transaction | null
  error: unknown
  loading: boolean
  polling: boolean
  lastUpdated: Date | null
}

/**
 * Polls `GET /payment/transactions/{id}` with backoff until a terminal state is reached.
 * Aborts in-flight requests when the component unmounts or the id changes.
 */
export function useTransactionPolling(
  creds: ApiCredentials | null,
  id: string | undefined,
  options: PollingOptions = {},
): PollingState {
  const {
    fastIntervalMs = 2000,
    slowIntervalMs = 5000,
    fastPhaseMs = 60_000,
    maxDurationMs = 15 * 60_000,
    completedGraceMs = 2 * 60_000,
    enabled = true,
  } = options

  const initial = (): Snapshot => ({
    transaction: null,
    error: null,
    loading: true,
    polling: enabled,
    lastUpdated: null,
  })
  const [snap, setSnap] = useState<Snapshot>(initial)
  const [trackedId, setTrackedId] = useState(id)
  if (trackedId !== id) {
    // Adjusting state on prop change (React docs pattern): reset when the route id changes.
    setTrackedId(id)
    setSnap(initial())
  }

  // Mutable bookkeeping that must not trigger renders.
  const box = useRef({
    abort: null as AbortController | null,
    timer: null as ReturnType<typeof setTimeout> | null,
    startedAt: 0,
    completedAt: null as number | null,
    stopped: !enabled,
    mounted: false,
    schedule: (_t: Transaction | null) => {},
  })

  const clearTimer = useCallback(() => {
    const b = box.current
    if (b.timer) clearTimeout(b.timer)
    b.timer = null
  }, [])

  const fetchOnce = useCallback(async (): Promise<Transaction | null> => {
    const b = box.current
    if (!creds || !id) return null
    b.abort?.abort()
    const controller = new AbortController()
    b.abort = controller
    try {
      const t = await getTransaction(creds, id, controller.signal)
      if (!b.mounted || controller.signal.aborted) return null
      if (t.state === 'COMPLETED' && b.completedAt === null) b.completedAt = Date.now()
      setSnap((s) => ({
        ...s,
        transaction: t,
        error: null,
        loading: false,
        lastUpdated: new Date(),
      }))
      return t
    } catch (err) {
      if (!b.mounted || controller.signal.aborted) return null
      setSnap((s) => ({ ...s, error: err, loading: false }))
      return null
    }
  }, [creds, id])

  const schedule = useCallback(
    (t: Transaction | null) => {
      const b = box.current
      clearTimer()
      if (b.stopped || !b.mounted) return
      const elapsed = Date.now() - b.startedAt
      const done =
        (t && isTerminal(t.state)) ||
        (t?.state === 'COMPLETED' &&
          b.completedAt !== null &&
          Date.now() - b.completedAt > completedGraceMs) ||
        elapsed > maxDurationMs
      if (done) {
        b.stopped = true
        setSnap((s) => (s.polling ? { ...s, polling: false } : s))
        return
      }
      const interval = elapsed < fastPhaseMs ? fastIntervalMs : slowIntervalMs
      b.timer = setTimeout(async () => {
        const next = await fetchOnce()
        b.schedule(next ?? t)
      }, interval)
    },
    [
      clearTimer,
      completedGraceMs,
      fastIntervalMs,
      fastPhaseMs,
      fetchOnce,
      maxDurationMs,
      slowIntervalMs,
    ],
  )
  box.current.schedule = schedule

  useEffect(() => {
    const b = box.current
    b.mounted = true
    b.stopped = !enabled
    b.startedAt = Date.now()
    b.completedAt = null
    void fetchOnce().then((t) => {
      if (enabled) b.schedule(t)
    })
    return () => {
      b.mounted = false
      clearTimer()
      b.abort?.abort()
    }
  }, [enabled, fetchOnce, clearTimer, id])

  const resume = useCallback(
    (t: Transaction) => {
      const b = box.current
      if (isTerminal(t.state) || !enabled) return
      b.stopped = false
      b.startedAt = Date.now()
      setSnap((s) => (s.polling ? s : { ...s, polling: true }))
      b.schedule(t)
    },
    [enabled],
  )

  const refresh = useCallback(async () => {
    const t = await fetchOnce()
    // Manual refresh after the polling window ended: run another round.
    if (t && box.current.stopped) resume(t)
    return t
  }, [fetchOnce, resume])

  const setTransaction = useCallback(
    (t: Transaction) => {
      setSnap((s) => ({ ...s, transaction: t, lastUpdated: new Date() }))
      resume(t)
    },
    [resume],
  )

  const stop = useCallback(() => {
    const b = box.current
    b.stopped = true
    clearTimer()
    b.abort?.abort()
    setSnap((s) => (s.polling ? { ...s, polling: false } : s))
  }, [clearTimer])

  return { ...snap, refresh, setTransaction, stop }
}
