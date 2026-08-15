import { Link, useParams } from 'react-router-dom'

import { acharSecao } from '@/content/registry'
import { ChevronRight } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Suspense } from 'react'

export function ToolRouter() {
  const { section, tool } = useParams()
  const secao = acharSecao(section ?? '')
  const def = secao?.tools.find((t) => t.slug === tool)

  if (!secao || !def) {
    return <p className="text-sm text-destructive">Ferramenta não encontrada.</p>
  }

  const Component = def.component

  return (
    <div className="flex flex-col gap-4">
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
