/** `wvt.recent`: the last 50 locally started transactions, a cache for the history screen. */
import { STORAGE_KEYS, readJson, writeJson } from './storage'
import type { TransactionState } from '@/api/transactions'

export type RecentMode = 'MOTO' | 'LINK'

export type RecentEntry = {
  transactionId: number
  mode: RecentMode
  createdAt: string
  amount: number
  currency: string
  customerLabel: string
  reference: string
  state?: TransactionState
  /** Set when the employee cancelled locally while the transaction was still pending in wallee. */
  cancelledLocally?: boolean
}

const MAX = 50

export function readRecent(): RecentEntry[] {
  const list = readJson<RecentEntry[]>(STORAGE_KEYS.recent, [])
  return Array.isArray(list) ? list : []
}

export function addRecent(entry: RecentEntry): void {
  const rest = readRecent().filter((e) => e.transactionId !== entry.transactionId)
  writeJson(STORAGE_KEYS.recent, [entry, ...rest].slice(0, MAX))
}

export function updateRecent(transactionId: number, patch: Partial<RecentEntry>): void {
  const list = readRecent()
  const idx = list.findIndex((e) => e.transactionId === transactionId)
  if (idx === -1) return
  list[idx] = { ...list[idx]!, ...patch }
  writeJson(STORAGE_KEYS.recent, list)
}

export function findRecent(transactionId: number): RecentEntry | undefined {
  return readRecent().find((e) => e.transactionId === transactionId)
}
