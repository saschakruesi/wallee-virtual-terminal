import { forwardRef, useEffect, useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { Input } from './Input'
import { formatAmount, parseAmount } from '@/lib/money'

type Props = {
  /** Amount in minor units, or null when empty. */
  value: number | null
  onChange: (minor: number | null) => void
  label?: string
  hint?: string
  error?: string
  prefix?: string
  placeholder?: string
  disabled?: boolean
  allowNegative?: boolean
  id?: string
  'aria-label'?: string
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  autoFocus?: boolean
}

/**
 * Text input for amounts. Keeps what the user types while editing; on blur it parses
 * (`.` or `,` decimals) and re-formats as `1'234.50`. Invalid input shows an error and
 * reports null.
 */
export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  {
    value,
    onChange,
    label,
    hint,
    error,
    prefix,
    placeholder = '0.00',
    disabled,
    allowNegative,
    id,
    onKeyDown,
    autoFocus,
    ...rest
  },
  ref,
) {
  const [text, setText] = useState(value == null ? '' : formatAmount(value))
  const [focused, setFocused] = useState(false)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (!focused) setText(value == null ? '' : formatAmount(value))
  }, [value, focused])

  const commit = (raw: string) => {
    if (raw.trim() === '') {
      setInvalid(false)
      onChange(null)
      return
    }
    const parsed = parseAmount(raw)
    if (parsed === null || (!allowNegative && parsed < 0)) {
      setInvalid(true)
      onChange(null)
      return
    }
    setInvalid(false)
    onChange(parsed)
    setText(formatAmount(parsed))
  }

  return (
    <Input
      ref={ref}
      id={id}
      label={label}
      hint={hint}
      error={error ?? (invalid ? '—' : undefined)}
      prefix={prefix}
      align="right"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      value={text}
      aria-label={rest['aria-label']}
      onFocus={(e: FocusEvent<HTMLInputElement>) => {
        setFocused(true)
        e.target.select()
      }}
      onChange={(e) => {
        setText(e.target.value)
        setInvalid(false)
        const parsed = parseAmount(e.target.value)
        if (parsed !== null && (allowNegative || parsed >= 0)) onChange(parsed)
      }}
      onBlur={(e) => {
        setFocused(false)
        commit(e.target.value)
      }}
      onKeyDown={onKeyDown}
    />
  )
})
