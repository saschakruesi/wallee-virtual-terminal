import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import { Button, ConfirmDialog, Headline, Stepper, useToast } from '@/components'
import { useConfig } from '@/app/ConfigProvider'
import { createTransaction } from '@/api/transactions'
import { APP_VERSION } from '@/lib/version'
import { addRecent } from '@/lib/recent'
import { describeApiError } from '@/features/setup/errorMessages'
import { isWalleeApiError } from '@/api/client'
import {
  buildTransactionCreate,
  clearDraft,
  computeTotals,
  consumeReference,
  customerLabel,
  loadDraft,
  newDraft,
  rememberDraftForTransaction,
  saveDraft,
  validateCustomer,
  validateItems,
} from './draft'
import type { Draft } from './draft'
import { CustomerStep } from './CustomerStep'
import { ItemsStep } from './ItemsStep'
import { ReviewStep } from './ReviewStep'
import { openPaymentWindow } from './paymentWindow'

/**
 * `#/` — three-step wizard: customer → line items → review & start.
 * The draft survives reloads (sessionStorage). Phase 3 covers MOTO; the payment-link mode
 * is wired through `draft.mode` and arrives in phase 4.
 */
export function NewTransactionPage() {
  const { t } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { config } = useConfig()
  const cfg = config! // guarded by RequireConfig

  const [draft, setDraft] = useState<Draft>(() => {
    const restored = (location.state as { draft?: Draft } | null)?.draft ?? loadDraft()
    return restored ?? newDraft(cfg)
  })
  const [showErrors, setShowErrors] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const stepRef = useRef<HTMLDivElement>(null)

  useEffect(() => saveDraft(draft), [draft])

  const update = useCallback((patch: Partial<Draft> | ((d: Draft) => Draft)) => {
    setDraft((d) => (typeof patch === 'function' ? patch(d) : { ...d, ...patch }))
  }, [])

  const totals = useMemo(() => computeTotals(draft), [draft])
  const customerValidation = useMemo(
    () => validateCustomer(draft.customer, draft.mode, t),
    [draft.customer, draft.mode, t],
  )
  const itemsValidation = useMemo(() => validateItems(draft, t), [draft, t])

  const goTo = (step: 0 | 1 | 2) => {
    setShowErrors(false)
    update({ step })
    setTimeout(
      () => stepRef.current?.querySelector<HTMLElement>('input, select, button')?.focus(),
      0,
    )
  }

  const next = () => {
    if (draft.step === 0) {
      if (!customerValidation.valid) return setShowErrors(true)
      return goTo(1)
    }
    if (draft.step === 1) {
      if (!itemsValidation.valid) return setShowErrors(true)
      return goTo(2)
    }
  }

  const back = () => goTo(Math.max(0, draft.step - 1) as 0 | 1 | 2)

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' || draft.step === 2) return
    const target = e.target as HTMLElement
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON' || target.tagName === 'SELECT')
      return
    e.preventDefault()
    next()
  }

  const start = async () => {
    if (creating) return
    if (!customerValidation.valid || !itemsValidation.valid) {
      setShowErrors(true)
      return
    }
    setCreating(true)
    setCreateError(null)
    // Popup blockers allow window.open only inside the click; open a blank window now
    // and navigate it on the MOTO screen once the payment page URL is known.
    const popup = draft.mode === 'MOTO' ? openPaymentWindow() : null
    try {
      const payload = buildTransactionCreate(draft, cfg, t, APP_VERSION)
      const tx = await createTransaction(cfg, payload)
      consumeReference(cfg.merchantReferencePrefix, draft.reference)
      rememberDraftForTransaction(tx.id, draft)
      addRecent({
        transactionId: tx.id,
        mode: draft.mode,
        createdAt: tx.createdOn ?? new Date().toISOString(),
        amount: totals.total,
        currency: draft.currency,
        customerLabel: customerLabel(draft.customer, t('customer.none')),
        reference: draft.reference,
        state: tx.state,
      })
      clearDraft()
      navigate(`/${draft.mode === 'MOTO' ? 'moto' : 'link'}/${tx.id}`, {
        state: { popupOpened: Boolean(popup), fresh: true },
      })
    } catch (err) {
      if (popup && !popup.closed) popup.close()
      const message =
        isWalleeApiError(err) && err.kind === 'validation'
          ? t('review.error.noMethod', { message: err.message })
          : describeApiError(err, t, { spaceId: cfg.spaceId })
      setCreateError(message)
      toast.error(message, t('review.error.title'))
    } finally {
      setCreating(false)
    }
  }

  const reset = () => {
    clearDraft()
    setDraft(newDraft(cfg, draft.mode))
    setShowErrors(false)
    setCreateError(null)
    setConfirmReset(false)
  }

  const steps = [
    { label: t('stepper.customer') },
    { label: t('stepper.items') },
    { label: t('stepper.review') },
  ]

  return (
    <>
      <Headline
        kicker={t('headline.new.kicker')}
        title={t('headline.new.title')}
        actions={
          <Button variant="text" onClick={() => setConfirmReset(true)}>
            {t('wizard.reset')}
          </Button>
        }
      />
      <Stepper steps={steps} current={draft.step} onSelect={(i) => goTo(i as 0 | 1 | 2)} />

      <div ref={stepRef} onKeyDown={onKeyDown}>
        {draft.step === 0 && (
          <CustomerStep
            customer={draft.customer}
            mode={draft.mode}
            error={showErrors ? customerValidation.emailAddress : undefined}
            onChange={(customer) => update({ customer })}
          />
        )}
        {draft.step === 1 && (
          <ItemsStep
            draft={draft}
            totals={totals}
            validation={itemsValidation}
            showErrors={showErrors}
            onChange={update}
          />
        )}
        {draft.step === 2 && (
          <ReviewStep
            draft={draft}
            totals={totals}
            config={cfg}
            creating={creating}
            error={createError}
            onStart={start}
            onEdit={goTo}
          />
        )}
      </div>

      {draft.step < 2 && (
        <div className="wizard-actions">
          <div>
            {draft.step > 0 && (
              <Button variant="secondary" onClick={back}>
                {t('wizard.back')}
              </Button>
            )}
          </div>
          <Button onClick={next}>{t('wizard.next')}</Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        title={t('wizard.resetTitle')}
        message={t('wizard.resetMessage')}
        confirmLabel={t('wizard.reset')}
        danger
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
    </>
  )
}
