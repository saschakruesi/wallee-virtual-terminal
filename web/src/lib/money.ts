/**
 * Money arithmetic in minor units (Rappen / cents) as integers. Formatting follows the
 * Swiss convention `1'234.50`; parsing accepts `.` and `,` as decimal separators.
 * All supported currencies (CHF, EUR, USD, GBP) have two decimals.
 */

export const MINOR_PER_MAJOR = 100

/** Rounds half away from zero to an integer (commercial rounding). */
export function roundHalfUp(value: number): number {
  return Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON)
}

/** Integer minor units → decimal major amount with max two decimals (for API payloads). */
export function toMajor(minor: number): number {
  return Number((minor / MINOR_PER_MAJOR).toFixed(2))
}

/** Decimal major amount → integer minor units. */
export function fromMajor(major: number): number {
  return roundHalfUp(major * MINOR_PER_MAJOR)
}

/** `123456` → `1'234.56`; `-2000` → `-20.00`. */
export function formatAmount(minor: number, options: { negativeInParens?: boolean } = {}): string {
  const abs = Math.abs(Math.trunc(minor))
  const major = Math.floor(abs / MINOR_PER_MAJOR)
  const cents = abs % MINOR_PER_MAJOR
  const grouped = major.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
  const text = `${grouped}.${cents.toString().padStart(2, '0')}`
  if (minor < 0) return options.negativeInParens ? `(${text})` : `-${text}`
  return text
}

/** `CHF 1'234.56` */
export function formatMoney(minor: number, currency: string): string {
  return `${currency} ${formatAmount(minor)}`
}

/**
 * Parses user input into minor units. Accepts `1234.5`, `1'234.50`, `1 234,50`, `-20`,
 * `CHF 12.00`. Returns null for empty or invalid input or more than two decimals.
 */
export function parseAmount(input: string): number | null {
  let s = input
    .trim()
    .replace(/[A-Za-z]/g, '')
    .replace(/[\s'’]/g, '')
  if (s === '') return null
  const negative = s.startsWith('-') || (s.startsWith('(') && s.endsWith(')'))
  s = s.replace(/^[-(]/, '').replace(/\)$/, '')
  // If both separators occur, the last one is the decimal separator.
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const thousandsSep = decimalSep === ',' ? '.' : ','
    s = s.split(thousandsSep).join('').replace(decimalSep, '.')
  } else {
    s = s.replace(',', '.')
  }
  if (!/^\d*(\.\d{0,2})?$/.test(s) || s === '.') return null
  const [intPart = '0', decPart = ''] = s.split('.')
  const minor = Number(intPart || '0') * MINOR_PER_MAJOR + Number((decPart + '00').slice(0, 2))
  if (!Number.isFinite(minor)) return null
  return negative ? -minor : minor
}

/** Line total: unit price × quantity (quantity may have up to three decimals). */
export function multiply(minor: number, quantity: number): number {
  return roundHalfUp(minor * quantity)
}

/** `percent` of an amount, e.g. 10 % of 12'000 → 1'200. */
export function percentOf(minor: number, percent: number): number {
  return roundHalfUp((minor * percent) / 100)
}

/** Tax contained in a gross amount at `rate` percent (gross − net). */
export function taxPortion(grossMinor: number, rate: number): number {
  if (rate <= 0) return 0
  return grossMinor - roundHalfUp(grossMinor / (1 + rate / 100))
}

/** Sum helper that keeps integers exact. */
export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}
