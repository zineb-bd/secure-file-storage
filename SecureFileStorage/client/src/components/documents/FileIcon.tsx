interface FileIconProps {
  contentType?: string
  fileName?: string
}

export function FileIcon({ contentType, fileName }: FileIconProps) {
  const ct = (contentType || '').toLowerCase()
  const ext = ((fileName || '').split('.').pop() || 'file').toUpperCase().slice(0, 4)
  let type = 'generic'
  if (ct.includes('pdf') || ext === 'PDF') type = 'pdf'
  else if (ct.startsWith('image/')) type = 'image'
  else if (ct.includes('word') || ['DOC', 'DOCX'].includes(ext)) type = 'doc'
  else if (ct.includes('sheet') || ct.includes('excel') || ['XLS', 'XLSX', 'CSV'].includes(ext)) type = 'sheet'
  else if (ct.includes('presentation') || ['PPT', 'PPTX'].includes(ext)) type = 'slide'
  else if (ct.includes('zip') || ['ZIP', 'RAR', '7Z'].includes(ext)) type = 'archive'

  return (
    <span className={`file-tile file-tile-${type}`}>
      <span className="file-tile-label">{ext}</span>
    </span>
  )
}
