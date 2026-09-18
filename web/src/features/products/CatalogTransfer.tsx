import { useRef } from 'react'
import { useT } from '@/i18n'
import { Button, Icon, useToast } from '@/components'
import {
  catalogToCsv,
  exportCatalogJson,
  mergeCatalog,
  parseCatalogCsv,
  parseCatalogJson,
} from '@/lib/catalog'
import { downloadBase64 } from '@/lib/download'
import { useCatalog } from './useCatalog'

function downloadText(text: string, mime: string, filename: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  downloadBase64(btoa(binary), mime, filename)
}

/** Export / import buttons for the local catalogue (products screen and setup). */
export function CatalogTransfer({ compact }: { compact?: boolean }) {
  const t = useT()
  const toast = useToast()
  const [products, setProducts] = useCatalog()
  const jsonInput = useRef<HTMLInputElement>(null)
  const csvInput = useRef<HTMLInputElement>(null)
  const stamp = new Date().toISOString().slice(0, 10)

  const importFile = async (file: File | undefined, kind: 'json' | 'csv') => {
    if (!file) return
    try {
      const text = await file.text()
      const { products: imported, skipped } =
        kind === 'json' ? parseCatalogJson(text) : parseCatalogCsv(text)
      setProducts((current) => mergeCatalog(current, imported))
      toast.success(
        t('products.imported', {
          count: imported.length,
          skipped: skipped ? t('products.importedSkipped', { skipped }) : '',
        }),
      )
    } catch (err) {
      toast.error(
        t('products.importError', { message: err instanceof Error ? err.message : String(err) }),
      )
    }
  }

  return (
    <div className="row" style={{ gap: compact ? 'var(--s-1)' : 'var(--s-2)' }}>
      <Button
        variant={compact ? 'text' : 'secondary'}
        icon={<Icon name="download" size="sm" />}
        onClick={() =>
          downloadText(
            exportCatalogJson(products),
            'application/json',
            `wallee-produkte-${stamp}.json`,
          )
        }
        disabled={products.length === 0}
      >
        {t('products.export')}
      </Button>
      {!compact && (
        <Button
          variant="secondary"
          icon={<Icon name="download" size="sm" />}
          onClick={() =>
            downloadText(catalogToCsv(products), 'text/csv', `wallee-produkte-${stamp}.csv`)
          }
          disabled={products.length === 0}
        >
          {t('products.exportCsv')}
        </Button>
      )}
      <Button variant={compact ? 'text' : 'secondary'} onClick={() => jsonInput.current?.click()}>
        {t('products.import')}
      </Button>
      <Button variant={compact ? 'text' : 'secondary'} onClick={() => csvInput.current?.click()}>
        {t('products.importCsv')}
      </Button>
      <input
        ref={jsonInput}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label={t('products.import')}
        onChange={(e) => {
          void importFile(e.target.files?.[0], 'json')
          e.target.value = ''
        }}
      />
      <input
        ref={csvInput}
        type="file"
        accept="text/csv,.csv,text/plain"
        hidden
        aria-label={t('products.importCsv')}
        onChange={(e) => {
          void importFile(e.target.files?.[0], 'csv')
          e.target.value = ''
        }}
      />
    </div>
  )
}
