interface ModalProps {
  id?: string
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}

export function Modal({ id, title, onClose, children, wide }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        id={id}
        className={`modal${wide ? ' modal-lg' : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
            &times;
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
