import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '@/i18n'
import {
  Button,
  EmptyState,
  Headline,
  Icon,
  Input,
  Segmented,
  StatusBadge,
  Table,
  useToast,
} from '@/components'
import { useConfig } from '@/app/ConfigProvider'
import { isWalleeApiError } from '@/api/client'
import {
  buildHistoryQuery,
  completeOnline,
  getInvoiceDocument,
  isFailed,
  isOpen,
  isPaid,
  searchTransactions,
  transactionMode,
  voidOnline,
} from '@/api/transactions'
import type { HistoryQueryMode, Transaction } from '@/api/transactions'
import { currentLevel, searchChargeFlowLevels, sendChargeFlowLevelMessage } from '@/api/chargeFlows'
import { formatAmount, fromMajor } from '@/lib/money'
import { downloadBase64, extensionForMime, safeFilename } from '@/lib/download'
import { readRecent, updateRecent } from '@/lib/recent'
import { getUiSnapshot, setUiPrefs } from '@/lib/uiStore'
import { describeApiError } from '@/features/setup/errorMessages'
import { badgeFor } from '@/features/moto/status'

type Filter = 'all' | 'open' | 'paid' | 'failed'
const PAGE = 50

function customerOf(t: Transaction): string {
  const a = t.billingAddress
  return (
    [a?.givenName, a?.familyName].filter(Boolean).join(' ') ||
    a?.organizationName ||
    t.customerEmailAddress ||
    '—'
  )
}

