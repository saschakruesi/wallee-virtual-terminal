import { useT } from '@/i18n'
import { Input } from '@/components'

import type { AddressFormValue } from './addressForm'

type Props = {
  value: AddressFormValue
  onChange: (value: AddressFormValue) => void
  /** Hide name/e-mail fields when they are edited elsewhere (customer master data). */
  withName?: boolean
  withContact?: boolean
  disabled?: boolean
}

/** Postal address inputs shared by the wizard, the new-customer form and the address editor. */
export function AddressFields({
  value,
  onChange,
  withName = true,
  withContact = true,
  disabled,
}: Props) {
  const t = useT()
  const set = (key: keyof AddressFormValue, v: string) => onChange({ ...value, [key]: v })
  return (
    <div className="sg-grid" style={{ gap: 'var(--s-2)' }}>
      {withName && (
        <>
          <Input
            label={t('customer.givenName')}
            value={value.givenName}
            onChange={(e) => set('givenName', e.target.value)}
            autoComplete="off"
            disabled={disabled}
          />
          <Input
            label={t('customer.familyName')}
            value={value.familyName}
            onChange={(e) => set('familyName', e.target.value)}
            autoComplete="off"
            disabled={disabled}
          />
        </>
      )}
      <Input
        label={t('customer.organizationName')}
        value={value.organizationName}
        onChange={(e) => set('organizationName', e.target.value)}
        autoComplete="off"
        disabled={disabled}
      />
      <Input
        label={t('customer.street')}
        value={value.street}
        onChange={(e) => set('street', e.target.value)}
        autoComplete="off"
        disabled={disabled}
      />
      <div className="sg-grid" style={{ gridTemplateColumns: '1fr 2fr', gap: 'var(--s-2)' }}>
        <Input
          label={t('customer.postcode')}
          value={value.postcode}
          onChange={(e) => set('postcode', e.target.value)}
          autoComplete="off"
          disabled={disabled}
        />
        <Input
          label={t('customer.city')}
          value={value.city}
          onChange={(e) => set('city', e.target.value)}
          autoComplete="off"
          disabled={disabled}
        />
      </div>
      <Input
        label={t('customer.country')}
        hint={t('customer.country.hint')}
        value={value.country}
        maxLength={2}
        onChange={(e) => set('country', e.target.value.toUpperCase())}
        autoComplete="off"
        disabled={disabled}
      />
      {withContact && (
        <>
          <Input
            label={t('customer.email')}
            type="email"
            value={value.emailAddress}
            onChange={(e) => set('emailAddress', e.target.value)}
            autoComplete="off"
            disabled={disabled}
          />
          <Input
            label={t('customer.phone')}
            type="tel"
            value={value.phoneNumber}
            onChange={(e) => set('phoneNumber', e.target.value)}
            autoComplete="off"
            disabled={disabled}
          />
        </>
      )}
    </div>
  )
}
