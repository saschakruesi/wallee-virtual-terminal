/**
 * Wizard state ("draft") for a new transaction, the totals derived from it and the
 * `Transaction.Create` payload builder (docs/02-wallee-api.md §3, docs/03-ui-flows.md).
 * Amounts are integers in minor units (lib/money.ts).
 */
import type { LineItemCreate, LineItemType, TransactionCreate } from '@/api/transactions'
import { multiply, percentOf, sum, taxPortion, toMajor } from '@/lib/money'
import {
  STORAGE_KEYS,
  readJson,
  readUiPrefs,
  removeKey,
  updateUiPrefs,
  writeJson,
} from '@/lib/storage'
import type { AppConfig } from '@/lib/storage'

export type Mode = 'MOTO' | 'LINK'

export type LineItemDraft = {
  id: string
  type: LineItemType
  name: string
  sku?: string
  quantity: number
  /** Unit price incl. tax, minor units, always positive (DISCOUNT is negated when sent). */
  unitPrice: number | null
  /** Tax rate in percent (8.1, 3.8, 2.6, 0). */
  taxRate: number
}

export type CustomerDraft = {
  /** Phase 5 adds `wallee` with a customer id; for now only ad-hoc billing data. */
  mode: 'none'
  customerId?: string
  emailAddress: string
  givenName: string
  familyName: string
  organizationName: string
  street: string
  postcode: string
  city: string
  country: string
}

export type DiscountDraft = { kind: 'amount' | 'percent'; value: number } | null

export type Draft = {
  version: 1
  mode: Mode
  step: 0 | 1 | 2
  customer: CustomerDraft
  items: LineItemDraft[]
  discount: DiscountDraft
  currency: string
  reference: string
  note: string
}

export const SWISS_TAX_RATES = [8.1, 3.8, 2.6, 0] as const
export const LINE_TYPES: LineItemType[] = ['PRODUCT', 'FEE', 'DISCOUNT', 'SHIPPING', 'TIP']

let seq = 0
export function newId(): string {
  seq += 1
  return `${Date.now().toString(36)}-${seq}`
}

export function emptyCustomer(): CustomerDraft {
  return {
    mode: 'none',
    emailAddress: '',
    givenName: '',
    familyName: '',
    organizationName: '',
    street: '',
    postcode: '',
    city: '',
    country: 'CH',
  }
}

export function emptyItem(type: LineItemType = 'PRODUCT'): LineItemDraft {
  return { id: newId(), type, name: '', quantity: 1, unitPrice: null, taxRate: 8.1 }
}

export function newDraft(
  config: Pick<AppConfig, 'currency' | 'merchantReferencePrefix'>,
  mode: Mode = 'MOTO',
): Draft {
  return {
    version: 1,
    mode,
    step: 0,
    customer: emptyCustomer(),
    items: [emptyItem()],
    discount: null,
    currency: config.currency,
    reference: suggestReference(config.merchantReferencePrefix),
    note: '',
  }
}

/* ---------- Merchant reference: <prefix>-<year>-<000001>, counter per prefix in wvt.ui ---------- */

export function suggestReference(prefix: string, now = new Date()): string {
  const counters = readUiPrefs().referenceCounters ?? {}
  const next = (counters[prefix] ?? 0) + 1
  return `${prefix}-${now.getFullYear()}-${String(next).padStart(6, '0')}`
}

/** Call after a transaction was created so the next suggestion advances. */
export function consumeReference(prefix: string, reference: string): void {
  const m = reference.match(/-(\d{1,6})$/)
  const counters = { ...(readUiPrefs().referenceCounters ?? {}) }
  const used = m ? Number(m[1]) : (counters[prefix] ?? 0)
  counters[prefix] = Math.max(counters[prefix] ?? 0, used)
  updateUiPrefs({ referenceCounters: counters })
}

/* ---------- Totals ---------- */

