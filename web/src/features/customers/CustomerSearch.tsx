import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useT } from '@/i18n'
import { Button, Icon, Input, Spinner } from '@/components'
import type { ApiCredentials } from '@/api/client'
import { customerDisplayName } from '@/api/customers'
import type { Customer } from '@/api/customers'
import { describeApiError } from '@/features/setup/errorMessages'
import { readRecentCustomers } from '@/lib/storage'
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
  /**
   * `inline` (default): results are listed below the box, as on the customers screen.
   * `dropdown`: results open as a popover under the box (wizard); with an empty box the
   * customers picked most recently are suggested.
   */
  variant?: 'inline' | 'dropdown'
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
  variant = 'inline',
}: Props) {
  const t = useT()
  const [inner, setInner] = useState('')
  const value = text ?? inner
  const setValue = (v: string) => (onTextChange ? onTextChange(v) : setInner(v))
  const { results, hasMore, loading, error, tooShort, loadMore } = useCustomerSearch(creds, value)
  const [active, setActive] = useState(-1)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdown = variant === 'dropdown'
  const listId = `${inputId ?? 'customer-search'}-results`

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Suggestions for an empty box: the customers used most recently (dropdown only).
  const recent = dropdown && !value.trim() ? readRecentCustomers() : []
  const suggestions: Customer[] = recent.length > 0 && results.length === 0 ? recent : results
  const open = dropdown && focused
  const pick = (c: Customer) => {
    setActive(-1)
    onSelect(c)
  }

  const tooShortHint = tooShort && value.trim() ? t('customer.searchMin') : undefined
  const noResults = !tooShort && !loading && results.length === 0 && error == null
  const errorText =
    error != null
      ? t('customer.searchError', {
          message: describeApiError(error, t, { spaceId: creds.spaceId }),
        })
      : null

  const options = suggestions.map((c, i) => (
    <li key={c.id}>
      <button
        type="button"
        role="option"
        aria-selected={i === active}
        className={['result-row', i === active ? 'is-active' : ''].join(' ').trim()}
        onMouseDown={dropdown ? (e) => e.preventDefault() : undefined}
        onClick={() => pick(c)}
      >
        <span className="result-row__name">{customerDisplayName(c, '—')}</span>
        <span className="result-row__meta small muted">
          {c.emailAddress}
          {c.customerId && ` · ${c.customerId}`}
        </span>
      </button>
    </li>
  ))

  const more = hasMore && (
    <Button
      variant="text"
      onClick={loadMore}
      loading={loading}
      onMouseDown={dropdown ? (e) => e.preventDefault() : undefined}
    >
      {t('customers.more')}
    </Button>
  )

  const showList = dropdown
    ? open &&
      (suggestions.length > 0 || tooShortHint || loading || noResults || errorText || hasMore)
    : results.length > 0

  const list = showList && (
    <ul id={listId} className="result-list-ul" role="listbox" aria-label={t('customer.results')}>
      {dropdown && recent.length > 0 && results.length === 0 && (
        <li className="result-list__heading" role="presentation">
          {t('customer.recent')}
        </li>
      )}
      {dropdown && tooShortHint && (
        <li className="result-list__note small muted">{tooShortHint}</li>
      )}
      {dropdown && errorText && (
        <li className="result-list__note field__error" role="alert">
          {errorText}
        </li>
      )}
      {dropdown && loading && results.length === 0 && (
        <li className="result-list__note small muted">{t('customer.searching')}</li>
      )}
      {dropdown && noResults && !tooShortHint && (
        <li className="result-list__note small muted">{t('customer.noResults')}</li>
      )}
      {options}
      {dropdown && more && <li className="result-list__note">{more}</li>}
    </ul>
  )

  return (
    <div className="stack">
      <Input
        ref={inputRef}
        id={inputId}
        label={t('customer.search')}
        placeholder={t('customers.search.placeholder')}
        value={value}
        autoComplete="off"
        role={dropdown ? 'combobox' : undefined}
        aria-expanded={dropdown ? Boolean(showList) : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setValue(e.target.value)
          setActive(-1)
          setFocused(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setFocused(true)
            setActive((a) => Math.min(suggestions.length - 1, a + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(-1, a - 1))
          } else if (e.key === 'Enter') {
            const chosen =
              suggestions[active] ?? (suggestions.length === 1 ? suggestions[0] : undefined)
            if (chosen) {
              e.preventDefault()
              e.stopPropagation()
              pick(chosen)
            }
          } else if (e.key === 'Escape' && dropdown) {
            if (value) setValue('')
            else setFocused(false)
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
        hint={dropdown ? undefined : tooShortHint}
        aria-autocomplete="list"
        aria-controls={listId}
        dropdown={dropdown ? list : undefined}
      />
      {!dropdown && errorText && (
        <div className="field__error" role="alert">
          {errorText}
        </div>
      )}
      {!dropdown && noResults && <p className="small muted">{t('customer.noResults')}</p>}
      {!dropdown && list}
      {!dropdown && more && <div>{more}</div>}
      {footer}
    </div>
  )
}
