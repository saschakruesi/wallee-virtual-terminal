import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LANGS, useI18n } from '@/i18n'
import type { Lang } from '@/i18n'
import {
  Button,
  ConfirmDialog,
  Headline,
  Icon,
  Input,
  Segmented,
  Select,
  Split,
  useToast,
} from '@/components'
import logoWhite from '@/assets/wallee_logo_white.svg'
import { useConfig } from '@/app/ConfigProvider'
import {
  COMPLETION_BEHAVIORS,
  CURRENCIES,
  DEFAULT_CONFIG,
  PAYMENT_LANGUAGES,
  clearAllLocalData,
  profileLabel,
} from '@/lib/storage'
import type { AppConfig, CompletionBehavior, Environment, PaymentLanguage } from '@/lib/storage'
import { testConnection } from './connectionTest'
import type { ConnectionResult } from './connectionTest'
import { describeApiError } from './errorMessages'
import { CatalogTransfer } from '@/features/products/CatalogTransfer'

const DOC_URL = 'https://app-wallee.com/doc/api/web-service'
const PREFIX_RE = /^[A-Z0-9-]{1,10}$/

type Form = {
  label: string
  userId: string
  authKey: string
  spaceId: string
  environment: Environment
  currency: string
  language: PaymentLanguage
  merchantReferencePrefix: string
  completionBehavior: CompletionBehavior
  rememberCredentials: boolean
}

type Errors = Partial<Record<'userId' | 'authKey' | 'spaceId' | 'merchantReferencePrefix', string>>

function formFromConfig(config: AppConfig | null, remember: boolean): Form {
  const c = config ?? { ...DEFAULT_CONFIG, userId: '', authKey: '', spaceId: '' }
  return {
    label: config?.label ?? '',
    userId: c.userId,
    authKey: '',
    spaceId: c.spaceId,
    environment: c.environment,
    currency: c.currency,
    language: c.language,
    merchantReferencePrefix: c.merchantReferencePrefix,
    completionBehavior: c.completionBehavior,
    rememberCredentials: remember,
  }
}

/**
 * Setup: one form per space. Several spaces can be configured; the chips on top select
 * which one is edited, «Neuer Space» starts an empty form, and saving makes the space active.
 */