export type LineTotal = { id: string; total: number; tax: number }
export type Totals = {
  lines: LineTotal[]
  subtotal: number
  discountAmount: number
  total: number
  /** Tax contained in the total, grouped by rate (only rates > 0). */
  taxes: { rate: number; amount: number }[]
}

export function lineSign(type: LineItemType): 1 | -1 {
  return type === 'DISCOUNT' ? -1 : 1
}

export function computeTotals(draft: Pick<Draft, 'items' | 'discount'>): Totals {
  const lines: LineTotal[] = draft.items.map((it) => {
    const gross = multiply(it.unitPrice ?? 0, it.quantity) * lineSign(it.type)
    return { id: it.id, total: gross, tax: taxPortion(gross, it.taxRate) }
  })
  const subtotal = sum(lines.map((l) => l.total))
  let discountAmount = 0
  if (draft.discount && draft.discount.value > 0) {
    discountAmount =
      draft.discount.kind === 'percent'
        ? percentOf(subtotal, draft.discount.value)
        : draft.discount.value
  }
  const total = subtotal - discountAmount
  const byRate = new Map<number, number>()
  for (const [i, l] of lines.entries()) {
    const rate = draft.items[i]!.taxRate
    if (rate > 0) byRate.set(rate, (byRate.get(rate) ?? 0) + l.tax)
  }
  const taxes = [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, amount]) => ({ rate, amount }))
  return { lines, subtotal, discountAmount, total, taxes }
}

/* ---------- Validation ---------- */

export type ItemErrors = Partial<Record<'name' | 'quantity' | 'unitPrice', string>>
export type ItemsValidation = { items: Record<string, ItemErrors>; form: string[]; valid: boolean }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateCustomer(
  c: CustomerDraft,
  mode: Mode,
  t: (k: string) => string,
): { emailAddress?: string; valid: boolean } {
  const email = c.emailAddress.trim()
  if (mode === 'LINK' && !email) return { emailAddress: t('customer.email.required'), valid: false }
  if (email && !EMAIL_RE.test(email))
    return { emailAddress: t('customer.email.invalid'), valid: false }
  return { valid: true }
}

export function validateItems(draft: Draft, t: (k: string) => string): ItemsValidation {
  const items: Record<string, ItemErrors> = {}
  const form: string[] = []
  for (const it of draft.items) {
    const e: ItemErrors = {}
    if (!it.name.trim()) e.name = t('items.error.name')
    if (!(it.quantity > 0)) e.quantity = t('items.error.quantity')
    if (it.unitPrice === null || it.unitPrice < 0) e.unitPrice = t('items.error.price')
    if (Object.keys(e).length) items[it.id] = e
  }
  if (draft.items.length === 0) form.push(t('items.error.empty'))
  const totals = computeTotals(draft)
  if (draft.items.length > 0 && Object.keys(items).length === 0 && totals.total <= 0)
    form.push(t('items.error.total'))
  if (draft.discount && draft.discount.kind === 'amount' && draft.discount.value > totals.subtotal)
    form.push(t('items.error.discount'))
  if (!draft.reference.trim() || draft.reference.length > 100) form.push(t('items.error.reference'))
  return { items, form, valid: Object.keys(items).length === 0 && form.length === 0 }
}

/* ---------- Payload ---------- */

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> | undefined {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null)
      out[k] = typeof v === 'string' ? v.trim() : v
  }
  return Object.keys(out).length ? (out as Partial<T>) : undefined
}

