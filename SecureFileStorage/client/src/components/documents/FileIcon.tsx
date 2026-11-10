interface FileIconProps {
  contentType?: string
  fileName?: string
  isFolder?: boolean
}

export function FileIcon({ contentType, fileName, isFolder }: FileIconProps) {
  if (isFolder) {
    return (
      <span className="file-tile file-tile-folder" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 7a2 2 0 0 1 2-2h4.2a2 2 0 0 1 1.4.6l1.2 1.2A2 2 0 0 0 13.2 7H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
            fill="currentColor"
            opacity="0.92"
          />
        </svg>
      </span>
    )
  }
  const ct = (contentType || '').toLowerCase()
  const ext = ((fileName || '').split('.').pop() || 'file').toUpperCase().slice(0, 4)
  let type = 'generic'
  if (ct.includes('pdf') || ext === 'PDF') type = 'pdf'
  else if (ct.startsWith('image/')) type = 'image'
  else if (ct.startsWith('video/') || ['MP4', 'WEBM', 'MKV', 'AVI', 'MOV', 'M4V', 'WMV'].includes(ext)) type = 'video'
  else if (ct.startsWith('audio/') || ['MP3', 'WAV', 'OGG', 'FLAC', 'AAC', 'M4A', 'WMA'].includes(ext)) type = 'audio'
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
