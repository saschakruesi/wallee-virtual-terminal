/** Subset of wallee v2.0 models used by the app (see https://app-wallee.com/api/spec3.json). */

export type SpaceState =
  'CREATE' | 'ACTIVE' | 'INACTIVE' | 'DELETING' | 'DELETED' | 'RESTRICTED_ACTIVE'

export type Space = {
  id: number
  name?: string
  state?: SpaceState
  primaryCurrency?: string
  timeZone?: string
  version?: number
  account?: number
}

export type ChargeFlowState = 'CREATE' | 'ACTIVE' | 'INACTIVE' | 'DELETING' | 'DELETED'

export type ChargeFlow = {
  id: number
  name?: string
  state?: ChargeFlowState
  priority?: number
  linkedSpaceId?: number
  version?: number
}

/** Paginated list envelope used by wallee list/search endpoints. */
export type ListResponse<T> = {
  data: T[]
  hasMore?: boolean
  limit?: number
  offset?: number
}

/** Error body (`RestApiErrorResponse` / `ClientError`). */
export type RestApiErrorBody = {
  code?: string
  message?: string
  defaultMessage?: string
  date?: string
  id?: string
  type?: string
  details?: unknown
}
