import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnnuaireDirectory } from '@/components/annuaire/AnnuaireDirectory'

type DirectoryFilter = 'me' | 'people' | 'groups'

function parseFilter(raw: string | null): DirectoryFilter {
  if (raw === 'groups') return 'groups'
  if (raw === 'users' || raw === 'people') return 'people'
  return 'me'
}

export function AnnuairePage() {
  const [searchParams] = useSearchParams()
  const filter = useMemo(() => parseFilter(searchParams.get('tab')), [searchParams])

  return (
    <section className="page files-like-page annuaire-page" id="page-annuaire">
      <AnnuaireDirectory initialFilter={filter} />
    </section>
  )
}
