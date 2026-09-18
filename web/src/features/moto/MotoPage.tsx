import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '@/i18n'
import {
  Button,
  ConfirmDialog,
  CopyField,
  EmptyState,
  Headline,
  Icon,
  Spinner,
  Split,
  StatusBadge,
  StatusTimeline,
  useToast,
} from '@/components'
import { useConfig } from '@/app/ConfigProvider'
import {
  completeOnline,
  failureMessage,
  getInvoiceDocument,
  getPaymentPageUrl,
  getSuccessfulChargeAttempt,
  isFailed,
  isPaid,
  voidOnline,
} from '@/api/transactions'
import type { ChargeAttempt, Transaction } from '@/api/transactions'
import { badgeFor } from './status'
import { formatAmount, formatMoney, fromMajor } from '@/lib/money'
import { downloadBase64, extensionForMime, safeFilename } from '@/lib/download'
import { findRecent, updateRecent } from '@/lib/recent'
import { describeApiError } from '@/features/setup/errorMessages'
import { draftForTransaction } from './draft'
import {
  closePaymentWindow,
  isPaymentWindowOpen,
  navigatePaymentWindow,
  openPaymentWindow,
} from './paymentWindow'
import { useTransactionPolling } from './useTransactionPolling'

type PageState = 'idle' | 'loading' | 'ready' | 'error'