export function SetupPage() {
  const { t, lang, setLang } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { config, profiles, save, remove, clear } = useConfig()
  const wantsNew = new URLSearchParams(location.search).get('new') === '1'
  const remember = config?.rememberCredentials ?? true

  const [editingId, setEditingId] = useState<string | null>(wantsNew ? null : (config?.id ?? null))
  const editing = useMemo(
    () => (editingId ? (profiles.find((p) => p.id === editingId) ?? null) : null),
    [editingId, profiles],
  )

  const [form, setForm] = useState<Form>(() => formFromConfig(editing, remember))
  const [errors, setErrors] = useState<Errors>({})
  const [keyMasked, setKeyMasked] = useState(Boolean(editing?.authKey))
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<ConnectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmLive, setConfirmLive] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const userIdRef = useRef<HTMLInputElement>(null)
  const keyRef = useRef<HTMLInputElement>(null)

  const [formFor, setFormFor] = useState<string | null>(editingId)
  if (formFor !== editingId) {
    // Selected space changed: reload the form (state adjustment during render).
    setFormFor(editingId)
    setForm(
      formFromConfig(
        editingId ? (profiles.find((p) => p.id === editingId) ?? null) : null,
        remember,
      ),
    )
    setKeyMasked(Boolean(editingId && profiles.some((p) => p.id === editingId && p.authKey)))
    setErrors({})
    setResult(null)
    setError(null)
  }

  useEffect(() => {
    if (!editing) userIdRef.current?.focus()
  }, [editing])

  // «Space hinzufügen» arrives as #/setup?new=1: select the empty form, then drop the query.
  const [seenNew, setSeenNew] = useState(wantsNew)
  if (wantsNew !== seenNew) {
    setSeenNew(wantsNew)
    if (wantsNew) setEditingId(null)
  }
  useEffect(() => {
    if (wantsNew) navigate('/setup', { replace: true })
  }, [wantsNew, navigate])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const referenceExample = useMemo(() => {
    const prefix = form.merchantReferencePrefix || 'VT'
    return `${prefix}-${new Date().getFullYear()}-000001`
  }, [form.merchantReferencePrefix])

  const validate = (): boolean => {
    const next: Errors = {}
    if (!form.userId.trim()) next.userId = t('setup.required')
    else if (!/^\d+$/.test(form.userId.trim())) next.userId = t('setup.numeric')
    if (!keyMasked && !form.authKey.trim()) next.authKey = t('setup.required')
    if (!form.spaceId.trim()) next.spaceId = t('setup.required')
    else if (!/^\d+$/.test(form.spaceId.trim())) next.spaceId = t('setup.numeric')
    if (!PREFIX_RE.test(form.merchantReferencePrefix))
      next.merchantReferencePrefix = t('setup.prefix.error')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (testing || !validate()) return
    const authKey = keyMasked && editing ? editing.authKey : form.authKey.trim()
    const creds = {
      userId: form.userId.trim(),
      authKey,
      spaceId: form.spaceId.trim(),
      iatUnit: keyMasked ? editing?.iatUnit : undefined,
    }
    setTesting(true)
    setError(null)
    setResult(null)
    try {
      const res = await testConnection(creds)
      const currency =
        form.currency === DEFAULT_CONFIG.currency &&
        res.space.primaryCurrency &&
        (CURRENCIES as readonly string[]).includes(res.space.primaryCurrency)
          ? res.space.primaryCurrency
          : form.currency
      const next: AppConfig = {
        id: editing?.id,
        label: form.label.trim() || undefined,
        userId: creds.userId,
        authKey: creds.authKey,
        spaceId: creds.spaceId,
        environment: form.environment,
        currency,
        language: form.language,
        merchantReferencePrefix: form.merchantReferencePrefix,
        completionBehavior: form.completionBehavior,
        rememberCredentials: form.rememberCredentials,
        iatUnit: res.iatUnit,
        spaceName: res.space.name,
        spaceState: res.space.state,
        chargeFlowAvailable: (res.activeChargeFlows ?? 0) > 0,
        connectedAt: new Date().toISOString(),
      }
      const saved = save(next)
      setEditingId(saved.id ?? null)
      setFormFor(saved.id ?? null)
      setForm((f) => ({ ...f, currency, authKey: '' }))
      setKeyMasked(true)
      setShowKey(false)
      setResult(res)
      toast.success(
        t('setup.savedMessage', { space: res.space.name ?? res.space.id }),
        t('setup.saved'),
      )
      const from = (location.state as { from?: string } | null)?.from
      if (!config && from && from !== '/setup') navigate(from, { replace: true })
    } catch (err) {
      setError(describeApiError(err, t, { spaceId: creds.spaceId }))
    } finally {
      setTesting(false)
    }
  }

  const onEnvironmentChange = (value: Environment) => {
    if (value === 'LIVE' && form.environment !== 'LIVE') setConfirmLive(true)
    else set('environment', value)
  }

  const onRemove = () => {
    if (!editing) return
    const name = profileLabel(editing)
    remove(editing.id!)
    setConfirmRemove(false)
    setEditingId(null)
    toast.success(t('setup.spaces.removed'), name)
  }

  const onClearAll = () => {
    clearAllLocalData()
    clear()
    setConfirmClear(false)
    setEditingId(null)
    toast.success(t('setup.danger.cleared'))
  }

  const spaceStateLabel = (state?: string) => (state ? t(`space.state.${state}`) : '—')

  return (
    <>
      <Headline kicker={t('headline.setup.kicker')} title={t('headline.setup.title')} />
      <Split
        ratio="even"
        turquoise="left"
        left={
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-4)', height: '100%' }}
          >
            <img
              src={logoWhite}
              alt={t('app.wordmarkAlt')}
              className="panel-logo"
              width="156"
              height="40"
            />
            <p className="statement">{t('setup.intro')}</p>
            <p>{t('setup.guide')}</p>
            <p>
              <a
                href={DOC_URL}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--w-black)', textDecoration: 'underline' }}
              >
                {t('setup.guideLink')}
              </a>
            </p>
            <p style={{ fontWeight: 300, marginTop: 'auto' }}>{t('setup.claim')}</p>
          </div>
        }
        right={
          <form
            onSubmit={onSubmit}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}
          >
            {(profiles.length > 0 || editing === null) && (
              <div className="field">
                <span className="field__label">{t('setup.spaces.title')}</span>
                <div className="space-chips" role="tablist" aria-label={t('setup.spaces.title')}>
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="tab"
                      aria-selected={p.id === editingId}
                      className={['space-chips__item', p.id === editingId ? 'is-selected' : '']
                        .join(' ')
                        .trim()}
                      onClick={() => setEditingId(p.id!)}
                    >
                      {profileLabel(p)}
                      {p.id === config?.id && (
                        <span className="small muted"> · {t('setup.spaces.active')}</span>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editingId === null}
                    className={['space-chips__item', editingId === null ? 'is-selected' : '']
                      .join(' ')
                      .trim()}
                    onClick={() => setEditingId(null)}
                  >
                    <Icon name="plus" size="sm" />
                    {t('setup.spaces.new')}
                  </button>
                </div>
                <span className="field__hint">{t('setup.spaces.hint')}</span>
              </div>
            )}

            <h2 className="section-title" style={{ marginBottom: 0 }}>
              {editing
                ? t('setup.spaces.editing', { name: profileLabel(editing) })
                : profiles.length > 0
                  ? t('setup.spaces.newTitle')
                  : t('setup.section.credentials')}
            </h2>
            <Input
              label={t('setup.label')}
              hint={t('setup.label.hint')}
              value={form.label}
              maxLength={40}
              onChange={(e) => set('label', e.target.value)}
              autoComplete="off"
            />
            <Input
              ref={userIdRef}
              label={t('setup.userId')}
              hint={t('setup.userId.hint')}
              inputMode="numeric"
              autoComplete="off"
              value={form.userId}
              onChange={(e) => set('userId', e.target.value)}
              error={errors.userId}
              required
            />
            {keyMasked ? (
              <div className="field">
                <span className="field__label">{t('setup.authKey')}</span>
                <div className="row" style={{ minHeight: 'var(--control-h)' }}>
                  <span className="tnum" aria-label={t('setup.authKey.masked')}>
                    ••••••••••••
                  </span>
                  <span className="small muted">{t('setup.authKey.masked')}</span>
                  <Button
                    variant="text"
                    onClick={() => {
                      setKeyMasked(false)
                      setTimeout(() => keyRef.current?.focus(), 0)
                    }}
                  >
                    {t('setup.authKey.change')}
                  </Button>
                </div>
              </div>
            ) : (
              <Input
                ref={keyRef}
                label={t('setup.authKey')}
                hint={t('setup.authKey.hint')}
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={form.authKey}
                onChange={(e) => set('authKey', e.target.value)}
                error={errors.authKey}
                required
                trailing={
                  <button
                    type="button"
                    className="field__trailing"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? t('common.hidePassword') : t('common.showPassword')}
                    aria-pressed={showKey}
                  >
                    <Icon name={showKey ? 'eye-off' : 'eye'} />
                  </button>
                }
              />
            )}
            {!keyMasked && editing?.authKey && (
              <div style={{ marginTop: 'calc(-1 * var(--s-2))' }}>
                <Button
                  variant="text"
                  onClick={() => {
                    setKeyMasked(true)
                    set('authKey', '')
                  }}
                >
                  {t('setup.authKey.keep')}
                </Button>
              </div>
            )}
            <Input
              label={t('setup.spaceId')}
              hint={t('setup.spaceId.hint')}
              inputMode="numeric"
              autoComplete="off"
              value={form.spaceId}
              onChange={(e) => set('spaceId', e.target.value)}
              error={errors.spaceId}
              required
            />
            <Segmented<Environment>
              label={t('setup.environment')}
              value={form.environment}
              onChange={onEnvironmentChange}
              options={[
                { value: 'PREVIEW', label: t('setup.environment.preview') },
                { value: 'LIVE', label: t('setup.environment.live') },
              ]}
            />

            <h2 className="section-title" style={{ marginBottom: 0, marginTop: 'var(--s-2)' }}>
              {t('setup.section.defaults')}
            </h2>
            <div className="sg-grid" style={{ gap: 'var(--s-2)' }}>
              <Select
                label={t('setup.currency')}
                value={form.currency}
                onChange={(e) => set('currency', e.target.value)}
                options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              />
              <Select
                label={t('setup.language')}
                value={form.language}
                onChange={(e) => set('language', e.target.value as PaymentLanguage)}
                options={PAYMENT_LANGUAGES.map((l) => ({ value: l, label: l }))}
              />
            </div>
            <Input
              label={t('setup.prefix')}
              hint={t('setup.prefix.preview', { example: referenceExample })}
              value={form.merchantReferencePrefix}
              maxLength={10}
              onChange={(e) => set('merchantReferencePrefix', e.target.value.toUpperCase())}
              error={errors.merchantReferencePrefix}
            />
            <Select
              label={t('setup.completion')}
              value={form.completionBehavior}
              onChange={(e) => set('completionBehavior', e.target.value as CompletionBehavior)}
              options={COMPLETION_BEHAVIORS.map((b) => ({
                value: b,
                label:
                  b === 'COMPLETE_IMMEDIATELY'
                    ? t('setup.completion.immediate')
                    : b === 'COMPLETE_DEFERRED'
                      ? t('setup.completion.deferred')
                      : t('setup.completion.configuration'),
              }))}
            />
            <div className="field">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={form.rememberCredentials}
                  onChange={(e) => set('rememberCredentials', e.target.checked)}
                />
                {t('setup.remember')}
              </label>
              <span className="field__hint">{t('setup.remember.hint')}</span>
            </div>

            {error && (
              <div
                className="banner"
                role="alert"
                style={{ borderRadius: 'var(--r-sm)', padding: '12px 16px' }}
              >
                <Icon name="warning" />
                <div>
                  <strong style={{ fontWeight: 500 }}>{t('setup.error.title')}</strong>
                  <div>{error}</div>
                </div>
              </div>
            )}
            {result && (
              <div className="infobox" role="status" style={{ fontSize: 'var(--fs-base)' }}>
                <div style={{ fontWeight: 500, marginBottom: 6 }}>{t('setup.result.title')}</div>
                <dl className="result-list">
                  <dt>{t('setup.result.space')}</dt>
                  <dd>
                    {result.space.name ?? '—'}{' '}
                    <span className="muted tnum">#{result.space.id}</span>
                  </dd>
                  <dt>{t('setup.result.state')}</dt>
                  <dd>{spaceStateLabel(result.space.state)}</dd>
                  <dt>{t('setup.result.chargeFlows')}</dt>
                  <dd>
                    {result.activeChargeFlows === null
                      ? t('setup.result.chargeFlows.forbidden', {
                          message: result.chargeFlowError?.message ?? '',
                        })
                      : result.activeChargeFlows > 0
                        ? t('setup.result.chargeFlows.available', {
                            count: result.activeChargeFlows,
                          })
                        : t('setup.result.chargeFlows.unavailable')}
                    {result.activeChargeFlows === 0 && (
                      <div className="small muted">{t('setup.result.chargeFlows.hint')}</div>
                    )}
                  </dd>
                </dl>
                {result.iatUnit === 'milliseconds' && (
                  <div className="small muted">{t('setup.result.iatHint')}</div>
                )}
              </div>
            )}

            <Button type="submit" size="lg" block loading={testing}>
              {testing ? t('setup.testing') : t('setup.submit')}
            </Button>
            {editing && (
              <div>
                <Button variant="danger" onClick={() => setConfirmRemove(true)}>
                  {t('setup.spaces.remove')}
                </Button>
              </div>
            )}

            <hr className="hairline" style={{ margin: 'var(--s-2) 0 0' }} />
            <h2 className="section-title" style={{ marginBottom: 0 }}>
              {t('setup.section.app')}
            </h2>
            <Segmented<Lang>
              label={t('setup.appLanguage')}
              value={lang}
              onChange={setLang}
              options={LANGS.map((l) => ({ value: l, label: t(`lang.${l}`) }))}
            />
            <CatalogTransfer compact />
            <div>
              <Button variant="danger" onClick={() => setConfirmClear(true)}>
                {t('setup.danger.clear')}
              </Button>
            </div>
          </form>
        }
      />

      <ConfirmDialog
        open={confirmLive}
        title={t('setup.environment.liveTitle')}
        message={t('setup.environment.liveMessage')}
        confirmLabel={t('setup.environment.liveConfirm')}
        danger
        onConfirm={() => {
          set('environment', 'LIVE')
          setConfirmLive(false)
        }}
        onCancel={() => setConfirmLive(false)}
      />
      <ConfirmDialog
        open={confirmRemove}
        title={t('setup.spaces.removeTitle')}
        message={t('setup.spaces.removeMessage', { name: editing ? profileLabel(editing) : '' })}
        confirmLabel={t('setup.spaces.remove')}
        danger
        onConfirm={onRemove}
        onCancel={() => setConfirmRemove(false)}
      />
      <ConfirmDialog
        open={confirmClear}
        title={t('setup.danger.clearTitle')}
        message={t('setup.danger.clearMessage')}
        confirmLabel={t('setup.danger.clear')}
        danger
        onConfirm={onClearAll}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  )
}
