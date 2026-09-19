/**
 * Local product catalogue (`wvt.products`), see docs/03-ui-flows.md «Produkte».
 * Stored as `{ version, products }`; a bare array from earlier builds is migrated.
 */
import { STORAGE_KEYS, readJson, writeJson } from './storage'
import { fromMajor, parseAmount, toMajor } from './money'

export type ProductType = 'PRODUCT' | 'FEE' | 'SHIPPING'

export type Product = {
  id: string
  name: string
  sku?: string
  /** Minor units (Rappen/cents), incl. tax. */
  price: number
  /** Percent, e.g. 8.1. */
  taxRate: number
  taxTitle?: string
  type: ProductType
  active: boolean
  updatedAt: string
}

export const CATALOG_VERSION = 1

export type CatalogFile = { version: number; exportedAt?: string; products: Product[] }

const TYPES: ProductType[] = ['PRODUCT', 'FEE', 'SHIPPING']

export function newProductId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function newProduct(partial: Partial<Product> = {}): Product {
  return {
    id: newProductId(),
    name: '',
    price: 0,
    taxRate: 8.1,
    type: 'PRODUCT',
    active: true,
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

/** Validates and normalises one product record from storage or import. Returns null when unusable. */
export function normaliseProduct(
  raw: unknown,
  options: { allowEmptyName?: boolean } = {},
): Product | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const name = typeof r.name === 'string' ? (options.allowEmptyName ? r.name : r.name.trim()) : ''
  if (!name && !options.allowEmptyName) return null
  let price: number | null = null
  if (typeof r.price === 'number' && Number.isFinite(r.price)) price = Math.round(r.price)
  else if (typeof r.price === 'string') price = parseAmount(r.price)
  if (price === null || price < 0) return null
  const taxRate =
    typeof r.taxRate === 'number'
      ? r.taxRate
      : typeof r.taxRate === 'string'
        ? Number(r.taxRate.replace(',', '.').replace('%', ''))
        : 8.1
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) return null
  const type =
    typeof r.type === 'string' && TYPES.includes(r.type.toUpperCase() as ProductType)
      ? (r.type.toUpperCase() as ProductType)
      : 'PRODUCT'
  return {
    id: typeof r.id === 'string' && r.id ? r.id : newProductId(),
    name,
    sku: typeof r.sku === 'string' && r.sku.trim() ? r.sku.trim() : undefined,
    price,
    taxRate,
    taxTitle: typeof r.taxTitle === 'string' && r.taxTitle.trim() ? r.taxTitle.trim() : undefined,
    type,
    active:
      typeof r.active === 'boolean'
        ? r.active
        : r.active === 'false' || r.active === 0 || r.active === '0'
          ? false
          : true,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : new Date().toISOString(),
  }
}

export function readCatalog(): Product[] {
  const raw = readJson<unknown>(STORAGE_KEYS.products, null)
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as CatalogFile).products)
      ? (raw as CatalogFile).products
      : []
  // Rows being edited may have an empty name; they stay in the catalogue but are never searchable.
  return list
    .map((p) => normaliseProduct(p, { allowEmptyName: true }))
    .filter((p): p is Product => p !== null)
}

export function writeCatalog(products: Product[]): void {
  writeJson(STORAGE_KEYS.products, { version: CATALOG_VERSION, products } satisfies CatalogFile)
  notifyCatalog()
}

/* ---------- Change notification (same tab) ---------- */
const listeners = new Set<() => void>()
export function subscribeCatalog(listener: () => void): () => void {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEYS.products) listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}
function notifyCatalog(): void {
  listeners.forEach((l) => l())
}

/* ---------- Export / import ---------- */

export function exportCatalogJson(products: Product[]): string {
  return JSON.stringify(
    {
      version: CATALOG_VERSION,
      exportedAt: new Date().toISOString(),
      products,
    } satisfies CatalogFile,
    null,
    2,
  )
}

export type ImportResult = { products: Product[]; skipped: number }

/** Accepts a CatalogFile or a bare array. Invalid rows are skipped and counted. */
export function parseCatalogJson(text: string): ImportResult {
  const parsed = JSON.parse(text) as unknown
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as CatalogFile).products)
      ? (parsed as CatalogFile).products
      : null
  if (!list) throw new Error('not a catalogue file')
  const products = list.map((p) => normaliseProduct(p)).filter((p): p is Product => p !== null)
  return { products, skipped: list.length - products.length }
}

