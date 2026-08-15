import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const itens = [
  'Idade ≥ 65 anos',
  '3 ou mais fatores de risco para DAC (HAS, DM, dislipidemia, tabagismo, história familiar)',
  'CATE com lesão coronariana ≥ 50%',
  'Uso de AAS nos últimos 7 dias',
  'Infra de ST ≥ 0,5 mm',
  '2 ou mais episódios de angina nas últimas 24 horas',
  'Elevação de marcadores de necrose miocárdica',
]

const riscoPorScore: Record<number, string> = {
  0: '4,7%',
  1: '4,7%',
  2: '8,3%',
  3: '13,2%',
  4: '19,9%',
  5: '26,2%',
  6: '40,9%',
  7: '40,9%',
}

export function Timi() {
  const [marcados, setMarcados] = useState<Set<number>>(new Set())
  const score = marcados.size

  function alternar(i: number) {
    const novo = new Set(marcados)
    if (novo.has(i)) novo.delete(i)
    else novo.add(i)
    setMarcados(novo)
  }

  return (
    <ToolLayout
      title="TIMI — Risco (angina instável / IAM sem supra de ST)"
      description="Estratificação de risco de eventos em 14 dias."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fatores</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {itens.map((item, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
              <input type="checkbox" checked={marcados.has(i)} onChange={() => alternar(i)} className="size-4" />
              <span>{item}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            Escore
            <Badge className="text-lg">{score} / 7</Badge>
          </CardTitle>
          <CardDescription>
            Risco em 14 dias de mortalidade por qualquer causa, IAM novo/recorrente ou isquemia
            recorrente severa exigindo revascularização urgente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant={score >= 5 ? 'destructive' : score >= 3 ? 'warning' : 'success'} className="text-base">
            {score >= 5 ? 'Alto risco' : score >= 3 ? 'Risco intermediário' : 'Baixo risco'} — {riscoPorScore[score] ?? '—'}
          </Badge>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
