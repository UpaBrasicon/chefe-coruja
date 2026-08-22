import { Building2, BedDouble, Bed, Lock, SprayCan } from 'lucide-react'

import { useCenso } from '@/hooks/useDadosUnidade'
import { TIPO_UNIDADE_LABEL } from '@/lib/constants'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

function CardCenso({ label, valor, icon: Icon }: { label: string; valor: number | null; icon: typeof Bed }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="text-2xl font-semibold">{valor ?? '—'}</div>
    </div>
  )
}

export function PainelAdmin({ embutido = false }: { embutido?: boolean } = {}) {
  const { data: censo, isLoading, error } = useCenso()

  if (error) {
    return <p className="text-sm text-destructive">Falha ao carregar o censo: {error.message}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      {!embutido && (
        <div>
          <h1 className="text-xl font-semibold">Painel da organização</h1>
          <p className="text-sm text-muted-foreground">
            Censo agregado por unidade — sem dados identificáveis de paciente.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(censo ?? []).map((unidade) => (
          <Card key={unidade.unidade_id}>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{unidade.unidade_nome}</CardTitle>
              </div>
              <Badge variant="secondary">
                {TIPO_UNIDADE_LABEL[unidade.unidade_tipo as keyof typeof TIPO_UNIDADE_LABEL]}
              </Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <CardCenso label="Setores" valor={unidade.total_setores} icon={BedDouble} />
              <CardCenso label="Leitos" valor={unidade.total_leitos} icon={Bed} />
              <CardCenso label="Livres" valor={unidade.leitos_livres} icon={Bed} />
              <CardCenso label="Ocupados" valor={unidade.leitos_ocupados} icon={Bed} />
              <CardCenso label="Bloqueados" valor={unidade.leitos_bloqueados} icon={Lock} />
              <CardCenso label="Higienização" valor={unidade.leitos_higienizacao} icon={SprayCan} />
            </CardContent>
            {(unidade.total_leitos ?? 0) > 0 && unidade.total_leitos === null && (
              <p className="px-6 pb-2 text-xs text-muted-foreground">
                Contagens pequenas foram suprimidas para proteger a privacidade (LGPD).
              </p>
            )}
          </Card>
        ))}
      </div>

      {!isLoading && (censo ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma unidade visível. Fale com um administrador da plataforma.
        </p>
      )}
    </div>
  )
}
