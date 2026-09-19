/**
 * Connection status of the wallee client, for the yellow "no connection" bar.
 * The client reports every network/timeout failure and every completed response.
 */
type Listener = () => void

let offline = false
const listeners = new Set<Listener>()

export function isOffline(): boolean {
  return offline
}

export function reportConnection(ok: boolean): void {
  if (offline === !ok) return
  offline = !ok
  listeners.forEach((l) => l())
}

export function subscribeConnection(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
