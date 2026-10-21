/**
 * Modal dialog.
 *
 * Bootstrap's JavaScript is not loaded in this app, so the dialog is opened
 * with the classes Bootstrap's own markup uses: `.modal.show.d-block` plus a
 * `.modal-backdrop.show` sibling. Everything else is plain Bootstrap CSS.
 */
import { useEffect } from 'react'
import { useEscape } from '../hooks/useAsync.js'

export default function Modal({ open, title, onClose, children, footer, size }) {
  useEscape(onClose, open)

  // Stop the page behind the dialog from scrolling while it is open.
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="modal-backdrop show" onClick={onClose} aria-hidden="true" />
      <div
        className="modal show d-block"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={onClose}
      >
        <div
          className={`modal-dialog${size ? ` modal-${size}` : ''}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title}</h5>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            <div className="modal-body">{children}</div>
            {footer ? <div className="modal-footer">{footer}</div> : null}
          </div>
        </div>
      </div>
    </>
  )
}
