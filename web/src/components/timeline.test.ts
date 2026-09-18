import { describe, expect, it } from 'vitest'
import { buildTimeline } from './timeline'
import type { Transaction } from '@/api/transactions'

const tr = (k: string) => k
const base: Transaction = { id: 1, state: 'PENDING', createdOn: '2026-09-18T10:00:00Z' }

describe('buildTimeline', () => {
  it('marks the current step for open states', () => {
    const { steps, end } = buildTimeline(
      { ...base, state: 'CONFIRMED', confirmedOn: '2026-09-18T10:01:00Z' },
      { mode: 'MOTO' },
      tr,
    )
    expect(steps.map((s) => s.status)).toEqual(['done', 'current', 'open', 'open', 'open'])
    expect(steps[0]!.label).toBe('timeline.created')
    expect(end).toBeUndefined()
  })
  it('uses the link label in LINK mode', () => {
    expect(buildTimeline(base, { mode: 'LINK' }, tr).steps[0]!.label).toBe('timeline.linkSent')
  })
  it('completes every step for FULFILL', () => {
    const { steps } = buildTimeline(
      { ...base, state: 'FULFILL', completedOn: '2026-09-18T10:05:00Z' },
      { mode: 'MOTO' },
      tr,
    )
    expect(steps.every((s) => s.status === 'done')).toBe(true)
    expect(steps[4]!.timestamp).toBe('2026-09-18T10:05:00Z')
  })
  it('stops at the last reached step with a failed end marker', () => {
    const { steps, end } = buildTimeline(
      { ...base, state: 'FAILED', confirmedOn: 'x', failedOn: 'y' },
      { mode: 'MOTO' },
      tr,
    )
    expect(steps.map((s) => s.status)).toEqual(['done', 'done', 'open', 'open', 'open'])
    expect(end?.kind).toBe('failed')
  })
  it('marks VOIDED as cancelled after authorization', () => {
    const { steps, end } = buildTimeline(
      { ...base, state: 'VOIDED', authorizedOn: 'x' },
      { mode: 'MOTO' },
      tr,
    )
    expect(steps.map((s) => s.status)).toEqual(['done', 'done', 'done', 'open', 'open'])
    expect(end?.kind).toBe('cancelled')
  })
})
