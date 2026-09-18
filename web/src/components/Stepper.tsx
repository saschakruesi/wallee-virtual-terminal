import { Fragment } from 'react'
import { useT } from '@/i18n'
import { Icon } from './Icon'

export type Step = { label: string }

type Props = {
  steps: Step[]
  /** Zero-based index of the active step. */
  current: number
  /** When given, completed steps become clickable. */
  onSelect?: (index: number) => void
}

export function Stepper({ steps, current, onSelect }: Props) {
  const t = useT()
  return (
    <ol className="stepper" aria-label={t('stepper.label')}>
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        const cls = ['stepper__step', done ? 'is-done' : ''].join(' ').trim()
        const inner = (
          <>
            <span className="stepper__circle" aria-hidden="true">
              {done ? <Icon name="check" size="sm" /> : i + 1}
            </span>
            <span>{step.label}</span>
          </>
        )
        const srLabel = t('stepper.step', { n: i + 1, total: steps.length, label: step.label })
        return (
          <Fragment key={step.label}>
            <li style={{ display: 'contents' }}>
              {done && onSelect ? (
                <button
                  type="button"
                  className={cls}
                  onClick={() => onSelect(i)}
                  aria-label={srLabel}
                >
                  {inner}
                </button>
              ) : (
                <span
                  className={cls}
                  aria-current={active ? 'step' : undefined}
                  aria-label={srLabel}
                >
                  {inner}
                </span>
              )}
            </li>
            {i < steps.length - 1 && <li className="stepper__line" aria-hidden="true" />}
          </Fragment>
        )
      })}
    </ol>
  )
}
