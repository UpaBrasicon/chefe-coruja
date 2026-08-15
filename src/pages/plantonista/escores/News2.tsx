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

type Campo = {
  chave: string
  label: string
  opcoes: { rotulo: string; pontos: number }[]
}

function CampoSelect({ campo, valor, set }: { campo: Campo; valor: number; set: (idx: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{campo.label}</Label>
      <Select value={String(valor)} onValueChange={(v) => set(Number(v ?? 0))}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {campo.opcoes.map((o, i) => (
            <SelectItem key={i} value={String(i)}>
              {o.rotulo} {o.pontos !== 0 && <span className="text-muted-foreground">(+{o.pontos})</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function News2() {
  const [dpoc, setDpoc] = useState(false)
  const [emO2, setEmO2] = useState(false)
  const [sao2, setSao2] = useState(3)
  const [fr, setFr] = useState(2)
  const [fc, setFc] = useState(2)
  const [pas, setPas] = useState(3)
  const [temp, setTemp] = useState(2)
  const [consciencia, setConsciencia] = useState(0)

  const campos: Campo[] = [
    { chave: 'sao2', label: 'Saturação de O₂', opcoes: dpoc
      ? [
          { rotulo: '≤ 83', pontos: 3 }, { rotulo: '84 – 85', pontos: 2 }, { rotulo: '86 – 87', pontos: 1 },
          { rotulo: '88 – 92', pontos: 0 }, { rotulo: '93 – 94', pontos: 1 }, { rotulo: '95 – 96', pontos: 2 },
          { rotulo: '≥ 97', pontos: 3 },
        ]
      : [
          { rotulo: '≤ 91', pontos: 3 }, { rotulo: '92 – 93', pontos: 2 }, { rotulo: '94 – 95', pontos: 1 },
          { rotulo: '≥ 96', pontos: 0 },
        ] },
    { chave: 'fr', label: 'Frequência respiratória (irpm)', opcoes: [{ rotulo: '≤ 8', pontos: 3 }, { rotulo: '9 – 11', pontos: 1 }, { rotulo: '12 – 20', pontos: 0 }, { rotulo: '21 – 24', pontos: 2 }, { rotulo: '≥ 25', pontos: 3 }] },
    { chave: 'fc', label: 'Frequência cardíaca (bpm)', opcoes: [{ rotulo: '≤ 40', pontos: 3 }, { rotulo: '41 – 50', pontos: 1 }, { rotulo: '51 – 90', pontos: 0 }, { rotulo: '91 – 110', pontos: 1 }, { rotulo: '111 – 130', pontos: 2 }, { rotulo: '≥ 131', pontos: 3 }] },
    { chave: 'pas', label: 'Pressão sistólica (mmHg)', opcoes: [{ rotulo: '≤ 90', pontos: 3 }, { rotulo: '91 – 100', pontos: 2 }, { rotulo: '101 – 110', pontos: 1 }, { rotulo: '111 – 219', pontos: 0 }, { rotulo: '≥ 220', pontos: 3 }] },
    { chave: 'temp', label: 'Temperatura (°C)', opcoes: [{ rotulo: '≤ 35', pontos: 3 }, { rotulo: '35,1 – 36', pontos: 1 }, { rotulo: '36,1 – 38', pontos: 0 }, { rotulo: '38,1 – 39', pontos: 1 }, { rotulo: '≥ 39,1', pontos: 2 }] },
  ]

  const seletores: Record<string, [number, (n: number) => void]> = {
    sao2: [sao2, setSao2], fr: [fr, setFr], fc: [fc, setFc], pas: [pas, setPas], temp: [temp, setTemp],
  }

  function calcular() {
    const pontosSat = campos[0].opcoes[Math.min(sao2, campos[0].opcoes.length - 1)].pontos
    const pontos = pontosSat +
      campos[1].opcoes[fr].pontos +
      campos[2].opcoes[fc].pontos +
      campos[3].opcoes[pas].pontos +
      campos[4].opcoes[temp].pontos +
      (emO2 ? 2 : 0) +
      (consciencia === 1 ? 3 : 0)
    return pontos
  }

  const pontos = calcular()

  function risco(p: number) {
    if (p >= 7) return { nivel: 'ALTO', cor: 'destructive' as const, texto: 'Resposta de emergência imediata. Avaliação médica urgente.' }
    if (p >= 5) return { nivel: 'MÉDIO', cor: 'warning' as const, texto: 'Urgência — monitorar de 1/1h, acionar equipe.' }
    return { nivel: 'BAIXO', cor: 'success' as const, texto: 'Monitorar no mínimo de 6/6 horas.' }
  }

  return (
    <ToolLayout
      title="NEWS 2 — National Early Warning Score"
      description="Identificador precoce de deterioração aguda do paciente."
    >
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <CampoSelect campo={{ chave: 'cons', label: 'Consciência', opcoes: [{ rotulo: 'Alerta', pontos: 0 }, { rotulo: 'Confusão aguda / rebaixamento', pontos: 3 }] }} valor={consciencia} set={setConsciencia} />
            <CampoSelect campo={{ chave: 'o2', label: 'Utilizando oxigênio?', opcoes: [{ rotulo: 'Não', pontos: 0 }, { rotulo: 'Sim', pontos: 2 }] }} valor={emO2 ? 1 : 0} set={(i) => setEmO2(i === 1)} />
            <CampoSelect campo={{ chave: 'dpoc', label: 'DPOC / retentor crônico de CO₂?', opcoes: [{ rotulo: 'Não', pontos: 0 }, { rotulo: 'Sim', pontos: 0 }] }} valor={dpoc ? 1 : 0} set={(i) => setDpoc(i === 1)} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {campos.map((c) => (
              <CampoSelect key={c.chave} campo={c} valor={seletores[c.chave][0]} set={seletores[c.chave][1]} />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            NEWS 2 =
            <Badge className="text-lg">{pontos}</Badge>
            <Badge variant={risco(pontos).cor}>{risco(pontos).nivel}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{risco(pontos).texto}</p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
