import { isWalleeApiError } from '@/api/client'
import type { ApiCredentials, WalleeApiError } from '@/api/client'
import { countActiveChargeFlows, listChargeFlows } from '@/api/chargeFlows'
import { getSpace } from '@/api/spaces'
import type { IatUnit } from '@/api/jwt'
import type { ChargeFlow, Space } from '@/api/types'

export type ConnectionResult = {
  space: Space
  /** The iat unit wallee accepted for this key (docs/02-wallee-api.md §1). */
  iatUnit: IatUnit
  /** Number of ACTIVE charge flows, or null when they could not be read. */
  activeChargeFlows: number | null
  /** Set when the charge-flow lookup failed although the space could be read. */
  chargeFlowError?: WalleeApiError
}

export type ConnectionDeps = {
  getSpace: (creds: ApiCredentials) => Promise<Space>
  listChargeFlows: (creds: ApiCredentials) => Promise<ChargeFlow[]>
}

const defaultDeps: ConnectionDeps = { getSpace, listChargeFlows }

/**
 * Connection test = read the space, then count active charge flows.
 * A 401 with second-based `iat` is retried once with milliseconds; whichever unit works
 * is returned so it can be stored in the configuration.
 */
export async function testConnection(
  creds: ApiCredentials,
  deps: ConnectionDeps = defaultDeps,
): Promise<ConnectionResult> {
  const firstUnit: IatUnit = creds.iatUnit ?? 'seconds'
  const secondUnit: IatUnit = firstUnit === 'seconds' ? 'milliseconds' : 'seconds'

  let iatUnit = firstUnit
  let space: Space
  try {
    space = await deps.getSpace({ ...creds, iatUnit: firstUnit })
  } catch (err) {
    if (!isWalleeApiError(err) || err.status !== 401) throw err
    try {
      space = await deps.getSpace({ ...creds, iatUnit: secondUnit })
      iatUnit = secondUnit
    } catch (retryErr) {
      // Report the original failure unless the retry failed for a different reason.
      if (isWalleeApiError(retryErr) && retryErr.status === 401) throw err
      throw retryErr
    }
  }

  const spaceCreds = { ...creds, iatUnit }
  try {
    const flows = await deps.listChargeFlows(spaceCreds)
    return { space, iatUnit, activeChargeFlows: countActiveChargeFlows(flows) }
  } catch (err) {
    if (isWalleeApiError(err))
      return { space, iatUnit, activeChargeFlows: null, chargeFlowError: err }
    throw err
  }
}
