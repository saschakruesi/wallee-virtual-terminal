import { Link } from 'react-router-dom'
import { useT } from '@/i18n'
import { EmptyState } from '@/components'

/** Temporary body for screens that arrive in a later phase of the implementation plan. */
export function PhasePlaceholder({ phase }: { phase: number }) {
  const t = useT()
  return (
    <EmptyState
      title={t('placeholder.title', { phase })}
      text={t('placeholder.text')}
      action={<Link to="/setup">{t('placeholder.toSetup')}</Link>}
    />
  )
}
