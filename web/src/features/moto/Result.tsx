import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { Icon } from '@/components'

export type ResultLabel = { contentAsString?: string; descriptor?: { name?: string } }

/** Big icon + title + amount + actions on the turquoise surface (shared by MOTO and payment link). */
export function Result({
  icon,
  tone,
  title,
  text,
  amount,
  labels,
  children,
}: {
  icon: 'check' | 'warning' | 'close'
  tone: 'ok' | 'failed' | 'muted'
  title: string
  text?: string
  amount?: string
  labels?: ResultLabel[]
  children?: ReactNode
}) {
  const { t } = useI18n()
  return (
    <div
      className="stack"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-3)',
        alignItems: 'flex-start',
      }}
    >
      <span
        className={[
          'result-icon',
          tone === 'failed' ? 'result-icon--failed' : tone === 'muted' ? 'result-icon--muted' : '',
        ]
          .join(' ')
          .trim()}
        aria-hidden="true"
      >
        <Icon name={icon} />
      </span>
      <div className="result-title" role="status">
        {title}
      </div>
      {amount && <div className="display-amount">{amount}</div>}
      {text && (
        <p className="statement" style={{ fontSize: 17 }}>
          {text}
        </p>
      )}
      {labels && labels.length > 0 && (
        <dl className="summary-list">
          <dt>{t('moto.cardDetails')}</dt>
          <dd>{labels.map((l) => `${l.descriptor?.name}: ${l.contentAsString}`).join(' · ')}</dd>
        </dl>
      )}
      <div className="row" style={{ marginTop: 'var(--s-2)' }}>
        {children}
      </div>
    </div>
  )
}

export function NewTransactionButton({ secondary }: { secondary?: boolean }) {
  const { t } = useI18n()
  return (
    <Link
      to="/"
      className={['btn', secondary ? 'btn--secondary' : 'btn--primary', secondary ? '' : 'btn--lg']
        .join(' ')
        .trim()}
      style={{ textDecoration: 'none' }}
    >
      {t('moto.newTransaction')}
    </Link>
  )
}
