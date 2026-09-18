import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { useT } from '@/i18n'
import { Button } from './Button'
import { Icon } from './Icon'

type ModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

/** Native <dialog> for focus trapping, Esc handling and backdrop. */
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const t = useT()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal()
      else el.setAttribute('open', '')
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close()
      else el.removeAttribute('open')
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="modal__header">
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        <button
          type="button"
          className="modal__close"
          onClick={onClose}
          aria-label={t('modal.close')}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="modal__body">{children}</div>
      {footer && <div className="modal__footer">{footer}</div>}
    </dialog>
  )
}

type ConfirmProps = {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  loading,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  const t = useT()
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
            autoFocus
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  )
}
