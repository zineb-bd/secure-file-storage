interface ModalProps {
  id?: string
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  xl?: boolean
  bare?: boolean
}

export function Modal({ id, title, onClose, children, wide, xl, bare }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        id={id}
        className={`modal${xl ? ' modal-xl' : wide ? ' modal-lg' : ''}${bare ? ' modal-fiche' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {!bare && (
          <div className="modal-header">
            <h3 className="modal-title">{title}</h3>
            <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer">
              &times;
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
