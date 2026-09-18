import { request } from './client'
import type { ApiCredentials } from './client'
import type { Space } from './types'

/** `GET /spaces/{spaceId}` — used by the connection test. */
export function getSpace(creds: ApiCredentials): Promise<Space> {
  return request<Space>(creds, 'GET', `/spaces/${encodeURIComponent(creds.spaceId)}`)
}
