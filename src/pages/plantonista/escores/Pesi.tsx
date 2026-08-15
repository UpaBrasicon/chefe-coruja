import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { NumberField } from '@/components/plantonista/NumberField'
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

type Fator = { label: string; pontos: number; simplificado?: boolean }

const fatores: Fator[] = [
  { label: 'Câncer', pontos: 30, simplificado: true },
  { label: 'Insuficiência cardíaca', pontos: 10, simplificado: true },
  { label: 'Doença pulmonar crônica', pontos: 10, simplificado: true },
  { label: 'FC ≥ 110 bpm', pontos: 20, simplificado: true },
  { label: 'PAS < 100 mmHg', pontos: 30, simplificado: true },
  { label: 'FR ≥ 30 irpm', pontos: 20 },
  { label: 'Temperatura < 36 °C', pontos: 20 },
  { label: 'Alteração do estado mental', pontos: 60 },
  { label: 'SatO₂ < 90%', pontos: 20, simplificado: true },
]

function classe(p: number) {
  if (p < 66) return { classe: 'I — Baixo', risco: 'Mortalidade ~1,1%', cor: 'success' as const }
  if (p <= 85) return { classe: 'II — Baixo', risco: 'Mortalidade ~3,1%', cor: 'success' as const }
  if (p <= 105) return { classe: 'III — Moderado', risco: 'Mortalidade ~10%', cor: 'warning' as const }
  if (p <= 125) return { classe: 'IV — Alto', risco: 'Mortalidade ~24%', cor: 'destructive' as const }
  return { classe: 'V — Muito alto', risco: 'Mortalidade ~32%', cor: 'destructive' as const }
}

export function Pesi() {
  const [idade, setIdade] = useState(60)
  const [sexo, setSexo] = useState<'fem' | 'mas'>('fem')
  const [sel, setSel] = useState<Set<string>>(new Set())

  function alternar(label: string) {
    const novo = new Set(sel)
    if (novo.has(label)) novo.delete(label)
    else novo.add(label)
    setSel(novo)
  }

  const pontos = idade + (sexo === 'mas' ? 10 : 0) + fatores.filter((f) => sel.has(f.label)).reduce((s, f) => s + f.pontos, 0)
  const sPesi = (idade > 80 ? 1 : 0) + fatores.filter((f) => f.simplificado && sel.has(f.label)).length

  return (
    <ToolLayout
      title="Severidade do TEP — PESI"
      description="PESI original e simplificado (sPESI) para estratificação de risco na embolia pulmonar."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <NumberField id="pesi-idade" label="Idade" unit="anos" value={idade} onChange={setIdade} min={1} />
          <div className="flex flex-col gap-2">
            <Label>Sexo</Label>
            <Select value={sexo} onValueChange={(v) => setSexo((v as 'fem') ?? 'fem')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fem">Feminino</SelectItem>
                <SelectItem value="mas">Masculino</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fatores</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {fatores.map((f) => (
            <label key={f.label} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
              <input type="checkbox" checked={sel.has(f.label)} onChange={() => alternar(f.label)} className="size-4" />
              <span className="flex-1">{f.label}</span>
              <Badge variant="outline">+{f.pontos}</Badge>
            </label>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">PESI original</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Badge className="text-lg">{pontos} pontos</Badge>
            <Badge variant={classe(pontos).cor}>{classe(pontos).classe}</Badge>
            <p className="text-sm text-muted-foreground">{classe(pontos).risco}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">sPESI (simplificado)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Badge className="text-lg">{sPesi} ponto(s)</Badge>
            {sPesi >= 1 ? (
              <Badge variant="destructive">Alto risco — mortalidade ~10,9%</Badge>
            ) : (
              <Badge variant="success">Baixo risco — mortalidade ~1,1%</Badge>
            )}
          </CardContent>
        </Card>
      </div>
    </ToolLayout>
  )
}
