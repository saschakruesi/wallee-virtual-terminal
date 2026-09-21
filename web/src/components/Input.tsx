import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  label?: string
  hint?: string
  error?: string
  /** Visual prefix inside the control, e.g. a currency code. */
  prefix?: ReactNode
  /** Trailing element inside the control (button, icon). */
  trailing?: ReactNode
  /**
   * Popover anchored to the control's bottom edge (autocomplete lists). Rendered inside the
   * control wrapper so it lines up with the input regardless of label and hint.
   */
  dropdown?: ReactNode
  align?: 'left' | 'right'
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  {
    label,
    hint,
    error,
    prefix,
    trailing,
    dropdown,
    align = 'left',
    id,
    className,
    required,
    wrapperClassName,
    ...rest
  },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = hint ? `${inputId}-hint` : undefined
  const errorId = error ? `${inputId}-error` : undefined
  const cls = [
    'input',
    error ? 'input--error' : '',
    align === 'right' ? 'input--right' : '',
    trailing ? 'input--with-trailing' : '',
    prefix ? 'input--with-prefix' : '',
    className ?? '',
  ]
    .join(' ')
    .trim()
  return (
    <div className={['field', wrapperClassName ?? ''].join(' ').trim()}>
      {label && (
        <label
          htmlFor={inputId}
          className={['field__label', required ? 'field__label--required' : ''].join(' ').trim()}
        >
          {label}
        </label>
      )}
      <div className="field__control">
        {prefix && <span className="field__prefix">{prefix}</span>}
        <input
          ref={ref}
          id={inputId}
          className={cls}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          required={required}
          {...rest}
        />
        {trailing}
        {dropdown && <div className="field__dropdown">{dropdown}</div>}
      </div>
      {error ? (
        <div id={errorId} className="field__error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div id={hintId} className="field__hint">
          {hint}
        </div>
      ) : null}
    </div>
  )
})
