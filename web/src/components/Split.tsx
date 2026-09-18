import type { ReactNode } from 'react'

type Props = {
  left: ReactNode
  right: ReactNode
  /** Which pane is the turquoise surface. */
  turquoise?: 'left' | 'right' | 'none'
  /** 5/7 (default), even 1/1, or reverse 7/5. */
  ratio?: 'default' | 'even' | 'reverse'
  className?: string
}

export function Split({ left, right, turquoise = 'right', ratio = 'default', className }: Props) {
  const pane = (side: 'left' | 'right', children: ReactNode) => {
    const isTurquoise = turquoise === side
    const cls = [
      'split__pane',
      isTurquoise ? 'split__pane--turquoise on-turquoise' : 'split__pane--white',
    ].join(' ')
    return <div className={cls}>{children}</div>
  }
  const cls = [
    'split',
    ratio === 'even' ? 'split--even' : ratio === 'reverse' ? 'split--reverse' : '',
    className ?? '',
  ]
    .join(' ')
    .trim()
  return (
    <div className={cls}>
      {pane('left', left)}
      {pane('right', right)}
    </div>
  )
}
