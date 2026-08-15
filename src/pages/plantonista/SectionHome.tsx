import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { acharSecao } from '@/content/registry'
import { useFavoritos } from '@/lib/useFavoritos'
import { ToolCard } from '@/components/plantonista/cards'

export default function SectionHome() {
  const { section } = useParams()
  const secao = acharSecao(section ?? '')
  const { favoritos, alternarFavorito } = useFavoritos()

  if (!secao) {
    return <p className="text-sm text-destructive">Seção não encontrada.</p>
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/plantonista" className="transition-colors hover:text-foreground">
            Central do Plantonista
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">{secao.label}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{secao.label}</h1>
        <p className="text-sm text-muted-foreground">{secao.description}</p>
      </div>

      {secao.tools.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Esta seção ainda não tem ferramentas. Em breve.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {secao.tools.map((tool) => (
            <ToolCard
              key={tool.slug}
              to={`/plantonista/${secao.slug}/${tool.slug}`}
              label={tool.label}
              description={tool.description}
              favorito={favoritos.includes(tool.slug)}
              onFavoritar={() => alternarFavorito(tool.slug)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
