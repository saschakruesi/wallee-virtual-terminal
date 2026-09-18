import { useT } from '@/i18n'
import { Headline, Stepper } from '@/components'
import { PhasePlaceholder } from '@/app/PhasePlaceholder'

export function NewTransactionPage() {
  const t = useT()
  return (
    <>
      <Headline kicker={t('headline.new.kicker')} title={t('headline.new.title')} />
      <Stepper
        steps={[
          { label: t('stepper.customer') },
          { label: t('stepper.items') },
          { label: t('stepper.review') },
        ]}
        current={0}
      />
      <PhasePlaceholder phase={3} />
    </>
  )
}
