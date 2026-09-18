import { Link } from 'react-router-dom'
import { useT } from '@/i18n'
import { EmptyState, Headline } from '@/components'

export function NotFoundPage() {
  const t = useT()
  return (
    <>
      <Headline kicker={t('headline.notFound.kicker')} title={t('headline.notFound.title')} />
      <EmptyState title={t('notFound.text')} action={<Link to="/">{t('notFound.home')}</Link>} />
    </>
  )
}
