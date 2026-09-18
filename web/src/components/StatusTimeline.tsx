import { Fragment } from 'react'
import { useT } from '@/i18n'
import type { Transaction } from '@/api/transactions'
import { buildTimeline } from './timeline'
import { Icon } from './Icon'

function formatTime(iso?: string, lang?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(lang === 'en' ? 'en-GB' : 'de-CH', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

type Props = {
  transaction: Transaction
  mode: 'MOTO' | 'LINK'
  failureText?: string
  lang?: string
}

/** Horizontal chain of circles: done = black with check, current = turquoise, open = grey. */
export function StatusTimeline({ transaction, mode, failureText, lang }: Props) {
  const t = useT()
  const { steps, end } = buildTimeline(transaction, { mode }, t)
  return (
    <ol className="timeline" aria-label={t('timeline.label')}>
      {steps.map((s, i) => (
        <Fragment key={s.key}>
          <li
            className={`timeline__step is-${s.status}`}
            aria-current={s.status === 'current' ? 'step' : undefined}
          >
            <span className="timeline__circle" aria-hidden="true">
              {s.status === 'done' ? <Icon name="check" size="sm" /> : i + 1}
            </span>
            <span className="timeline__label">{s.label}</span>
            <span className="timeline__time tnum">{formatTime(s.timestamp, lang)}</span>
          </li>
          {i < steps.length - 1 && <li className="timeline__line" aria-hidden="true" />}
        </Fragment>
      ))}
      {end && (
        <>
          <li className="timeline__line" aria-hidden="true" />
          <li className={`timeline__step timeline__step--end is-${end.kind}`} aria-current="step">
            <span className="timeline__circle" aria-hidden="true">
              <Icon name={end.kind === 'failed' ? 'warning' : 'close'} size="sm" />
            </span>
            <span className="timeline__label">
              {end.kind === 'failed' ? t('timeline.failed') : t('timeline.cancelled')}
            </span>
            <span className="timeline__time tnum">
              {failureText ?? formatTime(transaction.failedOn, lang)}
            </span>
          </li>
        </>
      )}
    </ol>
  )
}
