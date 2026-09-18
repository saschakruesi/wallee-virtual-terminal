import { request } from './client'
import type { ApiCredentials } from './client'

export type TransactionState =
  | 'CREATE'
  | 'PENDING'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'FAILED'
  | 'AUTHORIZED'
  | 'VOIDED'
  | 'COMPLETED'
  | 'FULFILL'
  | 'DECLINE'

export type CustomersPresence = 'NOT_PRESENT' | 'VIRTUAL_PRESENT' | 'PHYSICAL_PRESENT'
export type LineItemType = 'PRODUCT' | 'DISCOUNT' | 'FEE' | 'SHIPPING' | 'TIP'
export type EnvironmentSelectionStrategy =
  'FORCE_TEST_ENVIRONMENT' | 'FORCE_PRODUCTION_ENVIRONMENT' | 'USE_CONFIGURATION'
export type TransactionCompletionBehavior =
  'COMPLETE_IMMEDIATELY' | 'COMPLETE_DEFERRED' | 'USE_CONFIGURATION'

export type TaxCreate = { title: string; rate: number }

export type LineItemCreate = {
  uniqueId: string
  type: LineItemType
  name: string
  sku?: string
  quantity: number
  /** Line total including tax (quantity × unit price), max two decimals. */
  amountIncludingTax: number
  taxes?: TaxCreate[]
}

export type AddressCreate = {
  givenName?: string
  familyName?: string
  organizationName?: string
  street?: string
  postcode?: string
  city?: string
  country?: string
  emailAddress?: string
  phoneNumber?: string
}

/** `Transaction.Create` (docs/02-wallee-api.md §3). */
export type TransactionCreate = {
  currency: string
  language: string
  merchantReference: string
  invoiceMerchantReference?: string
  customerId?: string
  customerEmailAddress?: string
  customersPresence: CustomersPresence
  environmentSelectionStrategy: EnvironmentSelectionStrategy
  completionBehavior: TransactionCompletionBehavior
  autoConfirmationEnabled: boolean
  chargeRetryEnabled: boolean
  billingAddress?: AddressCreate
  lineItems: LineItemCreate[]
  metaData: Record<string, string>
}

export type LineItem = {
  uniqueId?: string
  type?: LineItemType
  name?: string
  sku?: string
  quantity?: number
  amountIncludingTax?: number
  amountExcludingTax?: number
  taxAmount?: number
  unitPriceIncludingTax?: number
  taxes?: { title?: string; rate?: number }[]
}

export type Address = AddressCreate

export type FailureReason = {
  id?: number
  description?: Record<string, string> | string
  category?: string
}

export type Transaction = {
  id: number
  version?: number
  state: TransactionState
  currency?: string
  language?: string
  merchantReference?: string
  authorizationAmount?: number
  completedAmount?: number
  customerEmailAddress?: string
  customerId?: string
  customersPresence?: CustomersPresence
  completionBehavior?: TransactionCompletionBehavior
  chargeRetryEnabled?: boolean
  billingAddress?: Address
  lineItems?: LineItem[]
  metaData?: Record<string, string>
  createdOn?: string
  confirmedOn?: string
  processingOn?: string
  authorizedOn?: string
  completedOn?: string
  failedOn?: string
  userFailureMessage?: string
  failureReason?: FailureReason
  paymentConnectorConfiguration?: { name?: string }
}

export type RenderedDocument = {
  data: string
  mimeType?: string
  title?: string
  documentTemplateType?: unknown
}

export type Label = {
  contentAsString?: string
  content?: unknown
  descriptor?: { name?: string; id?: number }
}

export type ChargeAttempt = {
  id?: number
  state?: string
  labels?: Label[]
  userFailureMessage?: string
  failureReason?: FailureReason
}

export type PaymentMethodConfiguration = { id?: number; name?: string; state?: string }

const base = '/payment/transactions'
const tx = (id: number | string) => `${base}/${encodeURIComponent(String(id))}`

/** `POST /payment/transactions?expand=lineItems` → 201 Transaction. */
export function createTransaction(
  creds: ApiCredentials,
  payload: TransactionCreate,
): Promise<Transaction> {
  return request<Transaction>(creds, 'POST', base, { body: payload, expand: ['lineItems'] })
}

/** `GET /payment/transactions/{id}` — used for polling. */
export function getTransaction(
  creds: ApiCredentials,
  id: number | string,
  signal?: AbortSignal,
): Promise<Transaction> {
  return request<Transaction>(creds, 'GET', tx(id), { expand: ['lineItems'], signal })
}

/** `GET …/payment-page-url` → text/plain URL. */
export function getPaymentPageUrl(creds: ApiCredentials, id: number | string): Promise<string> {
  return request<string>(creds, 'GET', `${tx(id)}/payment-page-url`, { accept: 'text' }).then((s) =>
    s.trim(),
  )
}

/** `POST …/void-online` — only when state = AUTHORIZED. */
export function voidOnline(creds: ApiCredentials, id: number | string): Promise<unknown> {
  return request<unknown>(creds, 'POST', `${tx(id)}/void-online`)
}

/** `POST …/complete-online` — captures an AUTHORIZED transaction (COMPLETE_DEFERRED). */
export function completeOnline(creds: ApiCredentials, id: number | string): Promise<unknown> {
  return request<unknown>(creds, 'POST', `${tx(id)}/complete-online`)
}

/** `GET …/invoice-document` → RenderedDocument (base64 PDF). */
export function getInvoiceDocument(
  creds: ApiCredentials,
  id: number | string,
): Promise<RenderedDocument> {
  return request<RenderedDocument>(creds, 'GET', `${tx(id)}/invoice-document`)
}

/** `GET …/successful-charge-attempt` — optional card details for the result screen. */
export function getSuccessfulChargeAttempt(
  creds: ApiCredentials,
  id: number | string,
): Promise<ChargeAttempt | undefined> {
  return request<ChargeAttempt | undefined>(creds, 'GET', `${tx(id)}/successful-charge-attempt`)
}

/** `GET …/payment-method-configurations?integrationMode=PAYMENT_PAGE` — empty ⇒ no MOTO method. */
export function getPaymentMethodConfigurations(
  creds: ApiCredentials,
  id: number | string,
): Promise<PaymentMethodConfiguration[]> {
  return request<PaymentMethodConfiguration[] | { data?: PaymentMethodConfiguration[] }>(
    creds,
    'GET',
    `${tx(id)}/payment-method-configurations`,
    {
      query: { integrationMode: 'PAYMENT_PAGE' },
    },
  ).then((res) => (Array.isArray(res) ? res : (res?.data ?? [])))
}

/* ---------- State helpers shared by MOTO, payment link and history ---------- */

export const TERMINAL_STATES: TransactionState[] = ['FULFILL', 'FAILED', 'DECLINE', 'VOIDED']

export function isTerminal(state: TransactionState): boolean {
  return TERMINAL_STATES.includes(state)
}

export function isPaid(state: TransactionState): boolean {
  return state === 'COMPLETED' || state === 'FULFILL'
}

export function isFailed(state: TransactionState): boolean {
  return state === 'FAILED' || state === 'DECLINE'
}

/** Extracts a human failure message from a transaction, preferring the user-facing text. */
export function failureMessage(t: Transaction, lang: string): string | undefined {
  if (t.userFailureMessage) return t.userFailureMessage
  const d = t.failureReason?.description
  if (!d) return undefined
  if (typeof d === 'string') return d
  const key = Object.keys(d).find((k) => k.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)))
  return (key && d[key]) || d['en-US'] || Object.values(d)[0]
}
