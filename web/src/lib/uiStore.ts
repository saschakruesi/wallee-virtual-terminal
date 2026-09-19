/**
 * Tiny pub/sub around `wvt.ui` so components (e.g. the navigation counter) re-render
 * when another screen updates a preference. Works with useSyncExternalStore.
 */
import { readUiPrefs, updateUiPrefs } from './storage'
import type { UiPrefs } from './storage'

const listeners = new Set<() => void>()
let snapshot: UiPrefs = readUiPrefs()

export function getUiSnapshot(): UiPrefs {
  return snapshot
}

export function setUiPrefs(patch: Partial<UiPrefs>): void {
  snapshot = updateUiPrefs(patch)
  listeners.forEach((l) => l())
}

export function subscribeUi(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
