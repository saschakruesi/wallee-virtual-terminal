import { useEffect, useRef } from 'react'
import { useT } from '@/i18n'
import { Button, Icon, StatusBadge } from '@/components'
import { formatAmount, formatMoney } from '@/lib/money'
import type { AppConfig } from '@/lib/storage'
import { customerLabel } from './draft'
import type { Draft, Totals } from './draft'

type Props = {
  draft: Draft
  totals: Totals
  config: AppConfig
  creating: boolean
  error: string | null
  onStart: () => void
  onEdit: (step: 0 | 1 | 2) => void
}

/** Step 3: summary (customer left, items right), test-environment hint, one big primary button. */
export function ReviewStep({ draft, totals, config, creating, error, onStart, onEdit }: Props) {
  const t = useT()
  const buttonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    buttonRef.current?.focus()
  }, [])
  const c = draft.customer
  const address = [c.street, [c.postcode, c.city].filter(Boolean).join(' '), c.country]
    .filter((s) => s && s.trim())
    .join(', ')

  return (
    <div className="stack">
      <div className="sg-grid" style={{ gridTemplateColumns: '2fr 3fr', gap: 'var(--s-4)' }}>
        <section>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              {t('review.customer')}
            </h2>
            <Button variant="text" onClick={() => onEdit(0)}>
              {t('customer.change')}
            </Button>
          </div>
          <p style={{ marginTop: 'var(--s-1)' }}>{customerLabel(c, t('customer.none'))}</p>
          {c.organizationName && (c.givenName || c.familyName) && (
            <p className="small muted">{c.organizationName}</p>
          )}
          {c.emailAddress && c.emailAddress !== customerLabel(c, '') && (
            <p className="small muted">{c.emailAddress}</p>
          )}
          {address && <p className="small muted">{address}</p>}
        </section>
        <section>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              {t('review.items')}
            </h2>
            <Button variant="text" onClick={() => onEdit(1)}>
              {t('customer.change')}
            </Button>
          </div>
          <table className="table" style={{ marginTop: 'var(--s-1)' }}>
            <tbody>
              {draft.items.map((it) => (
                <tr key={it.id}>
                  <td>
                    {it.name}
                    <span className="small muted"> · {t(`items.type.${it.type}`)}</span>
                  </td>
                  <td className="is-right tnum small muted">
                    {it.quantity} × {formatAmount(it.unitPrice ?? 0)}
                  </td>
                  <td className="is-right tnum">
                    {formatAmount(totals.lines.find((l) => l.id === it.id)?.total ?? 0, {
                      negativeInParens: true,
                    })}
                  </td>
                </tr>
              ))}
              {totals.discountAmount > 0 && (
                <tr>
                  <td>{t('items.discount')}</td>
                  <td />
                  <td className="is-right tnum">
                    {formatAmount(-totals.discountAmount, { negativeInParens: true })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{ textAlign: 'right', marginTop: 'var(--s-2)' }}>
            <div className="small muted">{t('items.total.label')}</div>
            <div className="display-amount">{formatMoney(totals.total, draft.currency)}</div>
            <div className="small muted tnum">
              {draft.reference}
              {draft.note && ` · ${draft.note}`}
            </div>
          </div>
        </section>
      </div>

      <div className="row" style={{ justifyContent: 'space-between' }}>
        {config.environment === 'PREVIEW' ? (
          <span className="row" style={{ gap: 6 }}>
            <StatusBadge status="test" label={t('review.testHint')} />
          </span>
        ) : (
          <span />
        )}
        <span className="small muted">
          {t('review.env.' + config.environment)} · {config.spaceName ?? config.spaceId}
        </span>
      </div>

      {error && (
        <div
          className="banner"
          role="alert"
          style={{ borderRadius: 'var(--r-sm)', padding: '12px 16px' }}
        >
          <Icon name="warning" />
          <div>{error}</div>
        </div>
      )}

      <Button ref={buttonRef} size="lg" block loading={creating} onClick={onStart}>
        {creating
          ? t('review.creating')
          : draft.mode === 'MOTO'
            ? t('review.startMoto')
            : t('review.startLink', { email: c.emailAddress })}
      </Button>
    </div>
  )
}
