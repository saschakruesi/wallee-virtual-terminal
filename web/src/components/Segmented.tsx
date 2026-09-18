import { useId } from 'react'
import type { KeyboardEvent } from 'react'

export type SegmentedOption<V extends string> = { value: V; label: string; disabled?: boolean }

type Props<V extends string> = {
  options: SegmentedOption<V>[]
  value: V
  onChange: (value: V) => void
  label?: string
  'aria-label'?: string
  size?: 'md' | 'sm'
}

/** Radio-group semantics: arrow keys move, click/Enter/Space selects. */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  ...rest
}: Props<V>) {
  const id = useId()
  const move = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const dir =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (!dir) return
    e.preventDefault()
    const enabled = options.filter((o) => !o.disabled)
    const current = enabled.findIndex((o) => o.value === options[index]?.value)
    const next = enabled[(current + dir + enabled.length) % enabled.length]
    if (next) {
      onChange(next.value)
      const el = document.getElementById(`${id}-${next.value}`)
      el?.focus()
    }
  }
  return (
    <div className="field">
      {label && (
        <span id={`${id}-label`} className="field__label">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={label ? `${id}-label` : undefined}
        aria-label={rest['aria-label']}
        className={['segmented', size === 'sm' ? 'segmented--sm' : ''].join(' ').trim()}
      >
        {options.map((o, i) => {
          const checked = o.value === value
          return (
            <button
              key={o.value}
              id={`${id}-${o.value}`}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              disabled={o.disabled}
              className="segmented__option"
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => move(e, i)}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
