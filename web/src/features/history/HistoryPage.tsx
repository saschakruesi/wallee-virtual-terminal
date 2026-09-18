import { useT } from '@/i18n'
import { Headline } from '@/components'
import { PhasePlaceholder } from '@/app/PhasePlaceholder'

export function HistoryPage() {
  const t = useT()
  return (
    <>
      <Headline kicker={t('headline.history.kicker')} title={t('headline.history.title')} />
      <PhasePlaceholder phase={6} />
    </>
  )
}
