import { Link } from 'react-router-dom'

import { SECOES } from '@/content/registry'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PlantonistaHome() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Central do Plantonista</h1>
        <p className="text-sm text-muted-foreground">
          Ferramentas de apoio à decisão clínica durante o plantão.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECOES.map((secao) => (
          <Link key={secao.slug} to={`/plantonista/${secao.slug}`}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <secao.icon className="size-4 text-muted-foreground" />
                  {secao.label}
                </CardTitle>
                <CardDescription>{secao.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {secao.tools.length > 0 ? `${secao.tools.length} ferramenta(s)` : 'Em breve'}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
