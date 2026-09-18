import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { Icon } from './Icon'

type Props = {
  value: string
  label?: string
  /** Show an additional "open" action for URLs. */
  openable?: boolean
  copyLabel?: string
  openLabel?: string
}

export function CopyField({ value, label, openable, copyLabel, openLabel }: Props) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // Fallback for blocked clipboard: select the text so the user can copy manually.
      const el = document.getElementById(`copy-${value.length}`)
      const range = document.createRange()
      if (el) {
        range.selectNodeContents(el)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
    }
  }

  return (
    <div className="field">
      {label && <span className="field__label">{label}</span>}
      <div className="copyfield">
        <span className="copyfield__value" id={`copy-${value.length}`} title={value}>
          {value}
        </span>
        <button type="button" className="copyfield__action" onClick={copy} aria-live="polite">
          <Icon name={copied ? 'check' : 'copy'} size="sm" />
          {copied ? t('common.copied') : (copyLabel ?? t('common.copy'))}
        </button>
        {openable && (
          <a className="copyfield__action" href={value} target="_blank" rel="noopener noreferrer">
            <Icon name="external" size="sm" />
            {openLabel ?? t('common.open')}
          </a>
        )}
      </div>
    </div>
  )
}
