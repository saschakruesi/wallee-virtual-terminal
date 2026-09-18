import { describe, expect, it, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { I18nProvider } from '@/i18n'
import {
  Button,
  Input,
  Segmented,
  StatusBadge,
  Stepper,
  Table,
  ToastProvider,
  useToast,
} from './index'

function wrap(ui: ReactNode) {
  return render(
    <I18nProvider initialLang="de">
      <ToastProvider>{ui}</ToastProvider>
    </I18nProvider>,
  )
}

describe('Button', () => {
  it('is disabled and busy while loading', () => {
    wrap(<Button loading>Speichern</Button>)
    const btn = screen.getByRole('button', { name: /Speichern/ })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })
  it('defaults to type=button so it never submits a form by accident', () => {
    wrap(<Button>x</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })
})

describe('Input', () => {
  it('links label, hint and error to the control', () => {
    wrap(<Input label="Space ID" error="Pflichtfeld" />)
    const input = screen.getByLabelText('Space ID')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Pflichtfeld')
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id)
  })
})

describe('Segmented', () => {
  it('behaves like a radio group', async () => {
    const onChange = vi.fn()
    wrap(
      <Segmented
        aria-label="Umgebung"
        value="PREVIEW"
        onChange={onChange}
        options={[
          { value: 'PREVIEW', label: 'Test' },
          { value: 'LIVE', label: 'Live' },
        ]}
      />,
    )
    const group = screen.getByRole('radiogroup', { name: 'Umgebung' })
    expect(group).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Test' })).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'Live' }))
    expect(onChange).toHaveBeenCalledWith('LIVE')
  })
})

describe('Stepper', () => {
  it('marks the current step and makes completed steps clickable', async () => {
    const onSelect = vi.fn()
    wrap(
      <Stepper
        steps={[{ label: 'Kunde' }, { label: 'Positionen' }, { label: 'Prüfen' }]}
        current={1}
        onSelect={onSelect}
      />,
    )
    expect(screen.getByLabelText('Schritt 2 von 3: Positionen')).toHaveAttribute(
      'aria-current',
      'step',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Schritt 1 von 3: Kunde' }))
    expect(onSelect).toHaveBeenCalledWith(0)
  })
})

describe('StatusBadge', () => {
  it('translates the status', () => {
    wrap(<StatusBadge status="paid" />)
    expect(screen.getByText('Bezahlt')).toHaveClass('badge--paid')
  })
})

describe('Table', () => {
  const columns = [
    { key: 'name', header: 'Name', render: (r: { name: string; amount: string }) => r.name },
    {
      key: 'amount',
      header: 'CHF',
      align: 'right' as const,
      render: (r: { amount: string }) => r.amount,
    },
  ]
  it('renders rows and handles keyboard activation', async () => {
    const onRowClick = vi.fn()
    wrap(
      <Table
        columns={columns}
        rows={[{ name: 'Zimmer', amount: "1'234.50" }]}
        rowKey={(r) => r.name}
        onRowClick={onRowClick}
      />,
    )
    const row = screen.getByText('Zimmer').closest('tr')!
    row.focus()
    await userEvent.keyboard('{Enter}')
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })
  it('shows the empty state when there are no rows', () => {
    wrap(<Table columns={columns} rows={[]} rowKey={(r) => r.name} empty="Nichts da" />)
    expect(screen.getByText('Nichts da')).toBeInTheDocument()
  })
})

function ToastProbe() {
  const toast = useToast()
  return <button onClick={() => toast.error('Kaputt', 'Fehler')}>fire</button>
}

describe('Toast', () => {
  it('shows and dismisses a toast', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    wrap(<ToastProbe />)
    await userEvent.click(screen.getByText('fire'))
    expect(screen.getByRole('alert')).toHaveTextContent('Kaputt')
    act(() => vi.advanceTimersByTime(9000))
    expect(screen.queryByRole('alert')).toBeNull()
    vi.useRealTimers()
  })
})
