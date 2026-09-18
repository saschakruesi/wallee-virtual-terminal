import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '@/i18n'
import {
  Button,
  EmptyState,
  Headline,
  Icon,
  Input,
  Select,
  Spinner,
  StatusBadge,
  Table,
  useToast,
} from '@/components'
import { useConfig } from '@/app/ConfigProvider'
import { isWalleeApiError } from '@/api/client'
import {
  createCustomerAddress,
  getCustomer,
  listCustomerAddresses,
  pickBillingAddress,
  setDefaultCustomerAddress,
  updateCustomer,
} from '@/api/customers'
import type { Customer, CustomerAddress, CustomerAddressType } from '@/api/customers'
import { CURRENCIES, PAYMENT_LANGUAGES } from '@/lib/storage'
import { describeApiError } from '@/features/setup/errorMessages'
import { customerFromWallee, newDraft } from '@/features/moto/draft'
import { AddressFields } from './AddressFields'
import { addressHasContent, emptyAddressForm } from './addressForm'
import type { AddressFormValue } from './addressForm'

type Master = {
  givenName: string
  familyName: string
  emailAddress: string
  customerId: string
  language: string
  preferredCurrency: string
}

function masterFrom(c: Customer): Master {
  return {
    givenName: c.givenName ?? '',
    familyName: c.familyName ?? '',
    emailAddress: c.emailAddress ?? '',
    customerId: c.customerId ?? '',
    language: c.language ?? '',
    preferredCurrency: c.preferredCurrency ?? '',
  }
}

