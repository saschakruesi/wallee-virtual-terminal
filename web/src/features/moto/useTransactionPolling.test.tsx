import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Transaction } from '@/api/transactions'
import type * as TransactionsModule from '@/api/transactions'

const getTransaction = vi.fn<(...args: unknown[]) => Promise<Transaction>>()
vi.mock('@/api/transactions', async (importOriginal) => {
  const actual = await importOriginal<typeof TransactionsModule>()
  return { ...actual, getTransaction: (...args: unknown[]) => getTransaction(...args) }
})

import { useTransactionPolling } from './useTransactionPolling'

const creds = { userId: '1', authKey: 'a2V5', spaceId: '1' }
const tx = (state: Transaction['state']): Transaction => ({ id: 7, state })

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  getTransaction.mockReset()
})

describe('useTransactionPolling', () => {
  it('polls every 2 s until a terminal state and then stops', async () => {
    getTransaction
      .mockResolvedValueOnce(tx('PENDING'))
      .mockResolvedValueOnce(tx('AUTHORIZED'))
      .mockResolvedValue(tx('FULFILL'))
    const { result } = renderHook(() => useTransactionPolling(creds, '7'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.transaction?.state).toBe('PENDING')
    expect(result.current.polling).toBe(true)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(result.current.transaction?.state).toBe('AUTHORIZED')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000)
    })
    expect(result.current.transaction?.state).toBe('FULFILL')
    expect(result.current.polling).toBe(false)
    const calls = getTransaction.mock.calls.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(getTransaction.mock.calls.length).toBe(calls)
  })

  it('keeps errors without stopping and exposes refresh', async () => {
    getTransaction.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(tx('PENDING'))
    const { result } = renderHook(() => useTransactionPolling(creds, '7'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.loading).toBe(false)
    await act(async () => {
      await result.current.refresh()
    })
    expect(result.current.transaction?.state).toBe('PENDING')
    expect(result.current.error).toBeNull()
  })

  it('does not poll when disabled and aborts on unmount', async () => {
    getTransaction.mockResolvedValue(tx('PENDING'))
    const { result, unmount } = renderHook(() =>
      useTransactionPolling(creds, '7', { enabled: false }),
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(result.current.polling).toBe(false)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(getTransaction).toHaveBeenCalledTimes(1)
    unmount()
  })
})
