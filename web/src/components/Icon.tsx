import type { SVGProps } from 'react'

export type IconName =
  | 'search'
  | 'plus'
  | 'copy'
  | 'external'
  | 'check'
  | 'close'
  | 'warning'
  | 'download'
  | 'refresh'
  | 'eye'
  | 'eye-off'
  | 'chevron-down'
  | 'chevron-right'
  | 'trash'
  | 'settings'

/** Minimal monochrome line icons (1.5 px), 20 px grid. */
const PATHS: Record<IconName, string> = {
  search: 'M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM17.5 17.5l-3.9-3.9',
  plus: 'M10 4v12M4 10h12',
  copy: 'M7 7V4.5A1.5 1.5 0 0 1 8.5 3h7A1.5 1.5 0 0 1 17 4.5v7a1.5 1.5 0 0 1-1.5 1.5H13M4.5 7h7A1.5 1.5 0 0 1 13 8.5v7a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 15.5v-7A1.5 1.5 0 0 1 4.5 7Z',
  external:
    'M11 3h6v6M17 3l-8 8M15 11v4.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 15.5v-9A1.5 1.5 0 0 1 4.5 5H9',
  check: 'M4 10.5l4 4 8-9',
  close: 'M5 5l10 10M15 5L5 15',
  warning: 'M10 3.5l7.5 13h-15L10 3.5ZM10 8v4M10 14.2v.3',
  download: 'M10 3v10M6 9l4 4 4-4M4 16.5h12',
  refresh: 'M16.5 10A6.5 6.5 0 1 1 14 4.9M16.5 3.5v4h-4',
  eye: 'M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10Zm8 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  'eye-off':
    'M3 3l14 14M8.3 8.4A2.5 2.5 0 0 0 11.7 11.7M6.5 6.6C4 8.1 2 10 2 10s3 5.5 8 5.5c1.4 0 2.6-.4 3.6-1M8.6 4.8c.5-.1.9-.3 1.4-.3 5 0 8 5.5 8 5.5s-.9 1.6-2.4 3',
  'chevron-down': 'M5 8l5 5 5-5',
  'chevron-right': 'M8 5l5 5-5 5',
  trash: 'M4 6h12M8 6V4h4v2M6 6l.7 10h6.6L14 6M8.5 9v4M11.5 9v4',
  settings: 'M3 5.5h14M3 10h14M3 14.5h14M7.5 3.5v4M12.5 8v4M6 12.5v4',
}

type Props = SVGProps<SVGSVGElement> & {
  name: IconName
  size?: 'sm' | 'md'
  /** Accessible label; without it the icon is decorative. */
  label?: string
}

export function Icon({ name, size = 'md', label, className, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={['icon', size === 'sm' ? 'icon--sm' : '', className ?? ''].join(' ').trim()}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