export function buildLineItems(
  draft: Pick<Draft, 'items' | 'discount'>,
  t: (k: string, p?: Record<string, string | number>) => string,
): LineItemCreate[] {
  const totals = computeTotals(draft)
  const out: LineItemCreate[] = draft.items.map((it, i) => {
    const line: LineItemCreate = {
      uniqueId: `li-${i + 1}`,
      type: it.type,
      name: it.name.trim(),
      quantity: it.quantity,
      amountIncludingTax: toMajor(totals.lines[i]!.total),
    }
    if (it.sku?.trim()) line.sku = it.sku.trim()
    if (it.taxRate > 0)
      line.taxes = [
        {
          title: t('items.taxIncluded', { rate: it.taxRate }).replace(/^inkl\.\s|^incl\.\s/, ''),
          rate: it.taxRate,
        },
      ]
    return line
  })
  if (totals.discountAmount > 0) {
    out.push({
      uniqueId: `li-${out.length + 1}`,
      type: 'DISCOUNT',
      name:
        draft.discount?.kind === 'percent'
          ? `${t('items.discount')} ${draft.discount.value} %`
          : t('items.discount'),
      quantity: 1,
      amountIncludingTax: toMajor(-totals.discountAmount),
    })
  }
  return out
}

export function buildTransactionCreate(
  draft: Draft,
  config: Pick<AppConfig, 'language' | 'environment' | 'completionBehavior'>,
  t: (k: string, p?: Record<string, string | number>) => string,
  appVersion: string,
): TransactionCreate {
  const c = draft.customer
  const billingAddress = clean({
    givenName: c.givenName,
    familyName: c.familyName,
    organizationName: c.organizationName,
    street: c.street,
    postcode: c.postcode,
    city: c.city,
    country: c.country ? c.country.toUpperCase() : '',
    emailAddress: c.emailAddress,
  })
  const metaData: Record<string, string> = {
    source: 'wallee-virtual-terminal',
    mode: draft.mode,
    appVersion,
  }
  if (draft.note.trim()) metaData.note = draft.note.trim().slice(0, 512)
  const payload: TransactionCreate = {
    currency: draft.currency,
    language: config.language,
    merchantReference: draft.reference.trim(),
    invoiceMerchantReference: draft.reference.trim(),
    customersPresence: draft.mode === 'MOTO' ? 'NOT_PRESENT' : 'VIRTUAL_PRESENT',
    environmentSelectionStrategy:
      config.environment === 'LIVE' ? 'FORCE_PRODUCTION_ENVIRONMENT' : 'FORCE_TEST_ENVIRONMENT',
    completionBehavior: config.completionBehavior,
    autoConfirmationEnabled: true,
    chargeRetryEnabled: true,
    lineItems: buildLineItems(draft, t),
    metaData,
  }
  if (c.customerId) payload.customerId = c.customerId
  if (c.emailAddress.trim()) payload.customerEmailAddress = c.emailAddress.trim()
  if (billingAddress) payload.billingAddress = billingAddress
  return payload
}

/** Short label for lists: name, company or e-mail. */
export function customerLabel(c: CustomerDraft, fallback: string): string {
  const name = [c.givenName, c.familyName]
    .filter((s) => s.trim())
    .join(' ')
    .trim()
  return name || c.organizationName.trim() || c.emailAddress.trim() || fallback
}

/* ---------- Persistence (sessionStorage) ---------- */

export function loadDraft(): Draft | null {
  const d = readJson<Draft | null>(STORAGE_KEYS.draft, null, 'session')
  return d && d.version === 1 && Array.isArray(d.items) ? d : null
}

export function saveDraft(draft: Draft): void {
  writeJson(STORAGE_KEYS.draft, draft, 'session')
}

export function clearDraft(): void {
  removeKey(STORAGE_KEYS.draft, 'session')
}

/** Snapshot of the draft that produced a transaction, for "retry with the same data". */
export function rememberDraftForTransaction(transactionId: number, draft: Draft): void {
  const map = readJson<Record<string, Draft>>(STORAGE_KEYS.draftByTransaction, {}, 'session')
  const entries = Object.entries(map).slice(-20)
  entries.push([String(transactionId), draft])
  writeJson(STORAGE_KEYS.draftByTransaction, Object.fromEntries(entries), 'session')
}

export function draftForTransaction(transactionId: number | string): Draft | null {
  const map = readJson<Record<string, Draft>>(STORAGE_KEYS.draftByTransaction, {}, 'session')
  return map[String(transactionId)] ?? null
}
