import { describe, expect, it } from 'vitest'
import {
  applyConfigDefaults,
  buildLineItems,
  buildTransactionCreate,
  computeTotals,
  consumeReference,
  emptyCustomer,
  newDraft,
  suggestReference,
  validateItems,
} from './draft'
import type { Draft, LineItemDraft } from './draft'
import { translate } from '@/i18n'

const t = (k: string, p?: Record<string, string | number>) => translate('de', k, p)
const item = (over: Partial<LineItemDraft>): LineItemDraft => ({
  id: over.id ?? 'x',
  type: 'PRODUCT',
  name: 'Item',
  quantity: 1,
  unitPrice: 1000,
  taxRate: 8.1,
  ...over,
})

function draft(over: Partial<Draft> = {}): Draft {
  return {
    ...newDraft({ currency: 'CHF', merchantReferencePrefix: 'VT' }),
    reference: 'VT-2026-000001',
    ...over,
  }
}

describe('computeTotals', () => {
  it('sums line totals, applies discounts and groups taxes', () => {
    const d = draft({
      items: [
        item({ id: 'a', name: 'Doppelzimmer', quantity: 1, unitPrice: 48000, taxRate: 3.8 }),
        item({ id: 'b', name: 'Kurtaxe', type: 'FEE', quantity: 2, unitPrice: 700, taxRate: 0 }),
        item({
          id: 'c',
          name: 'Frühbucher',
          type: 'DISCOUNT',
          quantity: 1,
          unitPrice: 2000,
          taxRate: 0,
        }),
        item({ id: 'd', name: 'Minibar', quantity: 3, unitPrice: 450, taxRate: 8.1 }),
      ],
      discount: { kind: 'percent', value: 10 },
    })
    const tt = computeTotals(d)
    expect(tt.lines.map((l) => l.total)).toEqual([48000, 1400, -2000, 1350])
    expect(tt.subtotal).toBe(48750)
    expect(tt.discountAmount).toBe(4875)
    expect(tt.total).toBe(43875)
    expect(tt.taxes).toEqual([
      { rate: 8.1, amount: 101 },
      { rate: 3.8, amount: 1757 },
    ])
  })
  it('handles amount discounts and empty prices', () => {
    const tt = computeTotals({
      items: [item({ unitPrice: null })],
      discount: { kind: 'amount', value: 500 },
    })
    expect(tt.total).toBe(-500)
  })
})

describe('validateItems', () => {
  it('reports missing fields, zero totals and oversized discounts', () => {
    const d = draft({ items: [item({ id: 'a', name: '', quantity: 0, unitPrice: null })] })
    const v = validateItems(d, t)
    expect(v.valid).toBe(false)
    expect(v.items['a']).toEqual({
      name: 'Bezeichnung fehlt',
      quantity: 'Menge > 0',
      unitPrice: 'Preis fehlt',
    })
    expect(validateItems(draft({ items: [] }), t).form).toContain(
      'Mindestens eine Position erfassen.',
    )
    expect(validateItems(draft({ items: [item({ type: 'DISCOUNT' })] }), t).form).toContain(
      'Das Total muss grösser als 0 sein.',
    )
    expect(
      validateItems(draft({ items: [item({})], discount: { kind: 'amount', value: 5000 } }), t)
        .form,
    ).toContain('Rabatt darf das Zwischentotal nicht übersteigen.')
    expect(validateItems(draft({ items: [item({})], reference: '' }), t).form).toContain(
      'Referenz fehlt (max. 100 Zeichen).',
    )
    expect(validateItems(draft({ items: [item({})] }), t).valid).toBe(true)
  })
})

