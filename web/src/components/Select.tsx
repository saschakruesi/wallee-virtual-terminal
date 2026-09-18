import { forwardRef, useId } from 'react'
import type { SelectHTMLAttributes } from 'react'

export type SelectOption = { value: string; label: string; disabled?: boolean }

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string
  hint?: string
  error?: string
  options: SelectOption[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, hint, error, options, placeholder, id, className, required, ...rest },
  ref,
) {
  const autoId = useId()
  const selectId = id ?? autoId
  const hintId = hint ? `${selectId}-hint` : undefined
  const errorId = error ? `${selectId}-error` : undefined
  return (
    <div className="field">
      {label && (
        <label
          htmlFor={selectId}
          className={['field__label', required ? 'field__label--required' : ''].join(' ').trim()}
        >
          {label}
        </label>
      )}
      <div className="field__control">
        <select
          ref={ref}
          id={selectId}
          className={['select', error ? 'select--error' : '', className ?? ''].join(' ').trim()}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          required={required}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
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
