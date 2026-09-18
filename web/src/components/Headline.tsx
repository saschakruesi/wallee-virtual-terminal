import type { ReactNode } from 'react'

type Props = { kicker: string; title: string; actions?: ReactNode }

/** wallee two-line headline: grey light kicker over black medium title, same size. */
export function Headline({ kicker, title, actions }: Props) {
  const heading = (
    <h1 className="headline">
      <span className="headline__kicker">{kicker}</span>
      <span className="headline__title">{title}</span>
    </h1>
  )
  if (!actions) return heading
  return (
    <div className="headline--row">
      {heading}
      <div className="row" style={{ marginBottom: 'var(--s-4)' }}>
        {actions}
      </div>
    </div>
  )
}
