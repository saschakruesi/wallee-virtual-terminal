import { useCallback, useSyncExternalStore } from 'react'
import { readCatalog, subscribeCatalog, writeCatalog } from '@/lib/catalog'
import type { Product } from '@/lib/catalog'
import { STORAGE_KEYS } from '@/lib/storage'

let cache: Product[] | null = null
let cacheRaw: string | null | undefined
let cacheVersion = 0

function rawValue(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.products)
  } catch {
    return null
  }
}

/** Re-parses only when the stored string changed, so the snapshot stays referentially stable. */
function getSnapshot(): Product[] {
  const raw = rawValue()
  if (cache === null || raw !== cacheRaw) {
    cacheRaw = raw
    cache = readCatalog()
  }
  return cache
}

function subscribe(listener: () => void): () => void {
  return subscribeCatalog(() => {
    cache = null
    cacheVersion++
    listener()
  })
}

/** Catalogue state shared across screens; writes go to localStorage and notify all subscribers. */
export function useCatalog(): [
  Product[],
  (next: Product[] | ((current: Product[]) => Product[])) => void,
] {
  const products = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const set = useCallback((next: Product[] | ((current: Product[]) => Product[])) => {
    const value = typeof next === 'function' ? next(getSnapshot()) : next
    cache = null
    writeCatalog(value)
  }, [])
  return [products, set]
}

export function catalogCacheVersion(): number {
  return cacheVersion
}
