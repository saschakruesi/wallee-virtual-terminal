import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useI18n } from '@/i18n'
import {
  Button,
  ConfirmDialog,
  CopyField,
  EmptyState,
  Headline,
  Icon,
  Input,
  Spinner,
  Split,
  useToast,
} from '@/components'
import { useConfig } from '@/app/ConfigProvider'
import { failureMessage, getInvoiceDocument, isFailed, isPaid } from '@/api/transactions'
import type { Transaction } from '@/api/transactions'
import {
  applyChargeFlow,
  cancelChargeFlow,
  currentLevel,
  getChargeFlowPaymentPageUrl,
  isLevelExpired,
  levelConfiguration,
  searchChargeFlowLevels,
  sendChargeFlowLevelMessage,
  updateChargeFlowRecipient,
} from '@/api/chargeFlows'
import type { ChargeFlowLevel } from '@/api/chargeFlows'
import { formatMoney, fromMajor } from '@/lib/money'
import { downloadBase64, extensionForMime, safeFilename } from '@/lib/download'
import { updateRecent } from '@/lib/recent'
import { describeApiError } from '@/features/setup/errorMessages'
import { useTransactionPolling } from '@/features/moto/useTransactionPolling'
import { badgeFor } from '@/features/moto/status'
import { NewTransactionButton, Result } from '@/features/moto/Result'
import { TransactionSummary } from '@/features/moto/TransactionSummary'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function fmt(iso: string | undefined, lang: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(lang === 'en' ? 'en-GB' : 'de-CH', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
}

/** `#/link/:id` — status of a payment link: recipient, level, expiry, copy link, resend, change recipient, cancel. */
export function LinkPage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useI18n()
  const toast = useToast()
  const location = useLocation()
  const { config } = useConfig()
  const cfg = config!
  const navState = (location.state as { applyError?: string | null } | null) ?? {}

  const { transaction, error, loading, polling, lastUpdated, refresh, setTransaction } =
    useTransactionPolling(cfg, id, {
      fastIntervalMs: 10_000,
      slowIntervalMs: 10_000,
      fastPhaseMs: 0,
      maxDurationMs: 4 * 60 * 60_000,
    })
  const [levels, setLevels] = useState<ChargeFlowLevel[] | null>(null)
  const [levelsError, setLevelsError] = useState<string | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<'resend' | 'recipient' | 'cancel' | 'apply' | 'receipt' | null>(
    null,
  )
  const [editingRecipient, setEditingRecipient] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [recipientError, setRecipientError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(navState.applyError ?? null)

  const state = transaction?.state
  const open = state !== undefined && !isPaid(state) && !isFailed(state) && state !== 'VOIDED'

  const loadLevels = useCallback((): Promise<void> => {
    if (!id) return Promise.resolve()
    return searchChargeFlowLevels(cfg, id).then(
      (list) => {
        setLevels(list)
        setLevelsError(null)
      },
      (err: unknown) => {
        setLevelsError(
          t('link.levelsError', { message: describeApiError(err, t, { spaceId: cfg.spaceId }) }),
        )
      },
    )
  }, [cfg, id, t])

  useEffect(() => {
    void loadLevels()
  }, [loadLevels, state])

  useEffect(() => {
    if (!id || !open || url) return
    let cancelled = false
    getChargeFlowPaymentPageUrl(cfg, id)
      .then((u) => {
        if (!cancelled) setUrl(u)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [cfg, id, open, url])

  useEffect(() => {
    if (transaction) updateRecent(transaction.id, { state: transaction.state })
  }, [transaction])

  const level = useMemo(() => currentLevel(levels ?? []), [levels])
  const levelCfg = levelConfiguration(level)
  const expired = open && isLevelExpired(level)
  const recipientEmail =
    transaction?.customerEmailAddress ?? transaction?.billingAddress?.emailAddress ?? ''

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>, errorKey: string) => {
    setBusy(kind)
    try {
      await fn()
    } catch (err) {
      toast.error(t(errorKey, { message: describeApiError(err, t, { spaceId: cfg.spaceId }) }))
    } finally {
      setBusy(null)
    }
  }

  const resend = () =>
    run(
      'resend',
      async () => {
        if (!level) throw new Error(t('link.noLevel'))
        await sendChargeFlowLevelMessage(cfg, level.id)
        toast.success(t('link.resent'))
      },
      'link.resendError',
    )

  const saveRecipient = () => {
    const email = recipient.trim()
    if (!EMAIL_RE.test(email)) return setRecipientError(t('customer.email.invalid'))
    setRecipientError(null)
    return run(
      'recipient',
      async () => {
        if (!transaction) return
        if (!level || levelCfg?.type === undefined) throw new Error(t('link.noRecipientType'))
        await updateChargeFlowRecipient(cfg, transaction.id, levelCfg.type, email)
        await sendChargeFlowLevelMessage(cfg, level.id)
        setEditingRecipient(false)
        toast.success(t('link.recipientChanged'))
        const fresh = await refresh()
        if (fresh)
          setTransaction({ ...fresh, customerEmailAddress: fresh.customerEmailAddress ?? email })
        await loadLevels()
      },
      'link.recipientError',
    )
  }

  const cancel = () => {
    setConfirmCancel(false)
    return run(
      'cancel',
      async () => {
        if (!transaction) return
        const result = await cancelChargeFlow(cfg, transaction.id)
        toast.success(t('link.cancelled'))
        if (result && typeof result === 'object' && 'state' in result)
          setTransaction(result as Transaction)
        else {
          const fresh = await refresh()
          if (fresh) setTransaction(fresh)
        }
        await loadLevels()
      },
      'link.cancelError',
    )
  }

  const apply = () =>
    run(
      'apply',
      async () => {
        if (!transaction) return
        const result = await applyChargeFlow(cfg, transaction.id)
        setApplyError(null)
        toast.success(t('link.applied'))
        if (result && typeof result === 'object' && 'state' in result)
          setTransaction(result as Transaction)
        await loadLevels()
        setUrl(null)
      },
      'link.applyError',
    )

  const downloadReceipt = () =>
    run(
      'receipt',
      async () => {
        if (!transaction) return
        const doc = await getInvoiceDocument(cfg, transaction.id)
        const ext = extensionForMime(doc.mimeType)
        downloadBase64(
          doc.data,
          doc.mimeType ?? 'application/pdf',
          safeFilename(
            doc.title || `Beleg-${transaction.merchantReference ?? transaction.id}`,
            ext,
          ),
        )
      },
      'moto.receiptError',
    )

  const amount = transaction
    ? fromMajor(transaction.completedAmount || transaction.authorizationAmount || 0)
    : 0
  const currency = transaction?.currency ?? cfg.currency

  if (loading && !transaction) {
    return (
      <>
        <Headline kicker={t('link.kicker')} title={t('link.title')} />
        <div className="row">
          <Spinner /> <span>{t('link.loading')}</span>
        </div>
      </>
    )
  }
  if (!transaction) {
    return (
      <>
        <Headline kicker={t('link.kicker')} title={t('link.title')} />
        <EmptyState
          title={t('moto.notFound', { id: id ?? '' })}
          text={error ? describeApiError(error, t, { spaceId: cfg.spaceId }) : undefined}
          action={
            <Button variant="secondary" onClick={() => void refresh()}>
              {t('common.retry')}
            </Button>
          }
        />
      </>
    )
  }

  const failure = isFailed(transaction.state) ? failureMessage(transaction, lang) : undefined
  const badge = expired ? 'expired' : badgeFor(transaction.state)
  const noLevel = levels !== null && levels.length === 0 && open

  return (
    <>
      <Headline
        kicker={t('link.kicker')}
        title={t('link.title')}
        actions={
          <>
            <span className="small muted">
              {lastUpdated
                ? t('moto.lastUpdate', {
                    time: lastUpdated.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'de-CH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })
                : ''}
            </span>
            <Button
              variant="secondary"
              icon={<Icon name="refresh" />}
              onClick={() => void refresh().then(loadLevels)}
            >
              {t('moto.refresh')}
            </Button>
            {open && (
              <Button
                variant="danger"
                onClick={() => setConfirmCancel(true)}
                loading={busy === 'cancel'}
              >
                {t('link.cancel')}
              </Button>
            )}
          </>
        }
      />

      <Split
        left={
          <TransactionSummary
            transaction={transaction}
            mode="LINK"
            badge={badge}
            showTestBadge={cfg.environment === 'PREVIEW'}
            failureText={failure}
            amount={amount}
            currency={currency}
          />
        }
        right={
          open ? (
            <div
              className="stack"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}
            >
              {noLevel || applyError ? (
                <>
                  <p className="statement">{t('link.notApplied')}</p>
                  {applyError && (
                    <div className="small" style={{ color: 'var(--w-orange-text)' }}>
                      {applyError}
                    </div>
                  )}
                  <div className="row">
                    <Button size="lg" onClick={apply} loading={busy === 'apply'}>
                      {t('link.apply')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="statement">
                    {t('link.sentTo')}{' '}
                    <strong style={{ fontWeight: 500 }}>{recipientEmail || '—'}</strong>
                  </p>
                  <dl className="summary-list">
                    {level?.createdOn && (
                      <>
                        <dt>{t('timeline.linkSent')}</dt>
                        <dd className="tnum">{fmt(level.createdOn, lang)}</dd>
                      </>
                    )}
                    {levelCfg?.name && (
                      <>
                        <dt>{t('link.level')}</dt>
                        <dd>{levelCfg.name}</dd>
                      </>
                    )}
                    {level?.timeoutOn && (
                      <>
                        <dt>{t('link.expires').replace(' {time}', '')}</dt>
                        <dd className="tnum">
                          {fmt(level.timeoutOn, lang)}
                          {expired && (
                            <span style={{ color: 'var(--w-orange-text)' }}>
                              {' '}
                              · {t('link.expired')}
                            </span>
                          )}
                        </dd>
                      </>
                    )}
                  </dl>
                  {levelsError && (
                    <div className="small" style={{ color: 'var(--w-orange-text)' }}>
                      {levelsError}
                    </div>
                  )}
                  {url && (
                    <CopyField
                      label={t('link.url')}
                      value={url}
                      copyLabel={t('link.copy')}
                      openLabel={t('link.open')}
                      openable
                    />
                  )}
                  <div className="row">
                    <Button onClick={resend} loading={busy === 'resend'} disabled={!level}>
                      {t('link.resend')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setEditingRecipient((v) => !v)}
                      aria-expanded={editingRecipient}
                    >
                      {t('link.changeRecipient')}
                    </Button>
                  </div>
                  {editingRecipient && (
                    <div
                      className="row"
                      style={{
                        alignItems: 'flex-end',
                        background: '#fff',
                        padding: 12,
                        borderRadius: 'var(--r-sm)',
                      }}
                    >
                      <Input
                        label={t('link.newRecipient')}
                        type="email"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        error={recipientError ?? undefined}
                        autoFocus
                        wrapperClassName="grow"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            void saveRecipient()
                          }
                        }}
                      />
                      <Button onClick={() => void saveRecipient()} loading={busy === 'recipient'}>
                        {t('link.saveRecipient')}
                      </Button>
                    </div>
                  )}
                  <div className="row" style={{ marginTop: 'auto' }}>
                    {polling ? <Spinner /> : <Icon name="warning" />}
                    <span>{polling ? t('link.pending') : t('moto.pollingStopped')}</span>
                  </div>
                  <p className="small" style={{ color: 'var(--w-turquoise-deep)' }}>
                    {t('link.pendingText')}
                  </p>
                </>
              )}
            </div>
          ) : isPaid(transaction.state) ? (
            <Result
              icon="check"
              tone="ok"
              title={transaction.state === 'FULFILL' ? t('moto.paidFulfilled') : t('link.paid')}
              amount={formatMoney(amount, currency)}
            >
              <Button
                size="lg"
                icon={<Icon name="download" />}
                onClick={downloadReceipt}
                loading={busy === 'receipt'}
              >
                {t('moto.downloadReceipt')}
              </Button>
              <NewTransactionButton secondary />
            </Result>
          ) : transaction.state === 'AUTHORIZED' ? (
            <Result
              icon="check"
              tone="ok"
              title={t('moto.authorized')}
              text={t('moto.authorizedText')}
              amount={formatMoney(amount, currency)}
            >
              <NewTransactionButton secondary />
            </Result>
          ) : isFailed(transaction.state) ? (
            <Result
              icon="warning"
              tone="failed"
              title={t('link.failed')}
              text={failure ?? t('moto.failedNoReason')}
              amount={formatMoney(amount, currency)}
            >
              <NewTransactionButton />
            </Result>
          ) : (
            <Result
              icon="close"
              tone="muted"
              title={t('moto.voided')}
              amount={formatMoney(amount, currency)}
            >
              <NewTransactionButton />
            </Result>
          )
        }
      />

      <ConfirmDialog
        open={confirmCancel}
        title={t('link.cancelTitle')}
        message={t('link.cancelMessage')}
        confirmLabel={t('link.cancelConfirm')}
        danger
        onConfirm={() => void cancel()}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  )
}
