import { useT } from '@/i18n'
import { Headline } from '@/components'
import { PhasePlaceholder } from '@/app/PhasePlaceholder'

export function ProductsPage() {
  const t = useT()
  return (
    <>
      <Headline kicker={t('headline.products.kicker')} title={t('headline.products.title')} />
      <PhasePlaceholder phase={6} />
    </>
  )
}
