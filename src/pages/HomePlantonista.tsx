import { Stethoscope } from 'lucide-react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function HomePlantonista() {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">
          Olá, {perfil?.nome_completo?.split(' ')[0] ?? 'colega'} 👋
        </h1>
        <p className="text-sm text-muted-foreground">Seu plantão começa por aqui.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="size-4 text-muted-foreground" />
            Unidade ativa
          </CardTitle>
          <CardDescription>
            {unidadeAtiva?.unidade.nome ?? 'Nenhuma unidade'}
            {unidadeAtiva && (
              <span className="ml-2">
                <Badge variant="secondary">{unidadeAtiva.unidade.tipo}</Badge>
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Os módulos de prontuário, prescrição e gestão de plantão serão liberados nas próximas
            fases. Você está com acesso de <strong>plantonista</strong>, limitado aos pacientes sob
            seu cuidado na unidade ativa.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
