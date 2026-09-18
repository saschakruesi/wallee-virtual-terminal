import { describe, expect, it, vi } from 'vitest'
import { WalleeApiError } from '@/api/client'
import type { ApiCredentials } from '@/api/client'
import { testConnection } from './connectionTest'

const creds: ApiCredentials = { userId: '1', authKey: 'a2V5', spaceId: '9' }
const space = { id: 9, name: 'Test', state: 'ACTIVE' as const }
const err = (status: number) =>
  new WalleeApiError({
    status,
    kind: status === 401 ? 'unauthorized' : 'forbidden',
    message: `HTTP ${status}`,
  })

describe('testConnection', () => {
  it('returns space, seconds unit and active charge flow count', async () => {
    const deps = {
      getSpace: vi.fn(async () => space),
      listChargeFlows: vi.fn(async () => [
        { id: 1, state: 'ACTIVE' as const },
        { id: 2, state: 'INACTIVE' as const },
      ]),
    }
    const result = await testConnection(creds, deps)
    expect(result).toEqual({ space, iatUnit: 'seconds', activeChargeFlows: 1 })
    expect(deps.getSpace).toHaveBeenCalledWith({ ...creds, iatUnit: 'seconds' })
    expect(deps.listChargeFlows).toHaveBeenCalledWith({ ...creds, iatUnit: 'seconds' })
  })

  it('falls back to millisecond iat after a 401', async () => {
    const getSpace = vi.fn(async (c: ApiCredentials) => {
      if (c.iatUnit === 'milliseconds') return space
      throw err(401)
    })
    const result = await testConnection(creds, { getSpace, listChargeFlows: async () => [] })
    expect(result.iatUnit).toBe('milliseconds')
    expect(result.activeChargeFlows).toBe(0)
    expect(getSpace).toHaveBeenCalledTimes(2)
  })

  it('reports the original 401 when both units fail', async () => {
    const getSpace = vi.fn(async () => {
      throw err(401)
    })
    await expect(
      testConnection(creds, { getSpace, listChargeFlows: async () => [] }),
    ).rejects.toMatchObject({ status: 401 })
    expect(getSpace).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 403 or network errors', async () => {
    const getSpace = vi.fn(async () => {
      throw err(403)
    })
    await expect(
      testConnection(creds, { getSpace, listChargeFlows: async () => [] }),
    ).rejects.toMatchObject({ status: 403 })
    expect(getSpace).toHaveBeenCalledTimes(1)
  })

  it('keeps the space result when charge flows cannot be read', async () => {
    const result = await testConnection(creds, {
      getSpace: async () => space,
      listChargeFlows: async () => {
        throw err(403)
      },
    })
    expect(result.activeChargeFlows).toBeNull()
    expect(result.chargeFlowError?.status).toBe(403)
  })
})
