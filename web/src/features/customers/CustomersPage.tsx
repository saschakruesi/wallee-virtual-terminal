import { useT } from '@/i18n'
import { Headline } from '@/components'
import { PhasePlaceholder } from '@/app/PhasePlaceholder'

export function CustomersPage() {
  const t = useT()
  return (
    <>
      <Headline kicker={t('headline.customers.kicker')} title={t('headline.customers.title')} />
      <PhasePlaceholder phase={5} />
    </>
  )
}
