import { useT } from '@/i18n'

type Props = { size?: 'sm' | 'md' | 'lg'; label?: string; className?: string }

export function Spinner({ size = 'md', label, className }: Props) {
  const t = useT()
  const cls = ['spinner', size !== 'md' ? `spinner--${size}` : '', className ?? ''].join(' ').trim()
  return <span className={cls} role="status" aria-label={label ?? t('common.loading')} />
}
