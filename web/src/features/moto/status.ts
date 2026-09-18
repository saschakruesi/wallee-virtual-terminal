import type { BadgeStatus } from '@/components'
import { isPaid } from '@/api/transactions'
import type { TransactionState } from '@/api/transactions'

/** Maps a wallee state (plus local cancellation) to the badge tone. */
export function badgeFor(state: TransactionState, cancelledLocally?: boolean): BadgeStatus {
  if (cancelledLocally && !isPaid(state) && state !== 'AUTHORIZED') return 'cancelled'
  switch (state) {
    case 'FULFILL':
      return 'completed'
    case 'COMPLETED':
      return 'paid'
    case 'AUTHORIZED':
      return 'authorized'
    case 'FAILED':
    case 'DECLINE':
      return 'failed'
    case 'VOIDED':
      return 'cancelled'
    default:
      return 'pending'
  }
}
