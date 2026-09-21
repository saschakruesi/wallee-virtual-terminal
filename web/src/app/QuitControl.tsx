import { useState } from 'react'
import { useT } from '@/i18n'
import { ConfirmDialog, Icon, useToast } from '@/components'
import { quitHelper } from '@/api/update'

/**
 * Header action «Beenden». The helper runs without a window (macOS app bundle, Windows GUI
 * build), so this is how the user stops it: confirm → POST /quit → end screen.
 */
export function QuitControl({ onQuit }: { onQuit: () => void }) {
  const t = useT()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const confirm = async () => {
    setBusy(true)
    try {
      await quitHelper()
      setOpen(false)
      onQuit()
    } catch {
      toast.error(t('quit.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label={t('header.quit')}
        title={t('header.quit')}
        onClick={() => setOpen(true)}
      >
        <Icon name="power" />
      </button>
      <ConfirmDialog
        open={open}
        title={t('quit.confirmTitle')}
        message={t('quit.confirmMessage')}
        confirmLabel={t('header.quit')}
        loading={busy}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  )
}
