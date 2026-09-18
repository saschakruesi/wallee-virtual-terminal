import { useRef, useState } from 'react'
import { useT } from '@/i18n'
import {
  Button,
  EmptyState,
  Headline,
  Icon,
  Input,
  MoneyInput,
  Select,
  useToast,
} from '@/components'
import { newProduct, sampleProducts } from '@/lib/catalog'
import type { Product, ProductType } from '@/lib/catalog'
import { SWISS_TAX_RATES } from '@/features/moto/draft'
import { useCatalog } from './useCatalog'
import { CatalogTransfer } from './CatalogTransfer'

const TYPES: ProductType[] = ['PRODUCT', 'FEE', 'SHIPPING']

/** `#/products` — local catalogue with inline editing, duplicate, delete with undo, import/export. */
export function ProductsPage() {
  const t = useT()
  const toast = useToast()
  const [products, setProducts] = useCatalog()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const nameRefs = useRef(new Map<string, HTMLInputElement>())

  const update = (id: string, patch: Partial<Product>) => {
    setProducts((list) =>
      list.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)),
    )
    if (patch.name !== undefined)
      setErrors((e) => ({ ...e, [id]: patch.name?.trim() ? '' : t('products.nameRequired') }))
  }

  const add = (partial: Partial<Product> = {}) => {
    const p = newProduct(partial)
    setProducts((list) => [...list, p])
    setTimeout(() => nameRefs.current.get(p.id)?.focus(), 0)
  }

  const duplicate = (p: Product) =>
    add({ ...p, id: undefined, name: `${p.name} ${t('products.copySuffix')}`.trim() })

  const remove = (p: Product) => {
    const index = products.findIndex((x) => x.id === p.id)
    setProducts((list) => list.filter((x) => x.id !== p.id))
    toast.show({
      kind: 'info',
      message: t('products.deleted', { name: p.name || '—' }),
      durationMs: 8000,
      action: {
        label: t('products.undo'),
        onClick: () =>
          setProducts((list) => {
            const next = [...list]
            next.splice(Math.min(index, next.length), 0, p)
            return next
          }),
      },
    })
  }

  const taxOptions = SWISS_TAX_RATES.map((r) => ({ value: String(r), label: `${r} %` }))

  return (
    <>
      <Headline
        kicker={t('headline.products.kicker')}
        title={t('headline.products.title')}
        actions={
          <Button icon={<Icon name="plus" />} onClick={() => add()}>
            {t('products.new')}
          </Button>
        }
      />
      <p className="infobox" style={{ maxWidth: 720, marginBottom: 'var(--s-3)' }}>
        {t('products.hint')}
      </p>

      {products.length === 0 ? (
        <EmptyState
          title={t('products.empty')}
          text={t('products.emptyText')}
          action={
            <div className="row">
              <Button onClick={() => add()}>{t('products.new')}</Button>
              <Button variant="text" onClick={() => setProducts(sampleProducts())}>
                {t('products.samples')}
              </Button>
            </div>
          }
        />
      ) : (
        <div className="table-wrap">
          <table className="table items-table">
            <thead>
              <tr>
                <th scope="col">{t('products.col.name')}</th>
                <th scope="col" style={{ width: 120 }}>
                  {t('products.col.sku')}
                </th>
                <th scope="col" style={{ width: 170 }} className="is-right">
                  {t('products.col.price')}
                </th>
                <th scope="col" style={{ width: 110 }}>
                  {t('products.col.tax')}
                </th>
                <th scope="col" style={{ width: 130 }}>
                  {t('products.col.type')}
                </th>
                <th scope="col" style={{ width: 70 }} className="is-center">
                  {t('products.col.active')}
                </th>
                <th scope="col" style={{ width: 96 }}>
                  <span className="visually-hidden">{t('history.col.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <Input
                      ref={(el) => {
                        if (el) nameRefs.current.set(p.id, el)
                        else nameRefs.current.delete(p.id)
                      }}
                      aria-label={`${t('products.col.name')} ${i + 1}`}
                      value={p.name}
                      onChange={(e) => update(p.id, { name: e.target.value })}
                      error={errors[p.id] || undefined}
                    />
                  </td>
                  <td>
                    <Input
                      aria-label={`${t('products.col.sku')} ${i + 1}`}
                      value={p.sku ?? ''}
                      onChange={(e) => update(p.id, { sku: e.target.value || undefined })}
                    />
                  </td>
                  <td>
                    <MoneyInput
                      aria-label={`${t('products.col.price')} ${i + 1}`}
                      value={p.price}
                      onChange={(v) => update(p.id, { price: v ?? 0 })}
                    />
                  </td>
                  <td>
                    <Select
                      aria-label={`${t('products.col.tax')} ${i + 1}`}
                      value={String(p.taxRate)}
                      onChange={(e) => update(p.id, { taxRate: Number(e.target.value) })}
                      options={
                        taxOptions.some((o) => o.value === String(p.taxRate))
                          ? taxOptions
                          : [...taxOptions, { value: String(p.taxRate), label: `${p.taxRate} %` }]
                      }
                    />
                  </td>
                  <td>
                    <Select
                      aria-label={`${t('products.col.type')} ${i + 1}`}
                      value={p.type}
                      onChange={(e) => update(p.id, { type: e.target.value as ProductType })}
                      options={TYPES.map((ty) => ({ value: ty, label: t(`products.type.${ty}`) }))}
                    />
                  </td>
                  <td className="is-center">
                    <label className="checkbox" style={{ justifyContent: 'center', marginTop: 12 }}>
                      <input
                        type="checkbox"
                        checked={p.active}
                        onChange={(e) => update(p.id, { active: e.target.checked })}
                        aria-label={`${t('products.col.active')} ${i + 1}`}
                      />
                    </label>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 2, flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        className="items-table__remove"
                        onClick={() => duplicate(p)}
                        aria-label={`${t('products.duplicate')} ${i + 1}`}
                        title={t('products.duplicate')}
                      >
                        <Icon name="copy" size="sm" />
                      </button>
                      <button
                        type="button"
                        className="items-table__remove"
                        onClick={() => remove(p)}
                        aria-label={`${t('products.delete')} ${i + 1}`}
                        title={t('products.delete')}
                      >
                        <Icon name="trash" size="sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="small muted" style={{ marginTop: 'var(--s-1)' }}>
            {t('products.count', { count: products.length })}
          </p>
        </div>
      )}

      <hr className="hairline" />
      <CatalogTransfer />
      <p className="small muted" style={{ marginTop: 'var(--s-1)' }}>
        {t('products.csvHint')}
      </p>
    </>
  )
}
