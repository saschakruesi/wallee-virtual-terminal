import { useEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { checkForUpdate, getHelperVersion, getUpdateStatus, startUpdate } from '@/api/update'
import type { UpdateCheck, UpdateStatus } from '@/api/update'
import { Button } from './Button'
import { ConfirmDialog } from './Modal'
import { Icon } from './Icon'
import { Spinner } from './Spinner'

type Phase =
  | { kind: 'hidden' }
  | { kind: 'available'; check: UpdateCheck }
  | { kind: 'updating'; target: string; status: UpdateStatus | null }
  | { kind: 'waiting'; target: string; since: number }
  | { kind: 'done'; target: string }
  | { kind: 'error'; target: string; message: string; releaseUrl?: string }

const DISMISS_KEY = 'wvt.updateDismissed'
const WAIT_LIMIT_MS = 90_000

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

/**
 * Checks the helper for a newer GitHub release on startup and shows a bar at the very top
 * with a clear status and a single action: «Update starten». The helper downloads, verifies,
 * replaces itself and restarts; the banner waits for the new version and reloads the page.
 */
export function UpdateBanner() {
  const t = useT()
  const [phase, setPhase] = useState<Phase>({ kind: 'hidden' })
  const [confirm, setConfirm] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Startup check (once per page load; the helper caches GitHub answers for an hour).
  useEffect(() => {
    let cancelled = false
    checkForUpdate()
      .then((check) => {
        if (cancelled || !check.updateAvailable || !check.latest) return
        let dismissed: string | null = null
        try {
          dismissed = window.sessionStorage.getItem(DISMISS_KEY)
        } catch {
          /* ignore */
        }
        if (dismissed === check.latest) return
        setPhase({ kind: 'available', check })
      })
      .catch(() => undefined) // no helper (dev server / static hosting): nothing to show
    return () => {
      cancelled = true
    }
  }, [])

  // Poll the helper while it updates, then wait for the new version to answer.
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = null
    if (phase.kind !== 'updating' && phase.kind !== 'waiting') return
    const target = phase.target
    pollRef.current = setInterval(() => {
      if (phase.kind === 'updating') {
        getUpdateStatus().then(
          (status) => {
            if (status.state === 'error')
              setPhase({ kind: 'error', target, message: status.message ?? '' })
            else if (status.state === 'restarting')
              setPhase({ kind: 'waiting', target, since: Date.now() })
            else setPhase({ kind: 'updating', target, status })
          },
          () => setPhase({ kind: 'waiting', target, since: Date.now() }), // helper already gone: restarting
        )
      } else {
        getHelperVersion().then(
          (v) => {
            // Match, or the target predates the updater (answers without a version): both mean the new binary is up.
            if (v === '' || v === target || v.replace(/^v/, '') === target.replace(/^v/, '')) {
              setPhase({ kind: 'done', target })
              setTimeout(() => window.location.reload(), 1200)
            } else if (Date.now() - phase.since > WAIT_LIMIT_MS) {
              setPhase({ kind: 'error', target, message: t('update.error.timeout') })
            }
          },
          () => {
            if (Date.now() - phase.since > WAIT_LIMIT_MS)
              setPhase({ kind: 'error', target, message: t('update.error.timeout') })
          },
        )
      }
    }, 1000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [phase, t])

  if (phase.kind === 'hidden') return null

  const start = async () => {
    if (phase.kind !== 'available') return
    setConfirm(false)
    const target = phase.check.latest!
    try {
      await startUpdate(target)
      setPhase({ kind: 'updating', target, status: null })
    } catch (err) {
      setPhase({
        kind: 'error',
        target,
        message: err instanceof Error ? err.message : String(err),
        releaseUrl: phase.check.releaseUrl,
      })
    }
  }

  const dismiss = () => {
    if (phase.kind === 'available') {
      try {
        window.sessionStorage.setItem(DISMISS_KEY, phase.check.latest ?? '')
      } catch {
        /* ignore */
      }
    }
    setPhase({ kind: 'hidden' })
  }

  let body: React.ReactNode
  let tone: 'info' | 'busy' | 'ok' | 'error' = 'info'
  switch (phase.kind) {
    case 'available': {
      const c = phase.check
      body = (
        <>
          <Icon name="download" />
          <span className="update-banner__text">
            <strong>{t('update.available', { latest: c.latest ?? '', current: c.current })}</strong>
            {c.assetSize ? (
              <span className="update-banner__meta"> · {formatMb(c.assetSize)} MB</span>
            ) : null}
          </span>
          <span className="update-banner__actions">
            {c.releaseUrl && (
              <a
                href={c.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--text"
              >
                {t('update.notes')}
              </a>
            )}
            <Button variant="secondary" onClick={dismiss}>
              {t('update.later')}
            </Button>
            <Button onClick={() => setConfirm(true)}>{t('update.start')}</Button>
          </span>
        </>
      )
      break
    }
    case 'updating': {
      tone = 'busy'
      const s = phase.status
      const percent =
        s && s.total > 0 ? Math.min(100, Math.round((s.received / s.total) * 100)) : null
      const label =
        !s || s.state === 'downloading'
          ? percent === null
            ? t('update.step.downloading')
            : t('update.step.downloadingPercent', { percent })
          : s.state === 'verifying'
            ? t('update.step.verifying')
            : s.state === 'installing'
              ? t('update.step.installing')
              : t('update.step.restarting')
      body = (
        <>
          <Spinner size="sm" />
          <span className="update-banner__text">
            <strong>{t('update.updatingTo', { target: phase.target })}</strong> · {label}
          </span>
          {percent !== null && (
            <span className="update-banner__progress" aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </span>
          )}
        </>
      )
      break
    }
    case 'waiting':
      tone = 'busy'
      body = (
        <>
          <Spinner size="sm" />
          <span className="update-banner__text">
            <strong>{t('update.updatingTo', { target: phase.target })}</strong> ·{' '}
            {t('update.step.waiting')}
          </span>
        </>
      )
      break
    case 'done':
      tone = 'ok'
      body = (
        <>
          <Icon name="check" />
          <span className="update-banner__text">
            <strong>{t('update.done', { target: phase.target })}</strong>
          </span>
        </>
      )
      break
    case 'error':
      tone = 'error'
      body = (
        <>
          <Icon name="warning" />
          <span className="update-banner__text">
            <strong>{t('update.failed')}</strong> {phase.message}
          </span>
          <span className="update-banner__actions">
            {phase.releaseUrl && (
              <a
                href={phase.releaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--text"
              >
                {t('update.manual')}
              </a>
            )}
            <Button variant="secondary" onClick={() => setPhase({ kind: 'hidden' })}>
              {t('common.close')}
            </Button>
          </span>
        </>
      )
      break
  }

  return (
    <>
      <div
        className={`update-banner update-banner--${tone}`}
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live="polite"
      >
        {body}
      </div>
      <ConfirmDialog
        open={confirm}
        title={t('update.confirmTitle')}
        message={t('update.confirmMessage')}
        confirmLabel={t('update.start')}
        onConfirm={() => void start()}
        onCancel={() => setConfirm(false)}
      />
    </>
  )
}
