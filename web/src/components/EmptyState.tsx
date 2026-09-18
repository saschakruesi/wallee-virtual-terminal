import type { ReactNode } from 'react'

type Props = { title: string; text?: string; action?: ReactNode; center?: boolean }

export function EmptyState({ title, text, action, center }: Props) {
  return (
    <div className={['empty', center ? 'empty--center' : ''].join(' ').trim()}>
      <div className="empty__title">{title}</div>
      {text && <p className="empty__text">{text}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}
