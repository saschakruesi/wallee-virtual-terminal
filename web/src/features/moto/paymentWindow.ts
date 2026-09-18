/**
 * The MOTO payment page opens as a popup on app-wallee.com. Popup blockers only allow
 * `window.open` inside a user gesture, so the wizard opens a blank named window
 * synchronously in the click handler and the MOTO screen navigates it once the URL is known.
 */
const WINDOW_NAME = 'wallee-payment'
const FEATURES = 'width=520,height=760,resizable=yes,scrollbars=yes'

let current: Window | null = null

/** Opens (or focuses) the payment window. Returns null when blocked. */
export function openPaymentWindow(url?: string): Window | null {
  try {
    const w = window.open(url ?? '', WINDOW_NAME, FEATURES)
    if (w) {
      current = w
      try {
        w.focus()
      } catch {
        /* ignore */
      }
    }
    return w
  } catch {
    return null
  }
}

/** Points the already opened window to the payment page, or opens a new one. */
export function navigatePaymentWindow(url: string): Window | null {
  if (current && !current.closed) {
    try {
      current.location.href = url
      current.focus()
      return current
    } catch {
      /* cross-origin after navigation: fall through and reopen by name */
    }
  }
  return openPaymentWindow(url)
}

export function closePaymentWindow(): void {
  if (current && !current.closed) {
    try {
      current.close()
    } catch {
      /* ignore */
    }
  }
  current = null
}

export function isPaymentWindowOpen(): boolean {
  return Boolean(current && !current.closed)
}
