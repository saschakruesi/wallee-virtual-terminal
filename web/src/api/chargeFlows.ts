import { request } from './client'
import type { ApiCredentials } from './client'
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