/** `#/customers/:id` — master data (PATCH with version), addresses, "start transaction". */
export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const { config } = useConfig()
  const cfg = config!

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loadError, setLoadError] = useState<unknown>(null)
  const [master, setMaster] = useState<Master | null>(null)
  const [saving, setSaving] = useState(false)
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newAddress, setNewAddress] = useState<AddressFormValue>(() => emptyAddressForm())
  const [newType, setNewType] = useState<CustomerAddressType>('BILLING')
  const [savingAddress, setSavingAddress] = useState(false)
  const [busyDefault, setBusyDefault] = useState<number | null>(null)

  const load = useCallback((): Promise<void> => {
    if (!id) return Promise.resolve()
    return getCustomer(cfg, id).then(
      (c) => {
        setCustomer(c)
        setMaster(masterFrom(c))
        setLoadError(null)
      },
      (err: unknown) => setLoadError(err),
    )
  }, [cfg, id])

  const loadAddresses = useCallback((): Promise<void> => {
    if (!id) return Promise.resolve()
    return listCustomerAddresses(cfg, id).then(
      (list) => {
        setAddresses(list)
        setAddressError(null)
      },
      (err: unknown) =>
        setAddressError(
          t('customers.address.loadError', {
            message: describeApiError(err, t, { spaceId: cfg.spaceId }),
          }),
        ),
    )
  }, [cfg, id, t])

  useEffect(() => {
    void load()
    void loadAddresses()
  }, [load, loadAddresses])

  const save = async () => {
    if (!customer || !master) return
    setSaving(true)
    try {
      const updated = await updateCustomer(cfg, customer.id, {
        ...master,
        version: customer.version ?? 0,
      })
      setCustomer(updated)
      setMaster(masterFrom(updated))
      toast.success(t('customers.detail.saved'))
    } catch (err) {
      if (isWalleeApiError(err) && err.kind === 'conflict') {
        toast.error(t('customers.detail.conflict'))
        await load()
      } else {
        toast.error(
          t('customers.detail.saveError', {
            message: describeApiError(err, t, { spaceId: cfg.spaceId }),
          }),
        )
      }
    } finally {
      setSaving(false)
    }
  }

  const saveAddress = async () => {
    if (!customer) return
    if (!addressHasContent(newAddress)) {
      setAddressError(t('customers.address.required'))
      return
    }
    setSavingAddress(true)
    setAddressError(null)
    try {
      await createCustomerAddress(cfg, customer.id, { addressType: newType, address: newAddress })
      toast.success(t('customers.address.saved'))
      setAdding(false)
      setNewAddress(emptyAddressForm())
      await loadAddresses()
    } catch (err) {
      setAddressError(
        t('customers.address.saveError', {
          message: describeApiError(err, t, { spaceId: cfg.spaceId }),
        }),
      )
    } finally {
      setSavingAddress(false)
    }
  }

  const setDefault = async (a: CustomerAddress) => {
    if (!customer) return
    setBusyDefault(a.id)
    try {
      await setDefaultCustomerAddress(cfg, customer.id, a.id)
      toast.success(t('customers.address.defaultSet'))
      await loadAddresses()
    } catch (err) {
      toast.error(
        t('customers.address.defaultError', {
          message: describeApiError(err, t, { spaceId: cfg.spaceId }),
        }),
      )
    } finally {
      setBusyDefault(null)
    }
  }

  const startTransaction = () => {
    if (!customer) return
    const billing = pickBillingAddress(addresses ?? [])
    const draft = { ...newDraft(cfg), customer: customerFromWallee(customer, billing?.address) }
    navigate('/', { state: { draft } })
  }

  if (!customer && loadError == null) {
    return (
      <>
        <Headline kicker={t('customers.detail.kicker')} title="…" />
        <div className="row">
          <Spinner /> <span>{t('customers.detail.loading')}</span>
        </div>
      </>
    )
  }
  if (!customer || !master) {
    return (
      <>
        <Headline
          kicker={t('customers.detail.kicker')}
          title={t('customers.detail.notFound', { id: id ?? '' })}
        />
        <EmptyState
          title={describeApiError(loadError, t, { spaceId: cfg.spaceId })}
          action={
            <Button variant="secondary" onClick={() => void load()}>
              {t('common.retry')}
            </Button>
          }
        />
      </>
    )
  }

  const title =
    [master.givenName, master.familyName].filter(Boolean).join(' ') ||
    master.emailAddress ||
    `#${customer.id}`
  const set = (key: keyof Master, value: string) =>
    setMaster((m) => (m ? { ...m, [key]: value } : m))
  const fmtAddress = (a: CustomerAddress) => {
    const p = a.address ?? {}
    return [
      p.organizationName,
      [p.givenName, p.familyName].filter(Boolean).join(' '),
      p.street,
      [p.postcode, p.city].filter(Boolean).join(' '),
      p.country,
    ]
      .filter((s) => s && s.trim())
      .join(', ')
  }

  return (
    <>
      <Headline
        kicker={t('customers.detail.kicker')}
        title={title}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/customers')}>
              {t('common.back')}
            </Button>
            <Button icon={<Icon name="plus" />} onClick={startTransaction}>
              {t('customers.detail.start')}
            </Button>
          </>
        }
      />

      <div
        className="sg-grid"
        style={{ gridTemplateColumns: 'minmax(0, 5fr) minmax(0, 7fr)', gap: 'var(--s-5)' }}
      >
        <form
          className="stack"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <h2 className="section-title" style={{ marginBottom: 0 }}>
            {t('customers.detail.master')}
          </h2>
          <Input
            label={t('customer.givenName')}
            value={master.givenName}
            onChange={(e) => set('givenName', e.target.value)}
            autoComplete="off"
          />
          <Input
            label={t('customer.familyName')}
            value={master.familyName}
            onChange={(e) => set('familyName', e.target.value)}
            autoComplete="off"
          />
          <Input
            label={t('customer.email')}
            type="email"
            value={master.emailAddress}
            onChange={(e) => set('emailAddress', e.target.value)}
            autoComplete="off"
          />
          <Input
            label={t('customer.number')}
            value={master.customerId}
            onChange={(e) => set('customerId', e.target.value)}
            autoComplete="off"
          />
          <div className="sg-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 'var(--s-2)' }}>
            <Select
              label={t('customer.language')}
              value={master.language}
              onChange={(e) => set('language', e.target.value)}
              placeholder="—"
              options={PAYMENT_LANGUAGES.map((l) => ({ value: l, label: l }))}
            />
            <Select
              label={t('customer.currency')}
              value={master.preferredCurrency}
              onChange={(e) => set('preferredCurrency', e.target.value)}
              placeholder="—"
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="small muted tnum">
              {t('customers.detail.internalId')} {customer.id}
            </span>
            <Button type="submit" loading={saving}>
              {t('customers.detail.save')}
            </Button>
          </div>
        </form>

        <section className="stack">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              {t('customers.detail.addresses')}
            </h2>
            <Button
              variant="secondary"
              icon={<Icon name="plus" size="sm" />}
              onClick={() => setAdding((v) => !v)}
              aria-expanded={adding}
            >
              {t('customers.address.add')}
            </Button>
          </div>
          {adding && (
            <div
              className="stack"
              style={{
                border: '1px solid var(--w-line)',
                borderRadius: 'var(--r-md)',
                padding: 'var(--s-2) var(--s-3)',
              }}
            >
              <Select
                label={t('customers.address.type')}
                value={newType}
                onChange={(e) => setNewType(e.target.value as CustomerAddressType)}
                options={(['BILLING', 'SHIPPING', 'BOTH'] as const).map((ty) => ({
                  value: ty,
                  label: t(`customers.address.type.${ty}`),
                }))}
              />
              <AddressFields value={newAddress} onChange={setNewAddress} />
              <div className="row">
                <Button onClick={() => void saveAddress()} loading={savingAddress}>
                  {t('customers.address.save')}
                </Button>
                <Button variant="secondary" onClick={() => setAdding(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}
          {addressError && (
            <div className="field__error" role="alert">
              {addressError}
            </div>
          )}
          <Table<CustomerAddress>
            columns={[
              {
                key: 'type',
                header: t('customers.address.type'),
                render: (a) => (a.addressType ? t(`customers.address.type.${a.addressType}`) : '—'),
              },
              {
                key: 'address',
                header: t('customers.detail.addresses'),
                render: (a) => fmtAddress(a) || '—',
              },
              {
                key: 'default',
                header: '',
                align: 'right',
                render: (a) =>
                  a.defaultAddress ? (
                    <StatusBadge status="paid" label={t('customers.address.default')} />
                  ) : (
                    <Button
                      variant="text"
                      onClick={() => void setDefault(a)}
                      loading={busyDefault === a.id}
                    >
                      {t('customers.address.setDefault')}
                    </Button>
                  ),
              },
            ]}
            rows={addresses ?? []}
            rowKey={(a) => String(a.id)}
            loading={addresses === null}
            empty={t('customers.address.none')}
          />
        </section>
      </div>
    </>
  )
}
