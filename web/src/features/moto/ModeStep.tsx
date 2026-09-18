import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { useT } from '@/i18n'
import { Button } from '@/components'
import type { Mode } from './draft'

type Props = {
  value: Mode
  linkAvailable: boolean
  onChange: (mode: Mode) => void
  onStart: (mode: Mode) => void
}

/** Step 0: two large cards; the last used mode is preselected and Enter starts it. */
export function ModeStep({ value, linkAvailable, onChange, onStart }: Props) {
  const t = useT()
  const selectedRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    selectedRef.current?.focus()
  }, [])

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      const next: Mode = value === 'MOTO' ? 'LINK' : 'MOTO'
      if (next === 'LINK' && !linkAvailable) return
      onChange(next)
    }
  }

  const card = (mode: Mode, disabled: boolean) => (
    <button
      ref={value === mode ? selectedRef : undefined}
      type="button"
      className="choice"
      aria-pressed={value === mode}
      disabled={disabled}
      onClick={() => {
        onChange(mode)
        onStart(mode)
      }}
    >
      <span className="choice__title">{t(mode === 'MOTO' ? 'mode.moto' : 'mode.link')}</span>
      <span className="choice__text">
        {t(mode === 'MOTO' ? 'mode.moto.text' : 'mode.link.text')}
      </span>
      {mode === 'LINK' && disabled && (
        <span className="small" style={{ color: 'var(--w-orange-text)', marginTop: 'auto' }}>
          {t('mode.link.unavailable')} {t('mode.link.help')}
        </span>
      )}
    </button>
  )

  return (
    <div onKeyDown={onKeyDown}>
      <h2 className="section-title">{t('mode.title')}</h2>
      <div className="choice-grid">
        {card('MOTO', false)}
        {card('LINK', !linkAvailable)}
      </div>
      <div className="wizard-actions">
        <span className="small muted">{t('mode.hint')}</span>
        <Button onClick={() => onStart(value)}>{t('mode.start')}</Button>
      </div>
    </div>
  )
}
