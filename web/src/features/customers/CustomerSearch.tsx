import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useT } from '@/i18n'
import { Button, Icon, Input, Spinner } from '@/components'
import type { ApiCredentials } from '@/api/client'
import { customerDisplayName } from '@/api/customers'
import type { Customer } from '@/api/customers'
import { describeApiError } from '@/features/setup/errorMessages'
import { useCustomerSearch } from './useCustomerSearch'

type Props = {
  creds: ApiCredentials
  onSelect: (customer: Customer) => void
  autoFocus?: boolean
  /** Rendered below the search box (links such as "create new customer"). */
  footer?: ReactNode
  /** Controlled text (optional). */
  text?: string
  onTextChange?: (text: string) => void
  inputId?: string
}

/** Search box + result list, used in the wizard and on the customers screen. */
export function CustomerSearch({
  creds,
  onSelect,
  autoFocus,
  footer,
  text,
  onTextChange,
  inputId,
}: Props) {
  const t = useT()
  const [inner, setInner] = useState('')
  const value = text ?? inner
  const setValue = (v: string) => (onTextChange ? onTextChange(v) : setInner(v))
  const { results, hasMore, loading, error, tooShort, loadMore } = useCustomerSearch(creds, value)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  return (
    <div className="stack">
      <Input
        ref={inputRef}
        id={inputId}
        label={t('customer.search')}
        placeholder={t('customers.search.placeholder')}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value)
          setActive(-1)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(results.length - 1, a + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(-1, a - 1))
          } else if (e.key === 'Enter') {
            const pick = results[active] ?? (results.length === 1 ? results[0] : undefined)
            if (pick) {
              e.preventDefault()
              e.stopPropagation()
              onSelect(pick)
            }
          }
        }}
        trailing={
          loading ? (
            <span className="field__trailing">
              <Spinner size="sm" />
            </span>
          ) : (
            <span className="field__trailing" aria-hidden="true">
              <Icon name="search" />
            </span>
          )
        }
        hint={tooShort && value.trim() ? t('customer.searchMin') : undefined}
        aria-autocomplete="list"
        aria-controls={`${inputId ?? 'customer-search'}-results`}
      />
      {error != null && (
        <div className="field__error" role="alert">
          {t('customer.searchError', {
            message: describeApiError(error, t, { spaceId: creds.spaceId }),
          })}
        </div>
      )}
      {!tooShort && !loading && results.length === 0 && error == null && (
        <p className="small muted">{t('customer.noResults')}</p>
      )}
      {results.length > 0 && (
        <ul
          id={`${inputId ?? 'customer-search'}-results`}
          className="result-list-ul"
          role="listbox"
          aria-label={t('customer.results')}
        >
          {results.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={['result-row', i === active ? 'is-active' : ''].join(' ').trim()}
                onClick={() => onSelect(c)}
              >
                <span className="result-row__name">{customerDisplayName(c, '—')}</span>
                <span className="result-row__meta small muted">
                  {c.emailAddress}
                  {c.customerId && ` · ${c.customerId}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <div>
          <Button variant="text" onClick={loadMore} loading={loading}>
            {t('customers.more')}
          </Button>
        </div>
      )}
      {footer}
    </div>
  )
}
