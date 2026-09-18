import { request } from './client'
import type { ApiCredentials } from './client'
import type { ListResponse } from './types'

/** wallee Customer (subset). `id` is wallee's internal id; `customerId` is the merchant's own number. */
export type Customer = {
  id: number
  version?: number
  customerId?: string
  givenName?: string
  familyName?: string
  emailAddress?: string
  language?: string
  preferredCurrency?: string
  createdOn?: string
  metaData?: Record<string, string>
}

export type CustomerCreate = {
  givenName?: string
  familyName?: string
  emailAddress?: string
  customerId?: string
  language?: string
  preferredCurrency?: string
  metaData?: Record<string, string>
}

export type CustomerUpdate = CustomerCreate & { version: number }

export type PostalAddress = {
  givenName?: string
  familyName?: string
  organizationName?: string
  street?: string
  postcode?: string
  city?: string
  country?: string
  emailAddress?: string
  phoneNumber?: string
  salutation?: string
}

export type CustomerAddressType = 'BILLING' | 'SHIPPING' | 'BOTH'

export type CustomerAddress = {
  id: number
  version?: number
  addressType?: CustomerAddressType
  address?: PostalAddress
  defaultAddress?: boolean
  customer?: number | Customer
  createdOn?: string
}

export type CustomerAddressCreate = {
  customer: number
  addressType: CustomerAddressType
  address: PostalAddress
}

const base = '/customers'
const one = (id: number | string) => `${base}/${encodeURIComponent(String(id))}`

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Free-text search across given name, family name, e-mail and customer number
 * (docs/02-wallee-api.md §3): `(givenName:~"q" OR familyName:~"q" OR emailAddress:~"q" OR customerId:~"q")`.
 */
export function buildCustomerSearchQuery(text: string): string {
  const q = escapeQueryValue(text.trim())
  return `(givenName:~"${q}" OR familyName:~"${q}" OR emailAddress:~"${q}" OR customerId:~"${q}")`
}

export function searchCustomers(
  creds: ApiCredentials,
  text: string,
  options: { limit?: number; offset?: number; signal?: AbortSignal } = {},
): Promise<ListResponse<Customer>> {
  return request<ListResponse<Customer> | Customer[]>(creds, 'GET', `${base}/search`, {
    query: {
      query: buildCustomerSearchQuery(text),
      limit: options.limit ?? 20,
      offset: options.offset || undefined,
      order: 'familyName',
    },
    signal: options.signal,
  }).then((res) => (Array.isArray(res) ? { data: res } : (res ?? { data: [] })))
}

export function getCustomer(creds: ApiCredentials, id: number | string): Promise<Customer> {
  return request<Customer>(creds, 'GET', one(id))
}

/** `POST /customers` → 201. Only non-empty fields are sent. */
export function createCustomer(creds: ApiCredentials, body: CustomerCreate): Promise<Customer> {
  return request<Customer>(creds, 'POST', base, { body: compact(body) })
}

/** `PATCH /customers/{id}` with the current `version` (optimistic locking, 409 on conflict). */
export function updateCustomer(
  creds: ApiCredentials,
  id: number | string,
  body: CustomerUpdate,
): Promise<Customer> {
  return request<Customer>(creds, 'PATCH', one(id), {
    body: { ...compact(body), version: body.version },
  })
}

export function listCustomerAddresses(
  creds: ApiCredentials,
  customerId: number | string,
): Promise<CustomerAddress[]> {
  return request<ListResponse<CustomerAddress> | CustomerAddress[]>(
    creds,
    'GET',
    `${one(customerId)}/addresses`,
  ).then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
}

export function createCustomerAddress(
  creds: ApiCredentials,
  customerId: number | string,
  body: Omit<CustomerAddressCreate, 'customer'>,
): Promise<CustomerAddress> {
  const payload: CustomerAddressCreate = {
    customer: Number(customerId),
    addressType: body.addressType,
    address: compact(body.address),
  }
  return request<CustomerAddress>(creds, 'POST', `${one(customerId)}/addresses`, { body: payload })
}

export function setDefaultCustomerAddress(
  creds: ApiCredentials,
  customerId: number | string,
  addressId: number | string,
): Promise<unknown> {
  return request<unknown>(
    creds,
    'POST',
    `${one(customerId)}/addresses/${encodeURIComponent(String(addressId))}/default`,
  )
}

/** Default billing address: default BILLING/BOTH, else any BILLING/BOTH, else the default address, else the first. */
export function pickBillingAddress(addresses: CustomerAddress[]): CustomerAddress | undefined {
  const billing = addresses.filter((a) => a.addressType === 'BILLING' || a.addressType === 'BOTH')
  return (
    billing.find((a) => a.defaultAddress) ??
    billing[0] ??
    addresses.find((a) => a.defaultAddress) ??
    addresses[0]
  )
}

export function customerDisplayName(c: Customer | undefined, fallback = ''): string {
  if (!c) return fallback
  return (
    [c.givenName, c.familyName]
      .filter((s) => s && s.trim())
      .join(' ')
      .trim() ||
    c.emailAddress ||
    c.customerId ||
    fallback
  )
}

/** Drops empty strings, null and undefined so wallee validates only what was filled in. */
export function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string') {
      if (v.trim() === '') continue
      out[k] = v.trim()
    } else out[k] = v
  }
  return out as T
}
