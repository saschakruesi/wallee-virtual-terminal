import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { Button, Icon, Input, Spinner, useToast } from '@/components'
import { useConfig } from '@/app/ConfigProvider'
import {
  createCustomer,
  createCustomerAddress,
  listCustomerAddresses,
  pickBillingAddress,
} from '@/api/customers'
import type { Customer } from '@/api/customers'
import { describeApiError } from '@/features/setup/errorMessages'
import { CustomerSearch } from '@/features/customers/CustomerSearch'
import { AddressFields } from '@/features/customers/AddressFields'
import { addressHasContent, emptyAddressForm } from '@/features/customers/addressForm'
import type { AddressFormValue } from '@/features/customers/addressForm'
import { rememberCustomer } from '@/lib/storage'
import { customerFromWallee, emptyCustomer } from './draft'
import type { CustomerDraft, Mode } from './draft'

type Props = {
  customer: CustomerDraft
  mode: Mode
  error?: string
  onChange: (customer: CustomerDraft) => void
}

type View = 'search' | 'create' | 'adhoc' | 'selected'

/**
 * Step 1: search a wallee customer (selection takes over the default billing address),
 * create one inline, or continue without a profile (billing fields only).
 */
export function CustomerStep({ customer, mode, error, onChange }: Props) {
  const t = useT()
  const toast = useToast()
  const { config } = useConfig()
  const cfg = config!
  const initialView: View =
    customer.mode === 'wallee' ? 'selected' : customer.adhoc ? 'adhoc' : 'search'
  const [view, setView] = useState<View>(initialView)
  const [loadingAddress, setLoadingAddress] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newCustomer, setNewCustomer] = useState<AddressFormValue>(() => emptyAddressForm())
  const firstAdhocRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (view === 'adhoc') firstAdhocRef.current?.focus()
  }, [view])

  const remember = (c: Customer) =>
    rememberCustomer({
      id: c.id,
      givenName: c.givenName,
      familyName: c.familyName,
      emailAddress: c.emailAddress,
      customerId: c.customerId,
    })

  const select = async (c: Customer) => {
    remember(c)
    onChange(customerFromWallee(c))
    setView('selected')
    setLoadingAddress(true)
    try {
      const addresses = await listCustomerAddresses(cfg, c.id)
      const billing = pickBillingAddress(addresses)
      onChange(customerFromWallee(c, billing?.address))
    } catch {
      /* address is optional: keep the customer without it */
    } finally {
      setLoadingAddress(false)
    }
  }

  const create = async () => {
    const v = newCustomer
    if (!v.givenName.trim() && !v.familyName.trim() && !v.organizationName.trim()) {
      setCreateError(t('customer.nameRequired'))
      return
    }
    setCreating(true)
    setCreateError(null)
    let created: Customer
    try {
      created = await createCustomer(cfg, {
        givenName: v.givenName,
        familyName: v.familyName,
        emailAddress: v.emailAddress,
        language: cfg.language,
        preferredCurrency: cfg.currency,
      })
    } catch (err) {
      setCreateError(
        t('customer.createError', { message: describeApiError(err, t, { spaceId: cfg.spaceId }) }),
      )
      setCreating(false)
      return
    }
    let address = undefined
    if (addressHasContent(v)) {
      try {
        const a = await createCustomerAddress(cfg, created.id, {
          addressType: 'BILLING',
          address: v,
        })
        address = a.address ?? v
      } catch (err) {
        toast.error(
          t('customer.addressError', {
            message: describeApiError(err, t, { spaceId: cfg.spaceId }),
          }),
        )
        address = v
      }
    }
    setCreating(false)
    toast.success(
      t('customer.created', {
        name: [v.givenName, v.familyName].filter(Boolean).join(' ') || v.organizationName,
      }),
    )
    remember({ ...created, emailAddress: created.emailAddress ?? v.emailAddress })
    onChange(customerFromWallee(created, address))
    setView('selected')
  }

  const set = (key: keyof CustomerDraft, value: string) => onChange({ ...customer, [key]: value })

  const addressForm: AddressFormValue = {
    givenName: customer.givenName,
    familyName: customer.familyName,
    organizationName: customer.organizationName,
    street: customer.street,
    postcode: customer.postcode,
    city: customer.city,
    country: customer.country,
    emailAddress: customer.emailAddress,
    phoneNumber: '',
  }
  const applyAddress = (v: AddressFormValue) => onChange({ ...customer, ...v })

  if (view === 'selected' && customer.mode === 'wallee') {
    const name =
      [customer.givenName, customer.familyName].filter((s) => s.trim()).join(' ') ||
      customer.organizationName ||
      customer.emailAddress
    return (
      <div className="stack" style={{ maxWidth: 720 }}>
        <div className="customer-card">
          <div>
            <div className="small muted">{t('customer.selected')}</div>
            <div className="section-title" style={{ marginBottom: 2 }}>
              {name}
            </div>
            <div className="small muted">
              {customer.emailAddress}
              {customer.customerNumber && ` · ${t('customer.number')} ${customer.customerNumber}`}
            </div>
          </div>
          <Button
            variant="text"
            onClick={() => {
              onChange(emptyCustomer())
              setView('search')
            }}
          >
            {t('customer.change')}
          </Button>
        </div>
        {error && (
          <div className="field__error" role="alert">
            {error}
          </div>
        )}
        <p className="small muted">{t('customer.selectedHint')}</p>
        {loadingAddress ? (
          <div className="row">
            <Spinner size="sm" />{' '}
            <span className="small muted">{t('customer.loadingAddress')}</span>
          </div>
        ) : (
          <AddressFields value={addressForm} onChange={applyAddress} withContact={false} />
        )}
        <Input
          label={t('customer.email')}
          type="email"
          value={customer.emailAddress}
          onChange={(e) => set('emailAddress', e.target.value)}
          required={mode === 'LINK'}
          error={error}
        />
      </div>
    )
  }

  if (view === 'create') {
    return (
      <div className="stack" style={{ maxWidth: 720 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            {t('customer.createTitle')}
          </h2>
          <Button variant="text" onClick={() => setView('search')}>
            {t('customer.backToSearch')}
          </Button>
        </div>
        <AddressFields value={newCustomer} onChange={setNewCustomer} />
        {createError && (
          <div className="field__error" role="alert">
            {createError}
          </div>
        )}
        <div>
          <Button onClick={() => void create()} loading={creating} icon={<Icon name="plus" />}>
            {t('customer.createSave')}
          </Button>
        </div>
      </div>
    )
  }

  if (view === 'adhoc') {
    return (
      <div className="stack" style={{ maxWidth: 720 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 className="section-title" style={{ marginBottom: 2 }}>
              {t('customer.withoutProfile')}
            </h2>
            <p className="small muted">{t('customer.withoutProfile.hint')}</p>
          </div>
          <Button
            variant="text"
            onClick={() => {
              onChange({ ...customer, adhoc: false })
              setView('search')
            }}
          >
            {t('customer.backToSearch')}
          </Button>
        </div>
        <Input
          ref={firstAdhocRef}
          label={t('customer.email')}
          type="email"
          autoComplete="off"
          value={customer.emailAddress}
          onChange={(e) => set('emailAddress', e.target.value)}
          required={mode === 'LINK'}
          error={error}
        />
        <AddressFields value={addressForm} onChange={applyAddress} withContact={false} />
      </div>
    )
  }

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <CustomerSearch
        creds={cfg}
        autoFocus
        inputId="wizard-customer-search"
        variant="dropdown"
        onSelect={(c) => void select(c)}
        footer={
          <div className="row" style={{ gap: 'var(--s-3)' }}>
            <Button
              variant="text"
              icon={<Icon name="plus" size="sm" />}
              onClick={() => setView('create')}
            >
              {t('customer.createNew')}
            </Button>
            <Button
              variant="text"
              onClick={() => {
                onChange({ ...emptyCustomer(), adhoc: true })
                setView('adhoc')
              }}
            >
              {t('customer.withoutProfile')}
            </Button>
          </div>
        }
      />
      {error && (
        <div className="field__error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