/** `#/moto/:id` — payment page popup on the right, summary on the left, result replaces the panel. */
export function MotoPage() {
  const { id } = useParams<{ id: string }>()
  const { t, lang } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { config } = useConfig()
  const cfg = config!
  const navState = (location.state as { popupOpened?: boolean; fresh?: boolean } | null) ?? {}

  const { transaction, error, loading, polling, lastUpdated, refresh, setTransaction } =
    useTransactionPolling(cfg, id)
  const [pageUrl, setPageUrl] = useState<string | null>(null)
  const [pageState, setPageState] = useState<PageState>('idle')
  const [pageError, setPageError] = useState<string | null>(null)
  const [popupBlocked, setPopupBlocked] = useState(!navState.popupOpened && Boolean(navState.fresh))
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelledLocally, setCancelledLocally] = useState(() =>
    Boolean(id && findRecent(Number(id))?.cancelledLocally),
  )
  const [busy, setBusy] = useState<'void' | 'complete' | 'receipt' | null>(null)
  const [attempt, setAttempt] = useState<ChargeAttempt | null>(null)
  const urlRequested = useRef(false)

  const state = transaction?.state
  const open =
    state !== undefined &&
    !isPaid(state) &&
    !isFailed(state) &&
    state !== 'VOIDED' &&
    state !== 'AUTHORIZED' &&
    !cancelledLocally

  // Fetch the payment page URL once and point the popup at it.
  const loadPageUrl = useCallback(async () => {
    if (!id) return null
    setPageState('loading')
    setPageError(null)
    try {
      const url = await getPaymentPageUrl(cfg, id)
      setPageUrl(url)
      setPageState('ready')
      return url
    } catch (err) {
      setPageState('error')
      const message = describeApiError(err, t, { spaceId: cfg.spaceId })
      setPageError(t('moto.pageUrlError', { message }))
      return null
    }
  }, [cfg, id, t])

  useEffect(() => {
    if (!transaction || urlRequested.current || !open) return
    urlRequested.current = true
    void loadPageUrl().then((url) => {
      if (!url) return
      if (navState.popupOpened || isPaymentWindowOpen()) {
        const w = navigatePaymentWindow(url)
        if (!w) setPopupBlocked(true)
      } else if (navState.fresh) {
        setPopupBlocked(true)
      }
    })
  }, [transaction, open, loadPageUrl, navState.popupOpened, navState.fresh])

  // Keep the local cache in sync and close the popup when the transaction ends.
  useEffect(() => {
    if (!transaction) return
    updateRecent(transaction.id, { state: transaction.state })
    if (!open) closePaymentWindow()
  }, [transaction, open])

  // Optional card details for the result screen.
  useEffect(() => {
    if (
      !transaction ||
      !id ||
      attempt ||
      !(isPaid(transaction.state) || transaction.state === 'AUTHORIZED')
    )
      return
    getSuccessfulChargeAttempt(cfg, id)
      .then((a) => a && setAttempt(a))
      .catch(() => undefined)
  }, [transaction, id, cfg, attempt])

  const openPage = async () => {
    const url = pageUrl ?? (await loadPageUrl())
    if (!url) return
    const w = openPaymentWindow(url)
    setPopupBlocked(!w)
  }

  const cancel = async () => {
    if (!transaction) return
    setConfirmCancel(false)
    closePaymentWindow()
    if (transaction.state === 'AUTHORIZED') {
      setBusy('void')
      try {
        await voidOnline(cfg, transaction.id)
        const fresh = await refresh()
        if (fresh) setTransaction(fresh)
      } catch (err) {
        toast.error(
          t('moto.voidError', { message: describeApiError(err, t, { spaceId: cfg.spaceId }) }),
        )
      } finally {
        setBusy(null)
      }
      return
    }
    setCancelledLocally(true)
    updateRecent(transaction.id, { cancelledLocally: true })
  }

  const capture = async () => {
    if (!transaction) return
    setBusy('complete')
    try {
      await completeOnline(cfg, transaction.id)
      toast.success(t('moto.captured'))
      const fresh = await refresh()
      if (fresh) setTransaction(fresh)
    } catch (err) {
      toast.error(
        t('moto.completeError', { message: describeApiError(err, t, { spaceId: cfg.spaceId }) }),
      )
    } finally {
      setBusy(null)
    }
  }

  const downloadReceipt = async () => {
    if (!transaction) return
    setBusy('receipt')
    try {
      const doc = await getInvoiceDocument(cfg, transaction.id)
      const ext = extensionForMime(doc.mimeType)
      downloadBase64(
        doc.data,
        doc.mimeType ?? 'application/pdf',
        safeFilename(doc.title || `Beleg-${transaction.merchantReference ?? transaction.id}`, ext),
      )
    } catch (err) {
      toast.error(
        t('moto.receiptError', { message: describeApiError(err, t, { spaceId: cfg.spaceId }) }),
      )
    } finally {
      setBusy(null)
    }
  }

  const retry = async () => {
    if (!transaction) return
    // Same transaction first (chargeRetryEnabled); otherwise a new one from the remembered draft.
    if (transaction.chargeRetryEnabled !== false) {
      const url = await loadPageUrl()
      if (url) {
        urlRequested.current = true
        setCancelledLocally(false)
        const w = openPaymentWindow(url)
        setPopupBlocked(!w)
        const fresh = await refresh()
        if (fresh) setTransaction(fresh)
        return
      }
    }
    const draft = draftForTransaction(transaction.id)
    navigate('/', { state: { draft: draft ? { ...draft, step: 2 } : undefined } })
  }

  const amount = useMemo(() => {
    if (!transaction) return 0
    const major = transaction.completedAmount || transaction.authorizationAmount || 0
    return fromMajor(major)
  }, [transaction])
  const currency = transaction?.currency ?? cfg.currency

  if (loading && !transaction) {
    return (
      <>
        <Headline kicker={t('moto.kicker')} title={t('moto.title')} />
        <div className="row">
          <Spinner /> <span>{t('moto.loading')}</span>
        </div>
      </>
    )
  }
  if (!transaction) {
    return (
      <>
        <Headline kicker={t('moto.kicker')} title={t('moto.title')} />
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

  const c = transaction.billingAddress
  const customerName =
    [c?.givenName, c?.familyName].filter(Boolean).join(' ') ||
    c?.organizationName ||
    transaction.customerEmailAddress ||
    t('customer.none')
  const failure = isFailed(transaction.state) ? failureMessage(transaction, lang) : undefined
  const labels = (attempt?.labels ?? [])
    .filter((l) => l.contentAsString && l.descriptor?.name)
    .slice(0, 4)

  return (
    <>
      <Headline
        kicker={t('moto.kicker')}
        title={t('moto.title')}
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
              onClick={() => void refresh()}
            >
              {t('moto.refresh')}
            </Button>
            {open && (
              <Button variant="danger" onClick={() => setConfirmCancel(true)}>
                {t('moto.cancel')}
              </Button>
            )}
            {transaction.state === 'AUTHORIZED' && (
              <Button
                variant="danger"
                onClick={() => setConfirmCancel(true)}
                loading={busy === 'void'}
              >
                {t('moto.cancel')}
              </Button>
            )}
          </>
        }
      />

      <Split
        left={
          <div className="stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <StatusBadge status={badgeFor(transaction.state, cancelledLocally)} />
              {cfg.environment === 'PREVIEW' && <StatusBadge status="test" />}
            </div>
            <StatusTimeline
              transaction={transaction}
              mode="MOTO"
              failureText={failure}
              lang={lang}
            />
            <dl className="summary-list">
              <dt>{t('moto.customer')}</dt>
              <dd>
                {customerName}
                {transaction.customerEmailAddress &&
                  customerName !== transaction.customerEmailAddress && (
                    <span className="muted"> · {transaction.customerEmailAddress}</span>
                  )}
              </dd>
              <dt>{t('moto.reference')}</dt>
              <dd className="tnum">{transaction.merchantReference ?? '—'}</dd>
              <dt>{t('moto.transactionId')}</dt>
              <dd className="tnum">{transaction.id}</dd>
            </dl>
            <table className="table">
              <tbody>
                {(transaction.lineItems ?? []).map((li, i) => (
                  <tr key={li.uniqueId ?? i}>
                    <td>
                      {li.name}
                      {li.quantity != null && li.quantity !== 1 && (
                        <span className="small muted"> × {li.quantity}</span>
                      )}
                    </td>
                    <td className="is-right tnum">
                      {formatAmount(fromMajor(li.amountIncludingTax ?? 0), {
                        negativeInParens: true,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ textAlign: 'right' }}>
              <div className="small muted">{t('moto.total')}</div>
              <div className="display-amount">{formatMoney(amount, currency)}</div>
            </div>
          </div>
        }
        right={
          <ResultPanel
            transaction={transaction}
            open={open}
            cancelledLocally={cancelledLocally}
            pageUrl={pageUrl}
            pageState={pageState}
            pageError={pageError}
            popupBlocked={popupBlocked}
            polling={polling}
            busy={busy}
            amountText={formatMoney(amount, currency)}
            failure={failure}
            labels={labels}
            onOpenPage={openPage}
            onCapture={capture}
            onReceipt={downloadReceipt}
            onRetry={retry}
            onRefresh={() => void refresh()}
          />
        }
      />

      <ConfirmDialog
        open={confirmCancel}
        title={t('moto.cancelTitle')}
        message={t('moto.cancelMessage')}
        confirmLabel={t('moto.cancelConfirm')}
        danger
        onConfirm={cancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  )
}

type PanelProps = {
  transaction: Transaction
  open: boolean
  cancelledLocally: boolean
  pageUrl: string | null
  pageState: PageState
  pageError: string | null
  popupBlocked: boolean
  polling: boolean
  busy: 'void' | 'complete' | 'receipt' | null
  amountText: string
  failure?: string
  labels: { contentAsString?: string; descriptor?: { name?: string } }[]
  onOpenPage: () => void
  onCapture: () => void
  onReceipt: () => void
  onRetry: () => void
  onRefresh: () => void
}

function ResultPanel(p: PanelProps) {
  const { t } = useI18n()
  const s = p.transaction.state

  if (
    p.cancelledLocally &&
    p.open === false &&
    !isPaid(s) &&
    s !== 'AUTHORIZED' &&
    !isFailed(s) &&
    s !== 'VOIDED'
  ) {
    return (
      <Result icon="close" tone="muted" title={t('moto.cancelled')} text={t('moto.cancelledText')}>
        <NewTransactionButton />
      </Result>
    )
  }

  if (p.open) {
    return (
      <div
        className="stack"
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s-3)' }}
      >
        <p className="statement">{p.popupBlocked ? t('moto.popupBlocked') : t('moto.popupOpen')}</p>
        <div className="display-amount">{p.amountText}</div>
        <div className="row">
          <Button size="lg" onClick={p.onOpenPage} loading={p.pageState === 'loading'}>
            {p.popupBlocked ? t('moto.openPage') : t('moto.reopen')}
          </Button>
        </div>
        {p.pageError && (
          <div
            role="alert"
            style={{
              background: '#fff',
              borderRadius: 'var(--r-sm)',
              padding: '10px 12px',
              color: 'var(--w-orange-text)',
              fontSize: 'var(--fs-small)',
            }}
          >
            {p.pageError}
          </div>
        )}
        {p.pageUrl && (
          <CopyField
            label={t('moto.pageUrl')}
            value={p.pageUrl}
            copyLabel={t('moto.copyLink')}
            openable
          />
        )}
        <div className="row" style={{ marginTop: 'auto' }}>
          {p.polling ? (
            <>
              <Spinner />{' '}
              <span>{s === 'PROCESSING' ? t('moto.processing') : t('moto.waiting')}</span>
            </>
          ) : (
            <>
              <Icon name="warning" /> <span>{t('moto.pollingStopped')}</span>
            </>
          )}
        </div>
      </div>
    )
  }

  if (s === 'AUTHORIZED') {
    return (
      <Result
        icon="check"
        tone="ok"
        title={t('moto.authorized')}
        text={t('moto.authorizedText')}
        amount={p.amountText}
        labels={p.labels}
      >
        {p.transaction.completionBehavior === 'COMPLETE_DEFERRED' && (
          <Button size="lg" onClick={p.onCapture} loading={p.busy === 'complete'}>
            {p.busy === 'complete' ? t('moto.capturing') : t('moto.captureNow')}
          </Button>
        )}
        <Button variant="secondary" onClick={p.onRefresh}>
          {t('moto.refresh')}
        </Button>
        <NewTransactionButton secondary />
      </Result>
    )
  }

  if (isPaid(s)) {
    return (
      <Result
        icon="check"
        tone="ok"
        title={s === 'FULFILL' ? t('moto.paidFulfilled') : t('moto.paid')}
        amount={p.amountText}
        labels={p.labels}
      >
        <Button
          size="lg"
          icon={<Icon name="download" />}
          onClick={p.onReceipt}
          loading={p.busy === 'receipt'}
        >
          {t('moto.downloadReceipt')}
        </Button>
        <NewTransactionButton secondary />
      </Result>
    )
  }

  if (isFailed(s)) {
    return (
      <Result
        icon="warning"
        tone="failed"
        title={t('moto.failed')}
        text={p.failure ?? t('moto.failedNoReason')}
        amount={p.amountText}
      >
        <Button size="lg" onClick={p.onRetry} loading={p.pageState === 'loading'}>
          {t('moto.retry')}
        </Button>
        <NewTransactionButton secondary />
      </Result>
    )
  }

  // VOIDED
  return (
    <Result icon="close" tone="muted" title={t('moto.voided')} amount={p.amountText}>
      <NewTransactionButton />
    </Result>
  )
}

function Result({
  icon,
  tone,
  title,
  text,
  amount,
  labels,
  children,
}: {
  icon: 'check' | 'warning' | 'close'
  tone: 'ok' | 'failed' | 'muted'
  title: string
  text?: string
  amount?: string
  labels?: { contentAsString?: string; descriptor?: { name?: string } }[]
  children?: React.ReactNode
}) {
  const { t } = useI18n()
  return (
    <div
      className="stack"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--s-3)',
        alignItems: 'flex-start',
      }}
    >
      <span
        className={[
          'result-icon',
          tone === 'failed' ? 'result-icon--failed' : tone === 'muted' ? 'result-icon--muted' : '',
        ]
          .join(' ')
          .trim()}
        aria-hidden="true"
      >
        <Icon name={icon} />
      </span>
      <div className="result-title" role="status">
        {title}
      </div>
      {amount && <div className="display-amount">{amount}</div>}
      {text && (
        <p className="statement" style={{ fontSize: 17 }}>
          {text}
        </p>
      )}
      {labels && labels.length > 0 && (
        <dl className="summary-list">
          <dt>{t('moto.cardDetails')}</dt>
          <dd>{labels.map((l) => `${l.descriptor?.name}: ${l.contentAsString}`).join(' · ')}</dd>
        </dl>
      )}
      <div className="row" style={{ marginTop: 'var(--s-2)' }}>
        {children}
      </div>
    </div>
  )
}

function NewTransactionButton({ secondary }: { secondary?: boolean }) {
  const { t } = useI18n()
  return (
    <Link
      to="/"
      className={['btn', secondary ? 'btn--secondary' : 'btn--primary', secondary ? '' : 'btn--lg']
        .join(' ')
        .trim()}
      style={{ textDecoration: 'none' }}
    >
      {t('moto.newTransaction')}
    </Link>
  )
}
