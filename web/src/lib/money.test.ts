import { describe, expect, it } from 'vitest'
import {
  formatAmount,
  formatMoney,
  fromMajor,
  multiply,
  parseAmount,
  percentOf,
  roundHalfUp,
  taxPortion,
  toMajor,
} from './money'

describe('formatAmount', () => {
  it('uses Swiss apostrophes and two decimals', () => {
    expect(formatAmount(0)).toBe('0.00')
    expect(formatAmount(5)).toBe('0.05')
    expect(formatAmount(123456)).toBe("1'234.56")
    expect(formatAmount(100000000)).toBe("1'000'000.00")
    expect(formatAmount(-2000)).toBe('-20.00')
    expect(formatAmount(-2000, { negativeInParens: true })).toBe('(20.00)')
    expect(formatMoney(48000, 'CHF')).toBe('CHF 480.00')
  })
})

describe('parseAmount', () => {
  it('accepts dot and comma decimals and thousands separators', () => {
    expect(parseAmount('12')).toBe(1200)
    expect(parseAmount('12.5')).toBe(1250)
    expect(parseAmount('12,50')).toBe(1250)
    expect(parseAmount("1'234.50")).toBe(123450)
    expect(parseAmount('1 234,50')).toBe(123450)
    expect(parseAmount('1.234,50')).toBe(123450)
    expect(parseAmount('1,234.50')).toBe(123450)
    expect(parseAmount('CHF 7.00')).toBe(700)
    expect(parseAmount('-20')).toBe(-2000)
    expect(parseAmount('(20.00)')).toBe(-2000)
    expect(parseAmount('.5')).toBe(50)
    expect(parseAmount('0')).toBe(0)
  })
  it('rejects empty, invalid and over-precise input', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('1.234')).toBeNull()
    expect(parseAmount('1..2')).toBeNull()
    expect(parseAmount('.')).toBeNull()
  })
})

describe('arithmetic', () => {
  it('rounds half away from zero', () => {
    expect(roundHalfUp(2.5)).toBe(3)
    expect(roundHalfUp(-2.5)).toBe(-3)
    expect(roundHalfUp(2.4999)).toBe(2)
  })
  it('converts between major and minor units without float drift', () => {
    expect(toMajor(123456)).toBe(1234.56)
    expect(toMajor(-2000)).toBe(-20)
    expect(fromMajor(1234.56)).toBe(123456)
    expect(fromMajor(0.1 + 0.2)).toBe(30)
  })
  it('multiplies with decimal quantities and computes percentages', () => {
    expect(multiply(700, 2)).toBe(1400)
    expect(multiply(999, 1.5)).toBe(1499)
    expect(multiply(-2000, 3)).toBe(-6000)
    expect(percentOf(12000, 10)).toBe(1200)
    expect(percentOf(999, 3.3)).toBe(33)
  })
  it('extracts the tax portion of a gross amount', () => {
    expect(taxPortion(10810, 8.1)).toBe(810)
    expect(taxPortion(48000, 3.8)).toBe(1757)
    expect(taxPortion(1000, 0)).toBe(0)
  })
})
