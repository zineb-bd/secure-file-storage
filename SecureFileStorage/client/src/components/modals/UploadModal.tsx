import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface UploadModalProps {
  onClose: () => void
  onUploaded?: () => void
}

/** @deprecated Utiliser la route /documents/upload */
export function UploadModal({ onClose }: UploadModalProps) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate('/documents/upload')
    onClose()
  }, [navigate, onClose])
  return null
}