/** Merges imported products into the catalogue by id (imported wins); new ids are appended. */
export function mergeCatalog(current: Product[], imported: Product[]): Product[] {
  const byId = new Map(current.map((p) => [p.id, p]))
  for (const p of imported) byId.set(p.id, p)
  return [...byId.values()]
}

/**
 * CSV with header `name,sku,price,taxRate,type` (order free, `;` or `,` delimiter,
 * quoted fields allowed). Price in major units (`480.00` or `480,00`).
 */
export function parseCatalogCsv(text: string): ImportResult {
  const lines = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
  if (lines.length === 0) return { products: [], skipped: 0 }
  const delimiter =
    (lines[0]!.match(/;/g)?.length ?? 0) > (lines[0]!.match(/,/g)?.length ?? 0) ? ';' : ','
  const header = splitCsvLine(lines[0]!, delimiter).map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name)
  if (idx('name') === -1 || idx('price') === -1) throw new Error('missing name/price column')
  const products: Product[] = []
  let skipped = 0
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line, delimiter)
    const get = (name: string) => (idx(name) >= 0 ? (cols[idx(name)] ?? '').trim() : '')
    const price = parseAmount(get('price'))
    const p = normaliseProduct({
      name: get('name'),
      sku: get('sku') || undefined,
      price: price === null ? undefined : price,
      taxRate: get('taxrate') || get('tax') || '8.1',
      type: get('type') || 'PRODUCT',
      active: get('active') === '' ? true : get('active') !== 'false' && get('active') !== '0',
    })
    if (p) products.push(p)
    else skipped++
  }
  return { products, skipped }
}

export function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') quoted = false
      else cur += ch
    } else if (ch === '"') quoted = true
    else if (ch === delimiter) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out
}

export function catalogToCsv(products: Product[]): string {
  const esc = (s: string) => (/[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const rows = products.map((p) =>
    [
      esc(p.name),
      esc(p.sku ?? ''),
      toMajor(p.price).toFixed(2),
      String(p.taxRate),
      p.type,
      String(p.active),
    ].join(','),
  )
  return ['name,sku,price,taxRate,type,active', ...rows].join('\n')
}

/* ---------- Samples & search ---------- */

export function sampleProducts(): Product[] {
  const now = new Date().toISOString()
  return [
    {
      id: newProductId(),
      name: 'Doppelzimmer 1 Nacht',
      sku: 'DZ',
      price: fromMajor(240),
      taxRate: 3.8,
      type: 'PRODUCT',
      active: true,
      updatedAt: now,
    },
    {
      id: newProductId(),
      name: 'Kurtaxe pro Person',
      sku: 'KT',
      price: fromMajor(3.5),
      taxRate: 0,
      type: 'FEE',
      active: true,
      updatedAt: now,
    },
    {
      id: newProductId(),
      name: 'Frühstück',
      sku: 'FR',
      price: fromMajor(24),
      taxRate: 8.1,
      type: 'PRODUCT',
      active: true,
      updatedAt: now,
    },
  ]
}

/**
 * Active products whose name or SKU contains the text; prefix matches rank first.
 * An empty text lists the active products alphabetically (used when the field gets focus).
 */
export function searchProducts(products: Product[], text: string, limit = 8): Product[] {
  const q = text.trim().toLowerCase()
  if (!q) {
    return products
      .filter((p) => p.active && p.name.trim())
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
  }
  const scored = products
    .filter((p) => p.active && p.name.trim())
    .map((p) => {
      const name = p.name.toLowerCase()
      const sku = (p.sku ?? '').toLowerCase()
      const score =
        sku === q
          ? 0
          : name.startsWith(q)
            ? 1
            : sku.startsWith(q)
              ? 2
              : name.includes(q)
                ? 3
                : sku.includes(q)
                  ? 4
                  : -1
      return { p, score }
    })
    .filter((s) => s.score >= 0)
    .sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name))
  return scored.slice(0, limit).map((s) => s.p)
}
