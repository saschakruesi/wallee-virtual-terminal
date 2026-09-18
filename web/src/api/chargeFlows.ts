import { request } from './client'
import type { ApiCredentials } from './client'
import type { Transaction } from './transactions'
import type { ChargeFlow, ListResponse } from './types'

/** `GET /payment/charge-flows?limit=100` — all charge flows of the space. */
export async function listChargeFlows(creds: ApiCredentials): Promise<ChargeFlow[]> {
  const res = await request<ListResponse<ChargeFlow> | ChargeFlow[]>(
    creds,
    'GET',
    '/payment/charge-flows',
    {
      query: { limit: 100 },
    },
  )
  return Array.isArray(res) ? res : (res?.data ?? [])
}

export function countActiveChargeFlows(flows: ChargeFlow[]): number {
  return flows.filter((f) => f.state === 'ACTIVE').length
}

/* ---------- Payment link (charge flow on a transaction), docs/02-wallee-api.md §3 ---------- */

export type ChargeFlowLevelState = 'PENDING' | 'FAILED' | 'SUCCESSFUL'

export type ChargeFlowLevelConfiguration = {
  id?: number
  name?: string
  /** Id of the ChargeFlowLevelConfigurationType (e.g. e-mail); needed for update-recipient. */
  type?: number
  period?: string
  priority?: number
}

export type ChargeFlowLevel = {
  id: number
  state?: ChargeFlowLevelState
  createdOn?: string
  timeoutOn?: string
  configuration?: ChargeFlowLevelConfiguration | number
  transaction?: Transaction | number
  version?: number
}

const tx = (id: number | string) => `/payment/transactions/${encodeURIComponent(String(id))}`

/** `POST …/charge-flow/apply` — wallee picks the matching flow and starts level 1 (e-mail). */
export function applyChargeFlow(
  creds: ApiCredentials,
  transactionId: number | string,
): Promise<Transaction> {
  return request<Transaction>(creds, 'POST', `${tx(transactionId)}/charge-flow/apply`)
}

/** `GET …/charge-flow/payment-page-url` → text/plain URL for copy & paste. */
export function getChargeFlowPaymentPageUrl(
  creds: ApiCredentials,
  transactionId: number | string,
): Promise<string> {
  return request<string>(creds, 'GET', `${tx(transactionId)}/charge-flow/payment-page-url`, {
    accept: 'text',
  }).then((s) => s.trim())
}

/** `GET /payment/charge-flows/levels/search?query=transaction.id:{id}&expand=configuration`. */
export async function searchChargeFlowLevels(
  creds: ApiCredentials,
  transactionId: number | string,
  signal?: AbortSignal,
): Promise<ChargeFlowLevel[]> {
  const res = await request<ListResponse<ChargeFlowLevel> | ChargeFlowLevel[]>(
    creds,
    'GET',
    '/payment/charge-flows/levels/search',
    {
      query: { query: `transaction.id:${Number(transactionId)}`, limit: 50 },
      expand: ['configuration'],
      signal,
    },
  )
  return Array.isArray(res) ? res : (res?.data ?? [])
}

/** `POST /payment/charge-flows/levels/{levelId}/send-message` → 204. */
export function sendChargeFlowLevelMessage(
  creds: ApiCredentials,
  levelId: number | string,
): Promise<void> {
  return request<void>(
    creds,
    'POST',
    `/payment/charge-flows/levels/${encodeURIComponent(String(levelId))}/send-message`,
  )
}

/** `POST …/charge-flow/update-recipient?type={configurationType}&recipient={email}` → 204. */
export function updateChargeFlowRecipient(
  creds: ApiCredentials,
  transactionId: number | string,
  type: number,
  recipient: string,
): Promise<void> {
  return request<void>(creds, 'POST', `${tx(transactionId)}/charge-flow/update-recipient`, {
    query: { type, recipient },
  })
}

/** `POST …/charge-flow/cancel`. */
export function cancelChargeFlow(
  creds: ApiCredentials,
  transactionId: number | string,
): Promise<Transaction> {
  return request<Transaction>(creds, 'POST', `${tx(transactionId)}/charge-flow/cancel`)
}

/** The level to show: newest pending one, otherwise the newest of any state. */
export function currentLevel(levels: ChargeFlowLevel[]): ChargeFlowLevel | undefined {
  const sorted = [...levels].sort(
    (a, b) => (b.createdOn ?? '').localeCompare(a.createdOn ?? '') || b.id - a.id,
  )
  return sorted.find((l) => l.state === 'PENDING') ?? sorted[0]
}

export function levelConfiguration(
  level: ChargeFlowLevel | undefined,
): ChargeFlowLevelConfiguration | undefined {
  return level && typeof level.configuration === 'object' ? level.configuration : undefined
}

export function isLevelExpired(level: ChargeFlowLevel | undefined, now = Date.now()): boolean {
  if (!level?.timeoutOn) return false
  const ts = new Date(level.timeoutOn).getTime()
  return Number.isFinite(ts) && ts < now && level.state !== 'SUCCESSFUL'
}
