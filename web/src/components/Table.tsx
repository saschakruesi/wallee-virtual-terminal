import type { ReactNode } from 'react'
import { useT } from '@/i18n'

export type Column<Row> = {
  key: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  width?: string
  render: (row: Row) => ReactNode
}

type Props<Row> = {
  columns: Column<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
  onRowClick?: (row: Row) => void
  loading?: boolean
  /** Rendered inside the table when there are no rows and not loading. */
  empty?: ReactNode
  caption?: string
}

export function Table<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading,
  empty,
  caption,
}: Props<Row>) {
  const t = useT()
  const alignCls = (a?: Column<Row>['align']) =>
    a === 'right' ? 'is-right' : a === 'center' ? 'is-center' : ''
  return (
    <div className="table-wrap">
      <table className="table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={alignCls(c.align)}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading &&
            rows.length === 0 &&
            Array.from({ length: 3 }).map((_, i) => (
              <tr key={`skeleton-${i}`} aria-hidden="true">
                {columns.map((c) => (
                  <td key={c.key}>
                    <span
                      className="table__skeleton"
                      style={{ width: `${55 + ((i * 17) % 35)}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          {loading && rows.length === 0 && (
            <tr className="visually-hidden">
              <td role="status">{t('table.loading')}</td>
            </tr>
          )}
          {!loading && rows.length === 0 && (
            <tr className="table__empty">
              <td colSpan={columns.length}>
                {empty ?? <span className="muted">{t('common.noEntries')}</span>}
              </td>
            </tr>
          )}
          {rows.map((row) => {
            const clickable = Boolean(onRowClick)
            return (
              <tr
                key={rowKey(row)}
                className={clickable ? 'is-clickable' : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={clickable ? () => onRowClick?.(row) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowClick?.(row)
                        }
                      }
                    : undefined
                }
              >
                {columns.map((c) => (
                  <td key={c.key} className={alignCls(c.align)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
