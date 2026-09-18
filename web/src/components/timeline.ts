import type { Transaction, TransactionState } from '@/api/transactions'

export type TimelineStep = {
  key: 'created' | 'confirmed' | 'authorized' | 'completed' | 'fulfilled'
  label: string
  timestamp?: string
  status: 'done' | 'current' | 'open'
}

/** Which step index each wallee state reaches (docs/03-ui-flows.md, Transaktionsstatus-Anzeige). */
function reachedIndex(state: TransactionState): number {
  switch (state) {
    case 'CREATE':
    case 'PENDING':
      return 0
    case 'CONFIRMED':
    case 'PROCESSING':
      return 1
    case 'AUTHORIZED':
      return 2
    case 'COMPLETED':
      return 3
    case 'FULFILL':
      return 4
    case 'FAILED':
    case 'DECLINE':
    case 'VOIDED':
      return -1
  }
}

/** Highest step a failed/voided transaction had reached, judged by timestamps. */
function lastReached(t: Transaction): number {
  if (t.completedOn) return 3
  if (t.authorizedOn) return 2
  if (t.confirmedOn || t.processingOn) return 1
  return 0
}

export function buildTimeline(
  t: Transaction,
  labels: { mode: 'MOTO' | 'LINK' },
  tr: (key: string) => string,
): { steps: TimelineStep[]; end?: { kind: 'failed' | 'cancelled'; message?: string } } {
  const defs: { key: TimelineStep['key']; label: string; timestamp?: string }[] = [
    {
      key: 'created',
      label: tr(labels.mode === 'LINK' ? 'timeline.linkSent' : 'timeline.created'),
      timestamp: t.createdOn,
    },
    {
      key: 'confirmed',
      label: tr('timeline.confirmed'),
      timestamp: t.confirmedOn ?? t.processingOn,
    },
    { key: 'authorized', label: tr('timeline.authorized'), timestamp: t.authorizedOn },
    { key: 'completed', label: tr('timeline.completed'), timestamp: t.completedOn },
    {
      key: 'fulfilled',
      label: tr('timeline.fulfilled'),
      timestamp: t.state === 'FULFILL' ? t.completedOn : undefined,
    },
  ]
  const idx = reachedIndex(t.state)
  const ended = idx === -1
  const reached = ended ? lastReached(t) : idx
  const steps: TimelineStep[] = defs.map((d, i) => ({
    ...d,
    status: ended
      ? i <= reached
        ? 'done'
        : 'open'
      : i < reached || t.state === 'FULFILL'
        ? 'done'
        : i === reached
          ? 'current'
          : 'open',
  }))
  const end = ended
    ? { kind: t.state === 'VOIDED' ? ('cancelled' as const) : ('failed' as const) }
    : undefined
  return { steps, end }
}
