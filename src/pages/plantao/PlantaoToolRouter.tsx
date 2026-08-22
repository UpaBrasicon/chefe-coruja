import { Suspense } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { acharSecaoPlantao } from '@/content/plantaoRegistry'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Spinner } from '@/components/ui/spinner'

/**
 * Resolve `/plantao/:secao/:tool` no registry da Central de Plantão e injeta
 * `unidadeId` / `perfilId` — as ferramentas de documento dependem dos dois.
 */
export default function PlantaoToolRouter() {
  const { secao: slugSecao, tool } = useParams()
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()

  const secao = acharSecaoPlantao(slugSecao ?? '')
  const def = secao?.tools.find((t) => t.slug === tool)

  if (!secao || !def) {
    return <p className="text-sm text-destructive">Ferramenta não encontrada.</p>
  }

  const Ferramenta = def.component

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/plantao" className="transition-colors hover:text-foreground">
          Central de Plantão
        </Link>
        <ChevronRight className="size-3.5" />
        <Link to={`/plantao/${secao.slug}`} className="transition-colors hover:text-foreground">
          {secao.label}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{def.label}</span>
      </div>
      <Suspense
        fallback={
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <Ferramenta unidadeId={unidadeAtiva?.unidade_id} perfilId={perfil?.id} />
      </Suspense>
    </div>
  )
}
