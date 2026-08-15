import { Link, useParams } from 'react-router-dom'

import { acharSecao } from '@/content/registry'
import { ChevronRight } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SectionHome() {
  const { section } = useParams()
  const secao = acharSecao(section ?? '')

  if (!secao) {
    return <p className="text-sm text-destructive">Seção não encontrada.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/plantonista" className="hover:underline">
            Central do Plantonista
          </Link>
          <ChevronRight className="size-3.5" />
          <span>{secao.label}</span>
        </div>
        <h1 className="text-xl font-semibold">{secao.label}</h1>
        <p className="text-sm text-muted-foreground">{secao.description}</p>
      </div>

      {secao.tools.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Esta seção ainda não tem ferramentas. Em breve.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {secao.tools.map((tool) => (
            <Link key={tool.slug} to={`/plantonista/${secao.slug}/${tool.slug}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle className="text-base">{tool.label}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
