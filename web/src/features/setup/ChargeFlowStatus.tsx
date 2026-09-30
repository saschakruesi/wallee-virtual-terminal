import { useCallback, useEffect, useRef, useState } from 'react'
import { isWalleeApiError } from '@/api/client'
import type { ApiCredentials } from '@/api/client'
import { chargeFlowPortalUrl, countActiveChargeFlows, listChargeFlows } from '@/api/chargeFlows'
import { Button, Icon } from '@/components'
import { useT } from '@/i18n'

/** `count` is unknown (undefined) until the flows were read in this session. */
export type ChargeFlowCheck =
  | { status: 'ok'; count?: number }
  | { status: 'missing' }
  | { status: 'forbidden'; message: string }

type Props = {
  creds: ApiCredentials
  check: ChargeFlowCheck
  onChange: (check: ChargeFlowCheck) => void
  /** Injectable for tests. */
  listFlows?: typeof listChargeFlows
}

/**
 * Shows whether the space has an active charge flow (needed for payment links). Without one,
 * a short guide links into the portal; the check repeats when the employee returns to this
 * window, so the panel turns to «ready» by itself.
 */
export function ChargeFlowStatus({ creds, check, onChange, listFlows = listChargeFlows }: Props) {
  const t = useT()
  const [checking, setChecking] = useState(false)
  const busy = useRef(false)

  const recheck = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setChecking(true)
    try {
      const count = countActiveChargeFlows(await listFlows(creds))
      onChange(count > 0 ? { status: 'ok', count } : { status: 'missing' })
    } catch (err) {
      // Network failures keep the current state; the offline bar reports them.
      if (isWalleeApiError(err) && (err.status === 401 || err.status === 403))
        onChange({ status: 'forbidden', message: err.message })
    } finally {
      busy.current = false
      setChecking(false)
    }
  }, [creds, listFlows, onChange])

  useEffect(() => {
    if (check.status !== 'missing') return
    window.addEventListener('focus', recheck)
    return () => window.removeEventListener('focus', recheck)
  }, [check.status, recheck])

  const recheckButton = (
    <Button variant="secondary" loading={checking} onClick={recheck}>
      {t('setup.chargeFlow.recheck')}
    </Button>
  )

  if (check.status === 'ok')
    return (
      <div className="flow-status flow-status--ok" role="status">
        <span className="flow-status__mark">
          <Icon name="check" size="sm" />
        </span>
        <div>
          <div className="flow-status__title">{t('setup.chargeFlow.ok.title')}</div>
          <div className="small">
            {check.count === undefined
              ? t('setup.chargeFlow.ok.text')
              : t('setup.chargeFlow.ok.count', { count: check.count })}
          </div>
        </div>
      </div>
    )

  if (check.status === 'forbidden')
    return (
      <div className="flow-status flow-status--todo" role="status">
        <div className="flow-status__title">{t('setup.chargeFlow.forbidden.title')}</div>
        <p className="small">{t('setup.chargeFlow.forbidden.text', { message: check.message })}</p>
        <div>{recheckButton}</div>
      </div>
    )

  return (
    <div className="flow-status flow-status--todo" role="status">
      <div className="flow-status__title">{t('setup.chargeFlow.missing.title')}</div>
      <p className="small">{t('setup.chargeFlow.missing.text')}</p>
      <ol className="flow-status__steps small">
        <li>
          <a href={chargeFlowPortalUrl(creds.spaceId)} target="_blank" rel="noopener noreferrer">
            {t('setup.chargeFlow.step1.link')}
          </a>{' '}
          {t('setup.chargeFlow.step1')}
        </li>
        <li>{t('setup.chargeFlow.step2')}</li>
        <li>{t('setup.chargeFlow.step3')}</li>
        <li>{t('setup.chargeFlow.step4')}</li>
      </ol>
      <div>{recheckButton}</div>
    </div>
  )
}
