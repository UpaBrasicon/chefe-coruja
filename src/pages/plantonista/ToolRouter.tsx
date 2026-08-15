import { Link, useParams } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import { Star } from 'lucide-react'

import { acharSecao } from '@/content/registry'
import { registrarRecente, useFavoritos } from '@/lib/useFavoritos'
import { ChevronRight } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'

export function ToolRouter() {
  const { section, tool } = useParams()
  const secao = acharSecao(section ?? '')
  const def = secao?.tools.find((t) => t.slug === tool)
  const { favoritos, alternarFavorito } = useFavoritos()

  useEffect(() => {
    if (tool) registrarRecente(tool)
  }, [tool])

  if (!secao || !def) {
    return <p className="text-sm text-destructive">Ferramenta não encontrada.</p>
  }

  const Component = def.component
  const ehFavorito = favoritos.includes(def.slug)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/plantonista" className="hover:underline">
            Central do Plantonista
          </Link>
          <ChevronRight className="size-3.5" />
          <Link to={`/plantonista/${secao.slug}`} className="hover:underline">
            {secao.label}
          </Link>
          <ChevronRight className="size-3.5" />
          <span>{def.label}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => alternarFavorito(def.slug)}
        >
          <Star className={ehFavorito ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'} />
          {ehFavorito ? 'Favorito' : 'Favoritar'}
        </Button>
      </div>
      <Suspense
        fallback={
          <div className="flex h-40 items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <Component />
      </Suspense>
    </div>
  )
}
