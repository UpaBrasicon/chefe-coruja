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

function ItemSelect({ label, opcoes, valor, set }: { label: string; opcoes: { rotulo: string; pontos: number }[]; valor: number; set: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm">{label}</Label>
      <Select value={String(valor)} onValueChange={(v) => set(Number(v ?? 0))}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opcoes.map((o, i) => (
            <SelectItem key={i} value={String(i)}>{o.rotulo} ({o.pontos})</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function PredicaoFalenciaVni() {
  const [fc, setFc] = useState(0)
  const [ph, setPh] = useState(0)
  const [glasgow, setGlasgow] = useState(0)
  const [pf, setPf] = useState(0)
  const [fr, setFr] = useState(0)

  const pontos =
    [0, 1][fc] +
    [0, 1, 2, 3][ph] +
    [0, 1, 2, 3][glasgow] +
    [0, 2, 3, 4, 5, 6][pf] +
    [0, 1, 2, 3, 4][fr]

  return (
    <ToolLayout
      title="Predição de Falência da VNI — HACOR"
      description="Avaliar após 1 hora de VNI. Pontuação &gt; 5 sugere falência, favorecendo intubação."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <ItemSelect label="Frequência cardíaca (bpm)" valor={fc} set={setFc}
            opcoes={[{ rotulo: '≤ 120', pontos: 0 }, { rotulo: '≥ 121', pontos: 1 }]} />
          <ItemSelect label="pH" valor={ph} set={setPh}
            opcoes={[{ rotulo: '≥ 7,35', pontos: 0 }, { rotulo: '7,30 – 7,34', pontos: 1 }, { rotulo: '7,25 – 7,29', pontos: 2 }, { rotulo: '< 7,25', pontos: 3 }]} />
          <ItemSelect label="Glasgow" valor={glasgow} set={setGlasgow}
            opcoes={[{ rotulo: '15', pontos: 0 }, { rotulo: '13 – 14', pontos: 1 }, { rotulo: '11 – 12', pontos: 2 }, { rotulo: '≤ 10', pontos: 3 }]} />
          <ItemSelect label="PaO₂/FiO₂" valor={pf} set={setPf}
            opcoes={[{ rotulo: '≥ 201', pontos: 0 }, { rotulo: '176 – 200', pontos: 2 }, { rotulo: '151 – 175', pontos: 3 }, { rotulo: '126 – 150', pontos: 4 }, { rotulo: '101 – 125', pontos: 5 }, { rotulo: '≤ 100', pontos: 6 }]} />
          <ItemSelect label="Frequência respiratória (irpm)" valor={fr} set={setFr}
            opcoes={[{ rotulo: '≤ 30', pontos: 0 }, { rotulo: '31 – 35', pontos: 1 }, { rotulo: '36 – 40', pontos: 2 }, { rotulo: '41 – 45', pontos: 3 }, { rotulo: '≥ 46', pontos: 4 }]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            HACOR =
            <Badge className="text-lg">{pontos}</Badge>
            {pontos > 5 ? (
              <Badge variant="destructive">Provável falência da VNI</Badge>
            ) : (
              <Badge variant="success">Risco baixo de falência</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Pontuação &gt; 5 sugere possibilidade de falência da VNI, favorecendo intubação.
          </p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
