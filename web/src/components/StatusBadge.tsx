import { useT } from '@/i18n'

export type BadgeStatus =
  | 'paid'
  | 'completed'
  | 'authorized'
  | 'open'
  | 'pending'
  | 'failed'
  | 'cancelled'
  | 'expired'
  | 'test'

const TONE: Record<BadgeStatus, string> = {
  paid: 'paid',
  completed: 'completed',
  authorized: 'authorized',
  open: 'open',
  pending: 'open',
  failed: 'failed',
  cancelled: 'cancelled',
  expired: 'cancelled',
  test: 'test',
}

type Props = { status: BadgeStatus; label?: string; className?: string }

export function StatusBadge({ status, label, className }: Props) {
  const t = useT()
  return (
    <span className={['badge', `badge--${TONE[status]}`, className ?? ''].join(' ').trim()}>
      {label ?? t(`badge.${status}`)}
    </span>
  )
}
