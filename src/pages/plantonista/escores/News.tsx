import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function SelectPontos({
  label,
  opcoes,
  valor,
  set,
}: {
  label: string
  opcoes: { rotulo: string; pontos: number }[]
  valor: number
  set: (i: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={String(valor)} onValueChange={(v) => set(Number(v ?? 0))}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o, i) => (
            <SelectItem key={i} value={String(i)}>
              {o.rotulo} {o.pontos !== 0 && <span className="text-muted-foreground">(+{o.pontos})</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function News() {
  const [consciencia, setConsciencia] = useState(0)
  const [emO2, setEmO2] = useState(0)
  const [sao2, setSao2] = useState(3)
  const [fr, setFr] = useState(2)
  const [fc, setFc] = useState(2)
  const [pas, setPas] = useState(3)
  const [temp, setTemp] = useState(2)

  const pontos =
    (consciencia === 0 ? 0 : 3) +
    (emO2 === 1 ? 2 : 0) +
    [3, 2, 1, 0][sao2] +
    [3, 1, 0, 2, 3][fr] +
    [3, 1, 0, 1, 2, 3][fc] +
    [3, 2, 1, 0, 3][pas] +
    [3, 1, 0, 1, 2][temp]

  const picoUnico = Math.max(
    consciencia === 0 ? 0 : 3,
    emO2 === 1 ? 2 : 0,
    [3, 2, 1, 0][sao2],
    [3, 1, 0, 2, 3][fr],
    [3, 1, 0, 1, 2, 3][fc],
    [3, 2, 1, 0, 3][pas],
    [3, 1, 0, 1, 2][temp]
  )

  const altoRisco = pontos >= 7 || picoUnico === 3

  return (
    <ToolLayout
      title="NEWS — National Early Warning Score"
      description="Identificador precoce de deterioração aguda do paciente."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <SelectPontos label="Nível de consciência" valor={consciencia} set={setConsciencia}
            opcoes={[{ rotulo: 'Alerta', pontos: 0 }, { rotulo: 'Responde a estímulo verbal', pontos: 3 }, { rotulo: 'Responde a estímulo doloroso', pontos: 3 }, { rotulo: 'Não responde', pontos: 3 }]} />
          <SelectPontos label="Usando O₂ suplementar" valor={emO2} set={setEmO2}
            opcoes={[{ rotulo: 'Não', pontos: 0 }, { rotulo: 'Sim', pontos: 2 }]} />
          <SelectPontos label="Saturação de O₂ (%)" valor={sao2} set={setSao2}
            opcoes={[{ rotulo: '≤ 91', pontos: 3 }, { rotulo: '92 – 93', pontos: 2 }, { rotulo: '94 – 95', pontos: 1 }, { rotulo: '≥ 96', pontos: 0 }]} />
          <SelectPontos label="Frequência respiratória (irpm)" valor={fr} set={setFr}
            opcoes={[{ rotulo: '≤ 8', pontos: 3 }, { rotulo: '9 – 11', pontos: 1 }, { rotulo: '12 – 20', pontos: 0 }, { rotulo: '21 – 24', pontos: 2 }, { rotulo: '≥ 25', pontos: 3 }]} />
          <SelectPontos label="Frequência cardíaca (bpm)" valor={fc} set={setFc}
            opcoes={[{ rotulo: '≤ 40', pontos: 3 }, { rotulo: '41 – 50', pontos: 1 }, { rotulo: '51 – 90', pontos: 0 }, { rotulo: '91 – 110', pontos: 1 }, { rotulo: '111 – 130', pontos: 2 }, { rotulo: '≥ 131', pontos: 3 }]} />
          <SelectPontos label="Pressão sistólica (mmHg)" valor={pas} set={setPas}
            opcoes={[{ rotulo: '≤ 90', pontos: 3 }, { rotulo: '91 – 100', pontos: 2 }, { rotulo: '101 – 110', pontos: 1 }, { rotulo: '111 – 219', pontos: 0 }, { rotulo: '≥ 220', pontos: 3 }]} />
          <SelectPontos label="Temperatura (°C)" valor={temp} set={setTemp}
            opcoes={[{ rotulo: '≤ 35', pontos: 3 }, { rotulo: '35,1 – 36', pontos: 1 }, { rotulo: '36,1 – 38', pontos: 0 }, { rotulo: '38,1 – 39', pontos: 1 }, { rotulo: '≥ 39,1', pontos: 2 }]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            NEWS =
            <Badge className="text-lg">{pontos}</Badge>
            {altoRisco ? (
              <Badge variant="destructive">Alto risco</Badge>
            ) : pontos >= 5 ? (
              <Badge variant="warning">Risco intermediário</Badge>
            ) : (
              <Badge variant="success">Baixo risco</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            {altoRisco
              ? 'Alta prioridade — resposta clínica imediata.'
              : pontos >= 5
                ? 'Urgência — monitorar de 1/1h e acionar a equipe.'
                : 'Monitorar no mínimo de 6/6 horas.'}
          </p>
          {picoUnico === 3 && (
            <p className="text-amber-700">☞ Alto risco: variação extrema em um único parâmetro (3 pontos).</p>
          )}
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
