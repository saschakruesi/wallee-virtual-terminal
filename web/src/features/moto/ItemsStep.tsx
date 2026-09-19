import { useRef } from 'react'
import { useT } from '@/i18n'
import { Button, Icon, Input, MoneyInput, Select } from '@/components'
import { formatAmount, formatMoney } from '@/lib/money'
import { CURRENCIES } from '@/lib/storage'
import type { LineItemType } from '@/api/transactions'
import { LINE_TYPES, SWISS_TAX_RATES, emptyItem } from './draft'
import { ProductPicker } from './ProductPicker'
import type { Product } from '@/lib/catalog'
import type { Draft, ItemsValidation, LineItemDraft, Totals } from './draft'

type Props = {
  draft: Draft
  totals: Totals
  validation: ItemsValidation
  showErrors: boolean
  onChange: (patch: Partial<Draft> | ((d: Draft) => Draft)) => void
}

/** Step 2: line items table, overall discount, total with tax breakdown, currency, reference, note. */
export function ItemsStep({ draft, totals, validation, showErrors, onChange }: Props) {
  const t = useT()
  const nameRefs = useRef(new Map<string, HTMLInputElement>())

  const updateItem = (id: string, patch: Partial<LineItemDraft>) =>
    onChange((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }))

  const addItem = (type: LineItemType = 'PRODUCT') => {
    const item = emptyItem(type)
    onChange((d) => ({ ...d, items: [...d.items, item] }))
    setTimeout(() => nameRefs.current.get(item.id)?.focus(), 0)
  }

  const qtyRefs = useRef(new Map<string, HTMLInputElement>())

  /** Adds a catalogue product (quantity 1), replacing an untouched empty first row, then focuses its quantity. */
  const addProduct = (product: Product) => {
    const item = {
      ...emptyItem(product.type),
      name: product.name,
      sku: product.sku,
      unitPrice: product.price,
      taxRate: product.taxRate,
    }
    onChange((d) => {
      const untouched = d.items.length === 1 && !d.items[0]!.name && d.items[0]!.unitPrice === null
      return { ...d, items: untouched ? [item] : [...d.items, item] }
    })
    setTimeout(() => qtyRefs.current.get(item.id)?.focus(), 0)
  }

  const removeItem = (id: string) =>
    onChange((d) => ({ ...d, items: d.items.filter((it) => it.id !== id) }))

  const taxOptions = SWISS_TAX_RATES.map((r) => ({ value: String(r), label: `${r} %` }))
  const errFor = (id: string) => (showErrors ? validation.items[id] : undefined) ?? {}
  const lineTotal = (id: string) => totals.lines.find((l) => l.id === id)?.total ?? 0

  return (
    <div>
      <div className="items-toolbar">
        <ProductPicker onPick={addProduct} />
        <div style={{ paddingBottom: 26 }}>
          <Button variant="secondary" icon={<Icon name="plus" />} onClick={() => addItem()}>
            {t('items.addFree')}
          </Button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table items-table">
          <thead>
            <tr>
              <th scope="col" style={{ width: 130 }}>
                {t('items.type')}
              </th>
              <th scope="col">{t('items.name')}</th>
              <th scope="col" style={{ width: 90 }} className="is-right">
                {t('items.quantity')}
              </th>
              <th scope="col" style={{ width: 170 }} className="is-right">
                {t('items.unitPrice')}
              </th>
              <th scope="col" style={{ width: 110 }}>
                {t('items.taxRate')}
              </th>
              <th scope="col" style={{ width: 130 }} className="is-right">
                {t('items.total')}
              </th>
              <th scope="col" style={{ width: 44 }}>
                <span className="visually-hidden">{t('items.remove')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {draft.items.map((it, i) => (
              <tr key={it.id}>
                <td>
                  <Select
                    aria-label={t('items.type')}
                    value={it.type}
                    onChange={(e) => updateItem(it.id, { type: e.target.value as LineItemType })}
                    options={LINE_TYPES.map((ty) => ({ value: ty, label: t(`items.type.${ty}`) }))}
                  />
                </td>
                <td>
                  <Input
                    ref={(el) => {
                      if (el) nameRefs.current.set(it.id, el)
                      else nameRefs.current.delete(it.id)
                    }}
                    aria-label={`${t('items.name')} ${i + 1}`}
                    value={it.name}
                    autoFocus={i === 0 && !it.name}
                    onChange={(e) => updateItem(it.id, { name: e.target.value })}
                    error={errFor(it.id).name}
                  />
                </td>
                <td>
                  <Input
                    ref={(el) => {
                      if (el) qtyRefs.current.set(it.id, el)
                      else qtyRefs.current.delete(it.id)
                    }}
                    aria-label={`${t('items.quantity')} ${i + 1}`}
                    align="right"
                    inputMode="decimal"
                    value={String(it.quantity)}
                    onChange={(e) => {
                      const q = Number(e.target.value.replace(',', '.'))
                      updateItem(it.id, {
                        quantity: Number.isFinite(q) ? Math.round(q * 1000) / 1000 : 0,
                      })
                    }}
                    onFocus={(e) => e.target.select()}
                    error={errFor(it.id).quantity}
                  />
                </td>
                <td>
                  <MoneyInput
                    aria-label={`${t('items.unitPrice')} ${i + 1}`}
                    value={it.unitPrice}
                    onChange={(v) => updateItem(it.id, { unitPrice: v })}
                    error={errFor(it.id).unitPrice}
                  />
                </td>
                <td>
                  <Select
                    aria-label={t('items.taxRate')}
                    value={String(it.taxRate)}
                    onChange={(e) => updateItem(it.id, { taxRate: Number(e.target.value) })}
                    options={
                      taxOptions.some((o) => o.value === String(it.taxRate))
                        ? taxOptions
                        : [...taxOptions, { value: String(it.taxRate), label: `${it.taxRate} %` }]
                    }
                  />
                </td>
                <td className="is-right is-total tnum">
                  {formatAmount(lineTotal(it.id), { negativeInParens: true })}
                </td>
                <td>
                  <button
                    type="button"
                    className="items-table__remove"
                    onClick={() => removeItem(it.id)}
                    aria-label={`${t('items.remove')} ${i + 1}`}
                  >
                    <Icon name="trash" size="sm" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="totals">
        <div className="stack" style={{ maxWidth: 520 }}>
          <div className="sg-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--s-2)' }}>
            <Select
              label={t('items.discount')}
              value={draft.discount?.kind ?? 'none'}
              onChange={(e) => {
                const kind = e.target.value
                onChange({
                  discount:
                    kind === 'none'
                      ? null
                      : { kind: kind as 'amount' | 'percent', value: draft.discount?.value ?? 0 },
                })
              }}
              options={[
                { value: 'none', label: t('items.discount.none') },
                { value: 'amount', label: t('items.discount.amount') },
                { value: 'percent', label: t('items.discount.percent') },
              ]}
            />
            {draft.discount?.kind === 'amount' && (
              <MoneyInput
                label={t('items.discount.amount')}
                prefix={draft.currency}
                value={draft.discount.value || null}
                onChange={(v) => onChange({ discount: { kind: 'amount', value: v ?? 0 } })}
              />
            )}
            {draft.discount?.kind === 'percent' && (
              <Input
                label={t('items.discount.percent')}
                align="right"
                inputMode="decimal"
                prefix="%"
                value={String(draft.discount.value || '')}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(',', '.'))
                  onChange({
                    discount: {
                      kind: 'percent',
                      value: Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : 0,
                    },
                  })
                }}
              />
            )}
          </div>
          <div className="sg-grid" style={{ gridTemplateColumns: '1fr 2fr', gap: 'var(--s-2)' }}>
            <Select
              label={t('items.currency')}
              value={draft.currency}
              onChange={(e) => onChange({ currency: e.target.value, currencyTouched: true })}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
            <Input
              label={t('items.reference')}
              value={draft.reference}
              maxLength={100}
              onChange={(e) => onChange({ reference: e.target.value, referenceTouched: true })}
            />
          </div>
          <Input
            label={t('items.note')}
            hint={t('items.note.hint')}
            value={draft.note}
            maxLength={512}
            onChange={(e) => onChange({ note: e.target.value })}
          />
          {showErrors && validation.form.length > 0 && (
            <div className="field__error" role="alert">
              {validation.form.map((m) => (
                <div key={m}>{m}</div>
              ))}
            </div>
          )}
        </div>
        <div className="totals__box">
          <div className="small muted">{t('items.total.label')}</div>
          <div className="display-amount">{formatMoney(totals.total, draft.currency)}</div>
          <div className="totals__breakdown">
            {totals.discountAmount > 0 && (
              <>
                <div>
                  <span>{t('items.subtotal')}</span>
                  <span className="tnum">{formatAmount(totals.subtotal)}</span>
                </div>
                <div>
                  <span>{t('items.discount')}</span>
                  <span className="tnum">{formatAmount(-totals.discountAmount)}</span>
                </div>
              </>
            )}
            {totals.taxes.map((tax) => (
              <div key={tax.rate}>
                <span>{t('items.taxIncluded', { rate: tax.rate })}</span>
                <span className="tnum">{formatAmount(tax.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
