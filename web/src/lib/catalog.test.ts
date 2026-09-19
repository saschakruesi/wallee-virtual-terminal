import { describe, expect, it } from 'vitest'
import {
  catalogToCsv,
  exportCatalogJson,
  mergeCatalog,
  newProduct,
  normaliseProduct,
  parseCatalogCsv,
  parseCatalogJson,
  readCatalog,
  sampleProducts,
  searchProducts,
  splitCsvLine,
  writeCatalog,
} from './catalog'
import { STORAGE_KEYS } from './storage'

describe('normaliseProduct', () => {
  it('accepts numbers, strings and fills defaults', () => {
    expect(
      normaliseProduct({ name: ' Zimmer ', price: 24000, taxRate: '3,8', type: 'product' }),
    ).toMatchObject({ name: 'Zimmer', price: 24000, taxRate: 3.8, type: 'PRODUCT', active: true })
    expect(normaliseProduct({ name: 'X', price: '12.50', active: 'false' })).toMatchObject({
      price: 1250,
      taxRate: 8.1,
      active: false,
    })
  })
  it('rejects unusable records', () => {
    expect(normaliseProduct(null)).toBeNull()
    expect(normaliseProduct({ name: '', price: 1 })).toBeNull()
    expect(normaliseProduct({ name: 'X', price: -1 })).toBeNull()
    expect(normaliseProduct({ name: 'X', price: 'abc' })).toBeNull()
    expect(normaliseProduct({ name: 'X', price: 1, taxRate: 150 })).toBeNull()
  })
})

describe('storage', () => {
  it('round-trips and migrates a bare array', () => {
    const p = newProduct({ name: 'A', price: 100 })
    writeCatalog([p])
    expect(readCatalog()).toEqual([p])
    window.localStorage.setItem(
      STORAGE_KEYS.products,
      JSON.stringify([{ name: 'Legacy', price: 500 }, { broken: true }]),
    )
    expect(readCatalog()).toMatchObject([{ name: 'Legacy', price: 500 }])
    window.localStorage.setItem(STORAGE_KEYS.products, '{bad')
    expect(readCatalog()).toEqual([])
  })
})

describe('export / import', () => {
  it('JSON export re-imports identically and merges by id', () => {
    const products = sampleProducts()
    const json = exportCatalogJson(products)
    const { products: back, skipped } = parseCatalogJson(json)
    expect(back).toEqual(products)
    expect(skipped).toBe(0)
    const edited = { ...products[0]!, name: 'Changed' }
    const merged = mergeCatalog(products, [edited, newProduct({ name: 'New', price: 1 })])
    expect(merged).toHaveLength(4)
    expect(merged[0]!.name).toBe('Changed')
    expect(parseCatalogJson('[{"name":"A","price":1},{"nope":1}]').skipped).toBe(1)
    expect(() => parseCatalogJson('{"x":1}')).toThrow()
  })

  it('parses CSV with either delimiter, quotes and decimal commas', () => {
    const csv =
      'name;sku;price;taxRate;type\n"Doppelzimmer; Meerblick";DZ;480,00;3.8;PRODUCT\nKurtaxe;;3.50;0;fee\n;X;1;8.1;PRODUCT\n'
    const { products, skipped } = parseCatalogCsv(csv)
    expect(products).toMatchObject([
      { name: 'Doppelzimmer; Meerblick', sku: 'DZ', price: 48000, taxRate: 3.8, type: 'PRODUCT' },
      { name: 'Kurtaxe', price: 350, taxRate: 0, type: 'FEE' },
    ])
    expect(skipped).toBe(1)
    expect(parseCatalogCsv('name,price\nA,"1,234.50"').products[0]!.price).toBe(123450)
    expect(() => parseCatalogCsv('sku,price\nA,1')).toThrow()
    expect(splitCsvLine('a,"b,c",d""e', ',')).toEqual(['a', 'b,c', 'de'])
  })

  it('CSV export round-trips', () => {
    const products = sampleProducts()
    const { products: back } = parseCatalogCsv(catalogToCsv(products))
    expect(back.map((p) => [p.name, p.sku, p.price, p.taxRate, p.type])).toEqual(
      products.map((p) => [p.name, p.sku, p.price, p.taxRate, p.type]),
    )
  })
})

describe('searchProducts', () => {
  it('ranks SKU and prefix matches first and ignores inactive products', () => {
    const list = [
      newProduct({ name: 'Frühstück', sku: 'FR', price: 1 }),
      newProduct({ name: 'Doppelzimmer', sku: 'DZ', price: 1 }),
      newProduct({ name: 'Kaffee, Frühstück', sku: 'KF', price: 1 }),
      newProduct({ name: 'Frei', sku: 'X', price: 1, active: false }),
    ]
    expect(searchProducts(list, 'fr').map((p) => p.sku)).toEqual(['FR', 'KF'])
    expect(searchProducts(list, 'dz').map((p) => p.sku)).toEqual(['DZ'])
    expect(searchProducts(list, '').map((p) => p.sku)).toEqual(['DZ', 'FR', 'KF'])
  })
})