function fmtDate(iso: string | undefined, lang: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString(lang === 'en' ? 'en-GB' : 'de-CH', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
}

/** `#/history` — transactions started by this app, fresh from wallee, with filters and actions. */
export function HistoryPage() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const navigate = useNavigate()
  const { config } = useConfig()
  const cfg = config!

  const [rows, setRows] = useState<Transaction[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [queryMode, setQueryMode] = useState<HistoryQueryMode>(
    () => getUiSnapshot().historyQueryMode ?? 'metaData',
  )
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(
    (offset: number): Promise<void> => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const run = (mode: HistoryQueryMode) =>
        searchTransactions(cfg, buildHistoryQuery(mode, cfg.merchantReferencePrefix), {
          limit: PAGE,
          offset,
          signal: controller.signal,
        }).then((r) => ({ ...r, mode }))
      // Everything runs asynchronously so no state is set inside the calling effect.
      return Promise.resolve()
        .then(() => {
          setLoading(true)
          return run(queryMode)
        })
        .catch((err: unknown) => {
          // The metaData search may not be supported: fall back to the reference prefix once.
          if (queryMode === 'metaData' && isWalleeApiError(err) && err.kind === 'validation')
            return run('reference')
          throw err
        })
        .then(
          (res) => {
            if (controller.signal.aborted) return
            if (res.mode !== queryMode) {
              setQueryMode(res.mode)
              setUiPrefs({ historyQueryMode: res.mode })
            }
            setRows((prev) => {
              const merged = offset === 0 ? res.data : [...prev, ...res.data]
              const openLinks = merged.filter(
                (x) => transactionMode(x) === 'LINK' && isOpen(x.state),
              ).length
              setUiPrefs({ openLinkCount: openLinks })
              return merged
            })
            setHasMore(Boolean(res.hasMore))
            setError(null)
            setLoading(false)
            setLastLoaded(new Date())
            for (const x of res.data) updateRecent(x.id, { state: x.state })
          },
          (err: unknown) => {
            if (controller.signal.aborted || (isWalleeApiError(err) && err.kind === 'aborted'))
              return
            setError(
              t('history.loadError', {
                message: describeApiError(err, t, { spaceId: cfg.spaceId }),
              }),
            )
            setLoading(false)
          },
        )
    },
    [cfg, queryMode, t],
  )

  useEffect(() => {
    void load(0)
    return () => abortRef.current?.abort()
  }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((x) => {
      if (filter === 'open' && !isOpen(x.state)) return false
      if (filter === 'paid' && !(isPaid(x.state) || x.state === 'AUTHORIZED')) return false
      if (filter === 'failed' && !(isFailed(x.state) || x.state === 'VOIDED')) return false
      if (!q) return true
      return (
        (x.merchantReference ?? '').toLowerCase().includes(q) ||
        customerOf(x).toLowerCase().includes(q) ||
        (x.customerEmailAddress ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, filter, search])

  const openRow = (x: Transaction) =>
    navigate(`/${transactionMode(x) === 'MOTO' ? 'moto' : 'link'}/${x.id}`)

  const action = async (key: string, fn: () => Promise<void>) => {
    setBusy(key)
    try {
      await fn()
    } catch (err) {
      toast.error(
        t('history.actionError', { message: describeApiError(err, t, { spaceId: cfg.spaceId }) }),
      )
    } finally {
      setBusy(null)
    }
  }

  const resend = (x: Transaction) =>
    action(`resend-${x.id}`, async () => {
      const level = currentLevel(await searchChargeFlowLevels(cfg, x.id))
      if (!level) throw new Error(t('link.noLevel'))
      await sendChargeFlowLevelMessage(cfg, level.id)
      toast.success(t('history.resent'))
    })
  const complete = (x: Transaction) =>
    action(`complete-${x.id}`, async () => {
      await completeOnline(cfg, x.id)
      toast.success(t('history.completed'))
      await load(0)
    })
  const voidTx = (x: Transaction) =>
    action(`void-${x.id}`, async () => {
      await voidOnline(cfg, x.id)
      toast.success(t('history.voided'))
      await load(0)
    })
  const receipt = (x: Transaction) =>
    action(`receipt-${x.id}`, async () => {
      const doc = await getInvoiceDocument(cfg, x.id)
      downloadBase64(
        doc.data,
        doc.mimeType ?? 'application/pdf',
        safeFilename(
          doc.title || `Beleg-${x.merchantReference ?? x.id}`,
          extensionForMime(doc.mimeType),
        ),
      )
    })

  const cancelledLocally = (x: Transaction) =>
    readRecent().find((r) => r.transactionId === x.id)?.cancelledLocally

  return (
    <>
      <Headline
        kicker={t('headline.history.kicker')}
        title={t('headline.history.title')}
        actions={
          <>
            <span className="small muted">
              {lastLoaded
                ? t('history.last', {
                    time: lastLoaded.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'de-CH', {
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })
                : ''}
            </span>
            <Button
              variant="secondary"
              icon={<Icon name="refresh" />}
              onClick={() => void load(0)}
              loading={loading && rows.length > 0}
            >
              {t('history.refresh')}
            </Button>
          </>
        }
      />

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--s-2)' }}>
        <Segmented<Filter>
          aria-label={t('history.col.status')}
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('history.filter.all') },
            { value: 'open', label: t('history.filter.open') },
            { value: 'paid', label: t('history.filter.paid') },
            { value: 'failed', label: t('history.filter.failed') },
          ]}
        />
        <div style={{ minWidth: 260 }}>
          <Input
            aria-label={t('history.search')}
            placeholder={t('history.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            trailing={
              <span className="field__trailing" aria-hidden="true">
                <Icon name="search" />
              </span>
            }
          />
        </div>
      </div>
      {queryMode === 'reference' && (
        <p className="small muted" style={{ marginBottom: 'var(--s-2)' }}>
          {t('history.fallbackHint', { prefix: cfg.merchantReferencePrefix })}
        </p>
      )}
      {error && (
        <div
          className="banner"
          role="alert"
          style={{ borderRadius: 'var(--r-sm)', padding: '12px 16px', marginBottom: 'var(--s-2)' }}
        >
          <Icon name="warning" />
          <div>{error}</div>
        </div>
      )}

      <Table<Transaction>
        caption={t('headline.history.title')}
        columns={[
          {
            key: 'date',
            header: t('history.col.date'),
            render: (x) => <span className="tnum">{fmtDate(x.createdOn, lang)}</span>,
          },
          {
            key: 'reference',
            header: t('history.col.reference'),
            render: (x) => <span className="tnum">{x.merchantReference ?? x.id}</span>,
          },
          { key: 'customer', header: t('history.col.customer'), render: (x) => customerOf(x) },
          {
            key: 'amount',
            header: t('history.col.amount'),
            align: 'right',
            render: (x) => (
              <span className="tnum">
                {x.currency}{' '}
                {formatAmount(fromMajor(x.completedAmount || x.authorizationAmount || 0))}
              </span>
            ),
          },
          {
            key: 'mode',
            header: t('history.col.mode'),
            render: (x) => t(`history.mode.${transactionMode(x)}`),
          },
          {
            key: 'status',
            header: t('history.col.status'),
            render: (x) => <StatusBadge status={badgeFor(x.state, cancelledLocally(x))} />,
          },
          {
            key: 'actions',
            header: t('history.col.actions'),
            align: 'right',
            render: (x) => (
              <div
                className="row"
                style={{ justifyContent: 'flex-end', gap: 4, flexWrap: 'nowrap' }}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {transactionMode(x) === 'LINK' && isOpen(x.state) && x.state !== 'AUTHORIZED' && (
                  <Button
                    variant="text"
                    onClick={() => void resend(x)}
                    loading={busy === `resend-${x.id}`}
                  >
                    {t('history.resend')}
                  </Button>
                )}
                {x.state === 'AUTHORIZED' && (
                  <>
                    <Button
                      variant="text"
                      onClick={() => void complete(x)}
                      loading={busy === `complete-${x.id}`}
                    >
                      {t('history.complete')}
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => void voidTx(x)}
                      loading={busy === `void-${x.id}`}
                    >
                      {t('history.void')}
                    </Button>
                  </>
                )}
                {isPaid(x.state) && (
                  <Button
                    variant="text"
                    onClick={() => void receipt(x)}
                    loading={busy === `receipt-${x.id}`}
                  >
                    {t('history.receipt')}
                  </Button>
                )}
                <Button variant="text" onClick={() => openRow(x)}>
                  {t('history.open')}
                </Button>
              </div>
            ),
          },
        ]}
        rows={visible}
        rowKey={(x) => String(x.id)}
        onRowClick={openRow}
        loading={loading && rows.length === 0}
        empty={
          rows.length === 0 ? (
            <EmptyState
              title={t('history.empty')}
              text={t('history.emptyText')}
              action={<Button onClick={() => navigate('/')}>{t('nav.new')}</Button>}
            />
          ) : (
            <span className="muted">{t('history.emptyFiltered')}</span>
          )
        }
      />
      {hasMore && (
        <div style={{ marginTop: 'var(--s-2)' }}>
          <Button variant="secondary" onClick={() => void load(rows.length)} loading={loading}>
            {t('history.more')}
          </Button>
        </div>
      )}
    </>
  )
}
