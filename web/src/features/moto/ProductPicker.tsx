import { useId, useMemo, useState } from 'react'
import { useT } from '@/i18n'
import { Icon, Input } from '@/components'
import { searchProducts } from '@/lib/catalog'
import type { Product } from '@/lib/catalog'
import { formatAmount } from '@/lib/money'
import { useCatalog } from '@/features/products/useCatalog'

type Props = { onPick: (product: Product) => void }

/** Autocomplete over the local catalogue; Enter adds the highlighted (or first) result. */
export function ProductPicker({ onPick }: Props) {
  const t = useT()
  const [products] = useCatalog()
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()
  const results = useMemo(() => searchProducts(products, text), [products, text])
  const empty = products.length === 0

  const pick = (p: Product) => {
    onPick(p)
    setText('')
    setActive(0)
  }

  return (
    <div style={{ position: 'relative' }}>
      <Input
        label={t('items.productSearch')}
        placeholder={t('items.productSearch')}
        hint={
          empty
            ? t('items.productSearch.hint').replace('Phase 6', 'Produkte')
            : text.trim()
              ? undefined
              : t('items.productSearch.hintCatalog')
        }
        disabled={empty}
        value={text}
        autoComplete="off"
        role="combobox"
        aria-expanded={results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={(e) => {
          setText(e.target.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(results.length - 1, a + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            const p = results[active] ?? results[0]
            if (p) pick(p)
          } else if (e.key === 'Escape') {
            setText('')
          }
        }}
        trailing={
          <span className="field__trailing" aria-hidden="true">
            <Icon name="search" />
          </span>
        }
      />
      {text.trim() && !empty && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t('items.productSearch.results')}
          className="result-list-ul product-picker__list"
        >
          {results.length === 0 && (
            <li className="small muted" style={{ padding: '10px 12px' }}>
              {t('items.productSearch.none')}
            </li>
          )}
          {results.map((p, i) => (
            <li key={p.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={['result-row', i === active ? 'is-active' : ''].join(' ').trim()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(p)}
              >
                <span className="result-row__name">
                  {p.name}
                  {p.sku && <span className="small muted"> · {p.sku}</span>}
                </span>
                <span className="result-row__meta small tnum">{formatAmount(p.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
