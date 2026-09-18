import { useEffect, useRef } from 'react'
import { useT } from '@/i18n'
import { Input } from '@/components'
import type { CustomerDraft, Mode } from './draft'

type Props = {
  customer: CustomerDraft
  mode: Mode
  error?: string
  onChange: (customer: CustomerDraft) => void
}

/**
 * Step 1. Phase 3 offers only "without customer profile": the billing fields below.
 * The customer search / inline creation (phase 5) slots in above the form.
 */
export function CustomerStep({ customer, mode, error, onChange }: Props) {
  const t = useT()
  const firstRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    firstRef.current?.focus()
  }, [])

  const set = (key: keyof CustomerDraft, value: string) => onChange({ ...customer, [key]: value })

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      {/* Phase 5: <CustomerSearch onSelect=… /> */}
      <Input
        label={t('customer.searchPlaceholder')}
        hint={t('customer.searchHint')}
        disabled
        placeholder={t('customer.searchPlaceholder')}
      />
      <hr className="hairline" style={{ margin: 'var(--s-3) 0' }} />
      <div>
        <div className="section-title" style={{ marginBottom: 4 }}>
          {t('customer.withoutProfile')}
        </div>
        <p className="small muted">{t('customer.withoutProfile.hint')}</p>
      </div>
      <div className="sg-grid" style={{ gap: 'var(--s-2)' }}>
        <Input
          ref={firstRef}
          label={t('customer.email')}
          type="email"
          autoComplete="off"
          value={customer.emailAddress}
          onChange={(e) => set('emailAddress', e.target.value)}
          required={mode === 'LINK'}
          error={error}
        />
        <Input
          label={t('customer.organizationName')}
          value={customer.organizationName}
          onChange={(e) => set('organizationName', e.target.value)}
        />
        <Input
          label={t('customer.givenName')}
          value={customer.givenName}
          onChange={(e) => set('givenName', e.target.value)}
          autoComplete="off"
        />
        <Input
          label={t('customer.familyName')}
          value={customer.familyName}
          onChange={(e) => set('familyName', e.target.value)}
          autoComplete="off"
        />
        <Input
          label={t('customer.street')}
          value={customer.street}
          onChange={(e) => set('street', e.target.value)}
          autoComplete="off"
        />
        <div className="sg-grid" style={{ gridTemplateColumns: '1fr 2fr', gap: 'var(--s-2)' }}>
          <Input
            label={t('customer.postcode')}
            value={customer.postcode}
            onChange={(e) => set('postcode', e.target.value)}
            autoComplete="off"
          />
          <Input
            label={t('customer.city')}
            value={customer.city}
            onChange={(e) => set('city', e.target.value)}
            autoComplete="off"
          />
        </div>
        <Input
          label={t('customer.country')}
          hint={t('customer.country.hint')}
          value={customer.country}
          maxLength={2}
          onChange={(e) => set('country', e.target.value.toUpperCase())}
          autoComplete="off"
        />
      </div>
    </div>
  )
}
