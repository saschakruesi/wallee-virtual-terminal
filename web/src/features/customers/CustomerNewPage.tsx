import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { Button, Headline, Input, Select, useToast } from '@/components'
import { useConfig } from '@/app/ConfigProvider'
import { createCustomer, createCustomerAddress } from '@/api/customers'
import { CURRENCIES, PAYMENT_LANGUAGES } from '@/lib/storage'
import { describeApiError } from '@/features/setup/errorMessages'
import { AddressFields } from './AddressFields'
import { addressHasContent, emptyAddressForm } from './addressForm'
import type { AddressFormValue } from './addressForm'

/** `#/customers/new` — master data + optional billing address, saved to wallee. */
export function CustomerNewPage() {
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const { config } = useConfig()
  const cfg = config!
  const [form, setForm] = useState<AddressFormValue>(() => emptyAddressForm())
  const [customerNumber, setCustomerNumber] = useState('')
  const [language, setLanguage] = useState(cfg.language)
  const [currency, setCurrency] = useState(cfg.currency)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!form.givenName.trim() && !form.familyName.trim() && !form.organizationName.trim()) {
      setError(t('customer.nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createCustomer(cfg, {
        givenName: form.givenName,
        familyName: form.familyName,
        emailAddress: form.emailAddress,
        customerId: customerNumber,
        language,
        preferredCurrency: currency,
      })
      if (addressHasContent(form)) {
        try {
          await createCustomerAddress(cfg, created.id, { addressType: 'BILLING', address: form })
        } catch (err) {
          toast.error(
            t('customer.addressError', {
              message: describeApiError(err, t, { spaceId: cfg.spaceId }),
            }),
          )
        }
      }
      toast.success(
        t('customer.created', {
          name:
            [form.givenName, form.familyName].filter(Boolean).join(' ') || form.organizationName,
        }),
      )
      navigate(`/customers/${created.id}`, { replace: true })
    } catch (err) {
      setError(
        t('customer.createError', { message: describeApiError(err, t, { spaceId: cfg.spaceId }) }),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Headline kicker={t('customers.new.kicker')} title={t('customers.new.title')} />
      <form
        className="stack"
        style={{ maxWidth: 720 }}
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <AddressFields value={form} onChange={setForm} />
        <div className="sg-grid" style={{ gap: 'var(--s-2)' }}>
          <Input
            label={t('customer.number')}
            value={customerNumber}
            onChange={(e) => setCustomerNumber(e.target.value)}
            autoComplete="off"
          />
          <Select
            label={t('customer.language')}
            value={language}
            onChange={(e) => setLanguage(e.target.value as typeof language)}
            options={PAYMENT_LANGUAGES.map((l) => ({ value: l, label: l }))}
          />
          <Select
            label={t('customer.currency')}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        {error && (
          <div className="field__error" role="alert">
            {error}
          </div>
        )}
        <div className="row">
          <Button type="submit" loading={saving}>
            {t('customers.new')}
          </Button>
          <Button variant="secondary" onClick={() => navigate('/customers')}>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </>
  )
}