describe('buildLineItems / buildTransactionCreate', () => {
  const d = draft({
    items: [
      item({
        id: 'a',
        name: ' Doppelzimmer 2 Nächte ',
        sku: 'DZ',
        quantity: 1,
        unitPrice: 48000,
        taxRate: 3.8,
      }),
      item({
        id: 'b',
        name: 'Frühbucher',
        type: 'DISCOUNT',
        quantity: 1,
        unitPrice: 2000,
        taxRate: 0,
      }),
      item({ id: 'c', name: 'Kurtaxe', type: 'FEE', quantity: 2, unitPrice: 350, taxRate: 0 }),
    ],
    discount: { kind: 'amount', value: 1000 },
    note: '  Zimmer 12 ',
    customer: {
      ...emptyCustomer(),
      givenName: 'Anna',
      familyName: 'Muster',
      emailAddress: 'gast@example.com',
      country: 'ch',
    },
  })

  it('sends line totals (quantity × unit price), negative discounts, taxes only when rate > 0 and unique ids', () => {
    const lines = buildLineItems(d, t)
    expect(lines).toEqual([
      {
        uniqueId: 'li-1',
        type: 'PRODUCT',
        name: 'Doppelzimmer 2 Nächte',
        sku: 'DZ',
        quantity: 1,
        amountIncludingTax: 480,
        taxes: [{ title: 'MwSt 3.8 %', rate: 3.8 }],
      },
      {
        uniqueId: 'li-2',
        type: 'DISCOUNT',
        name: 'Frühbucher',
        quantity: 1,
        amountIncludingTax: -20,
      },
      { uniqueId: 'li-3', type: 'FEE', name: 'Kurtaxe', quantity: 2, amountIncludingTax: 7 },
      {
        uniqueId: 'li-4',
        type: 'DISCOUNT',
        name: 'Rabatt gesamt',
        quantity: 1,
        amountIncludingTax: -10,
      },
    ])
    const sumOfLines = lines.reduce((a, l) => a + l.amountIncludingTax, 0)
    expect(Math.round(sumOfLines * 100)).toBe(computeTotals(d).total)
  })

  it('builds the MOTO payload with environment, completion, address and metadata', () => {
    const payload = buildTransactionCreate(
      d,
      { language: 'de-CH', environment: 'PREVIEW', completionBehavior: 'COMPLETE_IMMEDIATELY' },
      t,
      '1.2.3',
    )
    expect(payload).toMatchObject({
      currency: 'CHF',
      language: 'de-CH',
      merchantReference: 'VT-2026-000001',
      invoiceMerchantReference: 'VT-2026-000001',
      customerEmailAddress: 'gast@example.com',
      customersPresence: 'NOT_PRESENT',
      environmentSelectionStrategy: 'FORCE_TEST_ENVIRONMENT',
      completionBehavior: 'COMPLETE_IMMEDIATELY',
      autoConfirmationEnabled: true,
      chargeRetryEnabled: true,
      billingAddress: {
        givenName: 'Anna',
        familyName: 'Muster',
        emailAddress: 'gast@example.com',
        country: 'CH',
      },
      metaData: {
        source: 'wallee-virtual-terminal',
        mode: 'MOTO',
        appVersion: '1.2.3',
        note: 'Zimmer 12',
      },
    })
    expect(payload.billingAddress).not.toHaveProperty('street')
    expect(payload).not.toHaveProperty('customerId')
  })

  it('uses production strategy and VIRTUAL_PRESENT for live payment links', () => {
    const payload = buildTransactionCreate(
      { ...d, mode: 'LINK' },
      { language: 'en-US', environment: 'LIVE', completionBehavior: 'USE_CONFIGURATION' },
      t,
      'dev',
    )
    expect(payload.environmentSelectionStrategy).toBe('FORCE_PRODUCTION_ENVIRONMENT')
    expect(payload.customersPresence).toBe('VIRTUAL_PRESENT')
    expect(payload.metaData.mode).toBe('LINK')
  })

  it('omits the billing address when nothing is filled in', () => {
    const payload = buildTransactionCreate(
      draft({ items: [item({})], customer: { ...emptyCustomer(), country: '' } }),
      { language: 'de-CH', environment: 'PREVIEW', completionBehavior: 'COMPLETE_DEFERRED' },
      t,
      'dev',
    )
    expect(payload.billingAddress).toBeUndefined()
    expect(payload.customerEmailAddress).toBeUndefined()
  })
})

describe('reference numbering', () => {
  it('suggests sequential references per prefix and advances after use', () => {
    const now = new Date('2026-09-18T10:00:00Z')
    expect(suggestReference('VT', now)).toBe('VT-2026-000001')
    consumeReference('VT', 'VT-2026-000001')
    expect(suggestReference('VT', now)).toBe('VT-2026-000002')
    consumeReference('VT', 'VT-2026-000010')
    expect(suggestReference('VT', now)).toBe('VT-2026-000011')
    expect(suggestReference('HOTEL', now)).toBe('HOTEL-2026-000001')
  })
})

describe('applyConfigDefaults', () => {
  it('takes currency and reference prefix from the settings unless the employee changed them', () => {
    const d = { ...draft({ items: [item({})] }), currency: 'CHF', reference: 'VT-2026-000001' }
    const applied = applyConfigDefaults(d, { currency: 'EUR', merchantReferencePrefix: 'HOTEL' })
    expect(applied.currency).toBe('EUR')
    expect(applied.reference).toMatch(/^HOTEL-\d{4}-\d{6}$/)
    const touched = applyConfigDefaults(
      { ...d, currencyTouched: true, referenceTouched: true },
      { currency: 'EUR', merchantReferencePrefix: 'HOTEL' },
    )
    expect(touched.currency).toBe('CHF')
    expect(touched.reference).toBe('VT-2026-000001')
    // Same prefix: keep the already suggested number.
    expect(
      applyConfigDefaults(d, { currency: 'CHF', merchantReferencePrefix: 'VT' }).reference,
    ).toBe('VT-2026-000001')
  })
})
