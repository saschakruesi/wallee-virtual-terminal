import { isWalleeApiError } from '@/api/client'
import type { Translate } from '@/i18n'

/** Turns any error from the wallee client into a sentence the receptionist can act on. */
export function describeApiError(err: unknown, t: Translate, ctx: { spaceId: string }): string {
  if (isWalleeApiError(err)) {
    switch (err.kind) {
      case 'unauthorized':
        return t('setup.error.unauthorized')
      case 'forbidden':
        return t('setup.error.forbidden', { space: ctx.spaceId })
      case 'notFound':
        return t('setup.error.notFound', { space: ctx.spaceId })
      case 'network':
        return t('setup.error.network')
      case 'timeout':
        return t('setup.error.timeout')
      default:
        return t('setup.error.generic', { message: err.message, status: err.status })
    }
  }
  if (err instanceof Error && /base64/i.test(err.message)) return t('setup.error.invalidKey')
  return t('setup.error.generic', {
    message: err instanceof Error ? err.message : String(err),
    status: 0,
  })
}
