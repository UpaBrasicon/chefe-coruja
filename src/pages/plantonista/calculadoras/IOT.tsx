import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { NumberField } from '@/components/plantonista/NumberField'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CopyResult } from '@/components/plantonista/CopyResult'

type Dose = {
  nome: string
  doseMg: string
  volume: string
  observacao?: string
}

function calcular(pesoKg: number): { pre: Dose[]; inducao: Dose[]; bloqueio: Dose[] } {
  const ml = (doseMg: number, conc: number) => (doseMg / conc).toFixed(1)

  const pre: Dose[] = [
    { nome: 'Lidocaína 2% (20 mg/mL)', doseMg: (pesoKg * 1.5).toFixed(1), volume: `${ml(pesoKg * 1.5, 20)} mL`, observacao: 'Reduz incidência de laringoespasmo' },
    { nome: 'Fentanil (50 mcg/mL)', doseMg: `${(pesoKg * 2).toFixed(0)} mcg`, volume: `${((pesoKg * 2) / 50).toFixed(1)} mL` },
  ]

  const inducao: Dose[] = [
    { nome: 'Cetamina (50 mg/mL)', doseMg: (pesoKg * 2).toFixed(1), volume: `${ml(pesoKg * 2, 50)} mL` },
    { nome: 'Etomidato (2 mg/mL)', doseMg: (pesoKg * 0.3).toFixed(1), volume: `${ml(pesoKg * 0.3, 2)} mL` },
    { nome: 'Midazolam (5 mg/mL)', doseMg: (pesoKg * 0.15).toFixed(2), volume: `${ml(pesoKg * 0.15, 5)} mL` },
    { nome: 'Propofol 1% (10 mg/mL)', doseMg: (pesoKg * 1.5).toFixed(1), volume: `${ml(pesoKg * 1.5, 10)} mL` },
    { nome: 'Propofol 2% (20 mg/mL)', doseMg: (pesoKg * 1.5).toFixed(1), volume: `${ml(pesoKg * 1.5, 20)} mL` },
  ]

  const bloqueio: Dose[] = [
    { nome: 'Succinilcolina (FR 100 mg)', doseMg: (pesoKg * 1).toFixed(1), volume: `${ml(pesoKg * 1, 10)} mL`, observacao: '1 FR + 10 mL AD → 1 mL = 10 mg' },
    { nome: 'Atracúrio (10 mg/mL)', doseMg: (pesoKg * 0.5).toFixed(1), volume: `${ml(pesoKg * 0.5, 5)} mL`, observacao: '5 mL + 5 mL AD → 1 mL = 5 mg' },
    { nome: 'Rocurônio (10 mg/mL)', doseMg: (pesoKg * 1.2).toFixed(1), volume: `${ml(pesoKg * 1.2, 10)} mL` },
    { nome: 'Cisatracúrio (2 mg/mL)', doseMg: (pesoKg * 0.2).toFixed(1), volume: `${ml(pesoKg * 0.2, 2)} mL` },
    { nome: 'Pancurônio (2 mg/mL)', doseMg: (pesoKg * 0.08).toFixed(2), volume: `${ml(pesoKg * 0.08, 2)} mL` },
  ]

  return { pre, inducao, bloqueio }
}

function DoseGroup({ titulo, doses }: { titulo: string; doses: Dose[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {doses.map((d) => (
          <div
            key={d.nome}
            className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{d.nome}</div>
              {d.observacao && (
                <div className="text-xs text-muted-foreground">{d.observacao}</div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary">{d.doseMg}</Badge>
              <Badge variant="outline">{d.volume}</Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function IOT() {
  const [peso, setPeso] = useState(70)
  const { pre, inducao, bloqueio } = calcular(peso)

  const linhas = (doses: Dose[]) =>
    doses
      .map((d) => `- ${d.nome}: ${d.doseMg} (${d.volume})${d.observacao ? ` — ${d.observacao}` : ''}`)
      .join('\n')
  const textoPronto = [
    `IOT sequência rápida — peso ${peso} kg:`,
    `PRÉ-MEDICAÇÃO\n${linhas(pre)}`,
    `INDUÇÃO\n${linhas(inducao)}`,
    `BLOQUEIO\n${linhas(bloqueio)}`,
  ].join('\n\n')

  return (
    <ToolLayout
      title="Intubação Orotraqueal — Sequência Rápida"
      description="Doses calculadas pelo peso (mg/kg). Bloqueadores neuromusculares em ordem de preferência."
      referencia="Doses de sequência rápida — referências padrão de emergência/intensivismo."
      revisadoEm="Revisado em 08/2026"
    >
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="max-w-xs">
            <NumberField
              id="iot-peso"
              label="Peso"
              unit="kg"
              value={peso}
              onChange={setPeso}
              min={1}
            />
          </div>
          {peso > 0 && <CopyResult texto={textoPronto} rotulo="Copiar doses" />}
        </CardContent>
      </Card>

      {peso > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <DoseGroup titulo="1. Pré-medicação" doses={pre} />
          <DoseGroup titulo="2. Indução / Sedação" doses={inducao} />
          <DoseGroup titulo="3. Bloqueio neuromuscular" doses={bloqueio} />
        </div>
      )}
    </ToolLayout>
  )
}
