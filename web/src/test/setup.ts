import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  // Some suites run in the node environment (WebCrypto), where there is no window.
  if (typeof window === 'undefined') return
  cleanup()
  window.localStorage.clear()
  window.sessionStorage.clear()
})
