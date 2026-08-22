import { Suspense } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { acharSecaoPlantao, ehSecaoDireta } from '@/content/plantaoRegistry'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { ToolCard } from '@/components/plantonista/cards'
import { Spinner } from '@/components/ui/spinner'

/**
 * Página de uma seção da Central de Plantão.
 *
 * Seção com várias ferramentas → grid de cards (igual ao `SectionHome` da Central
 * do Plantonista). Seção com uma só → renderiza a ferramenta aqui mesmo, sem
 * obrigar um clique numa lista de um item.
 */
export default function PlantaoSectionHome() {
  const { secao: slugSecao } = useParams()
  const [searchParams] = useSearchParams()
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const secao = acharSecaoPlantao(slugSecao ?? '')

  if (!secao) {
    return <p className="text-sm text-destructive">Seção não encontrada.</p>
  }

  // Link antigo `/plantao/internacao?paciente=X` apontava para o formulário —
  // hoje esta URL é a seção, então encaminha para a ferramenta certa.
  if (secao.slug === 'internacao' && searchParams.get('paciente')) {
    return <Navigate to={`/plantao/internacao/formulario?${searchParams.toString()}`} replace />
  }

  if (ehSecaoDireta(secao)) {
    const Ferramenta = secao.tools[0].component
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/plantao" className="transition-colors hover:text-foreground">
            Central de Plantão
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">{secao.label}</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{secao.label}</h1>
          <p className="text-sm text-muted-foreground">{secao.description}</p>
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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/plantao" className="transition-colors hover:text-foreground">
            Central de Plantão
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">{secao.label}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{secao.label}</h1>
        <p className="text-sm text-muted-foreground">{secao.description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {secao.tools.map((tool) => (
          <ToolCard
            key={tool.slug}
            to={`/plantao/${secao.slug}/${tool.slug}`}
            label={tool.label}
            description={tool.description}
          />
        ))}
      </div>
    </div>
  )
}
