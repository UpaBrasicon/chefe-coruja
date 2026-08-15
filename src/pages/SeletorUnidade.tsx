import { useNavigate } from 'react-router-dom'

import { useUnidade, type VinculoComUnidade } from '@/contexts/UnidadeContext'
import { PAPEL_LABEL } from '@/lib/constants'
import type { Papel } from '@/types/database'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const ROTA_POR_PAPEL: Record<Papel, string> = {
  admin: '/painel',
  gestor: '/setores',
  plantonista: '/plantonista',
}

export function SeletorUnidade() {
  const { unidades, setUnidadeAtivaId } = useUnidade()
  const navigate = useNavigate()

  function escolher(unidade: VinculoComUnidade) {
    setUnidadeAtivaId(unidade.unidade_id)
    navigate(ROTA_POR_PAPEL[unidade.papel], { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Escolha a unidade</CardTitle>
            <CardDescription>Selecione a unidade em que deseja trabalhar agora.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {unidades.map((u) => (
              <Button
                key={u.unidade_id}
                variant="outline"
                className="h-auto flex-col items-start gap-1 p-4"
                onClick={() => escolher(u)}
              >
                <span className="text-sm font-medium">{u.unidade.nome}</span>
                <Badge variant="secondary">{PAPEL_LABEL[u.papel]}</Badge>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
