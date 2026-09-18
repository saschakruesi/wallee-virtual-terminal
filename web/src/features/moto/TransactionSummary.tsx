import { useI18n } from '@/i18n'
import { StatusBadge, StatusTimeline } from '@/components'
import type { BadgeStatus } from '@/components'
import type { Transaction } from '@/api/transactions'
import { formatAmount, formatMoney, fromMajor } from '@/lib/money'

type Props = {
  transaction: Transaction
  mode: 'MOTO' | 'LINK'
  badge: BadgeStatus
  showTestBadge: boolean
  failureText?: string
  amount: number
  currency: string
}

/** Left pane of the MOTO and payment-link screens: badge, timeline, customer, reference, items, total. */
export function TransactionSummary({
  transaction,
  mode,
  badge,
  showTestBadge,
  failureText,
  amount,
  currency,
}: Props) {
  const { t, lang } = useI18n()
  const c = transaction.billingAddress
  const customerName =
    [c?.givenName, c?.familyName].filter(Boolean).join(' ') ||
    c?.organizationName ||
    transaction.customerEmailAddress ||
    t('customer.none')
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <StatusBadge status={badge} />
        {showTestBadge && <StatusBadge status="test" />}
      </div>
      <StatusTimeline transaction={transaction} mode={mode} failureText={failureText} lang={lang} />
      <dl className="summary-list">
        <dt>{t('moto.customer')}</dt>
        <dd>
          {customerName}
          {transaction.customerEmailAddress &&
            customerName !== transaction.customerEmailAddress && (
              <span className="muted"> · {transaction.customerEmailAddress}</span>
            )}
        </dd>
        <dt>{t('moto.reference')}</dt>
        <dd className="tnum">{transaction.merchantReference ?? '—'}</dd>
        <dt>{t('moto.transactionId')}</dt>
        <dd className="tnum">{transaction.id}</dd>
      </dl>
      <table className="table">
        <tbody>
          {(transaction.lineItems ?? []).map((li, i) => (
            <tr key={li.uniqueId ?? i}>
              <td>
                {li.name}
                {li.quantity != null && li.quantity !== 1 && (
                  <span className="small muted"> × {li.quantity}</span>
                )}
              </td>
              <td className="is-right tnum">
                {formatAmount(fromMajor(li.amountIncludingTax ?? 0), { negativeInParens: true })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: 'right' }}>
        <div className="small muted">{t('moto.total')}</div>
        <div className="display-amount">{formatMoney(amount, currency)}</div>
      </div>
    </div>
  )
}
