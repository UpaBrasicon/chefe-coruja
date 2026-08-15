import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Item = { label: string; opcoes: { rotulo: string; pontos: number }[] }

const itens: Item[] = [
  { label: 'Idade', opcoes: [
    { rotulo: '≤ 39', pontos: 0 }, { rotulo: '40 – 59', pontos: 5 }, { rotulo: '60 – 69', pontos: 9 },
    { rotulo: '70 – 74', pontos: 13 }, { rotulo: '75 – 79', pontos: 16 }, { rotulo: '≥ 80', pontos: 18 },
  ] },
  { label: 'Tempo de hospitalização antes da UTI', opcoes: [
    { rotulo: 'Até 13 dias', pontos: 0 }, { rotulo: '14 – 27 dias', pontos: 5 }, { rotulo: '≥ 28 dias', pontos: 13 },
  ] },
  { label: 'Procedência', opcoes: [
    { rotulo: 'Centro Cirúrgico', pontos: 0 }, { rotulo: 'Pronto Socorro', pontos: 5 },
    { rotulo: 'Outra UTI', pontos: 16 }, { rotulo: 'Outros (enfermaria, etc.)', pontos: 8 },
  ] },
  { label: 'Uso de drogas vasoativas antes da admissão', opcoes: [
    { rotulo: 'Não', pontos: 0 }, { rotulo: 'Sim', pontos: 11 },
  ] },
  { label: 'Admissão na UTI planejada', opcoes: [
    { rotulo: 'Planejada', pontos: 0 }, { rotulo: 'Não planejada', pontos: 4 },
  ] },
  { label: 'Status cirúrgico na admissão', opcoes: [
    { rotulo: 'Cirurgia programada', pontos: 0 }, { rotulo: 'Sem cirurgia', pontos: 6 }, { rotulo: 'Cirurgia de emergência', pontos: 8 },
  ] },
  { label: 'Tipo de cirurgia', opcoes: [
    { rotulo: 'Outra', pontos: 0 }, { rotulo: 'Neurocirurgia (AVC)', pontos: 6 }, { rotulo: 'Trauma', pontos: 8 },
    { rotulo: 'Cardíaca — revascularização sem reparo valvar', pontos: 10 }, { rotulo: 'Transplante', pontos: 15 },
  ] },
  { label: 'Infecção aguda na admissão', opcoes: [
    { rotulo: 'Sem infecção', pontos: 0 }, { rotulo: 'Nosocomial respiratória', pontos: 9 }, { rotulo: 'Outras infecções', pontos: 7 },
  ] },
  { label: 'Glasgow', opcoes: [
    { rotulo: '≥ 13', pontos: 0 }, { rotulo: '7 – 12', pontos: 4 }, { rotulo: '6', pontos: 5 },
    { rotulo: '5', pontos: 11 }, { rotulo: '3 – 4', pontos: 26 },
  ] },
  { label: 'Bilirrubina total (mg/dL)', opcoes: [
    { rotulo: '< 2', pontos: 0 }, { rotulo: '2 – 5,9', pontos: 4 }, { rotulo: '≥ 6', pontos: 9 },
  ] },
  { label: 'Temperatura (°C)', opcoes: [
    { rotulo: '≥ 35', pontos: 0 }, { rotulo: '< 35', pontos: 8 },
  ] },
  { label: 'Creatinina (mg/dL)', opcoes: [
    { rotulo: '< 1,2', pontos: 0 }, { rotulo: '1,2 – 1,9', pontos: 7 }, { rotulo: '2 – 3,4', pontos: 10 }, { rotulo: '≥ 3,5', pontos: 15 },
  ] },
  { label: 'Frequência cardíaca (bpm)', opcoes: [
    { rotulo: '< 120', pontos: 0 }, { rotulo: '120 – 159', pontos: 8 }, { rotulo: '≥ 160', pontos: 10 },
  ] },
  { label: 'Leucócitos (/mm³)', opcoes: [
    { rotulo: '< 15.000', pontos: 0 }, { rotulo: '≥ 15.000', pontos: 6 },
  ] },
  { label: 'pH', opcoes: [
    { rotulo: '> 7,25', pontos: 0 }, { rotulo: '≤ 7,25', pontos: 16 },
  ] },
  { label: 'Plaquetas (/mm³)', opcoes: [
    { rotulo: '≥ 100.000', pontos: 0 }, { rotulo: '50.000 – 99.000', pontos: 8 },
    { rotulo: '20.000 – 49.000', pontos: 14 }, { rotulo: '< 20.000', pontos: 20 },
  ] },
  { label: 'Pressão sistólica (mmHg)', opcoes: [
    { rotulo: '≥ 120', pontos: 0 }, { rotulo: '70 – 119', pontos: 3 }, { rotulo: '40 – 69', pontos: 16 }, { rotulo: '< 40', pontos: 23 },
  ] },
  { label: 'Oxigenação', opcoes: [
    { rotulo: 'PaO₂ ≥ 60 sem VM', pontos: 0 }, { rotulo: 'PaO₂ < 60 sem VM', pontos: 6 },
    { rotulo: 'PaO₂/FiO₂ ≥ 100 em VM', pontos: 5 }, { rotulo: 'PaO₂/FiO₂ < 100 em VM', pontos: 11 },
  ] },
]

const comorbidades = [
  'Câncer — em quimioterapia/radioterapia/imunossupressão/esteróides',
  'Insuficiência cardíaca crônica descompensada (NYHA IV)',
  'Câncer hematológico',
  'Cirrose',
  'AIDS',
  'Câncer metastático',
]

const razoes = [
  'Distúrbios de ritmo cardíaco',
  'Choque hipovolêmico (hemorrágico ou não)',
  'Choque séptico',
  'Choque anafilático, misto ou indefinido',
  'Insuficiência hepática',
  'Pancreatite grave',
  'Abdome agudo',
  'Efeito de massa intracraniano',
  'Déficit neurológico focal',
  'Convulsões',
  'Coma/Estupor/Rebaixamento de consciência/Confusão/Agitação/Delirium',
]

function ItemSelect({ item, valor, set }: { item: Item; valor: number; set: (i: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-sm">{item.label}</Label>
      <Select value={String(valor)} onValueChange={(v) => set(Number(v ?? 0))}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {item.opcoes.map((o, i) => (
            <SelectItem key={i} value={String(i)}>{o.rotulo} ({o.pontos})</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function Saps3() {
  const [valores, setValores] = useState<number[]>(() => itens.map(() => 0))
  const [comorb, setComorb] = useState<Set<string>>(new Set())
  const [razao, setRazao] = useState<Set<string>>(new Set())

  function alternar(set: Set<string>, setSet: (s: Set<string>) => void, label: string) {
    const novo = new Set(set)
    if (novo.has(label)) novo.delete(label)
    else novo.add(label)
    setSet(novo)
  }

  const pontosVar = itens.reduce((s, item, i) => s + item.opcoes[valores[i]].pontos, 0)
  const pontosComorb = comorb.size > 0 ? 3 + comorb.size : 0
  const pontosRazao = razao.size > 0 ? 4 + razao.size : 0
  const score = pontosVar + pontosComorb + pontosRazao

  // Equação geral (SAPS 3)
  const logit = -32.6659 + 7.3068 * Math.log(score + 20.5958)
  const mortalidade = 100 / (1 + Math.exp(-logit))

  return (
    <ToolLayout
      title="SAPS 3 — Mortalidade na admissão em UTI"
      description="Coleta de variáveis na admissão e estimativa de mortalidade."
      referencia="Moreno RP, et al. SAPS 3. Intensive Care Med. 2005;31:1336-44."
      revisadoEm="Revisado em 08/2026"
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          {itens.map((item, i) => (
            <ItemSelect key={item.label} item={item} valor={valores[i]} set={(v) => setValores((p) => p.map((x, idx) => (idx === i ? v : x)))} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comorbidades</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 md:grid-cols-2">
          {comorbidades.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
              <input type="checkbox" checked={comorb.has(c)} onChange={() => alternar(comorb, setComorb, c)} className="size-4" />
              <span>{c}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Razões para a admissão em UTI</CardTitle>
          <CardDescription>Selecione a principal (ou as principais).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1.5 md:grid-cols-2">
          {razoes.map((r) => (
            <label key={r} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
              <input type="checkbox" checked={razao.has(r)} onChange={() => alternar(razao, setRazao, r)} className="size-4" />
              <span>{r}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3 text-base">
            SAPS 3 =
            <Badge className="text-lg">{score} pontos</Badge>
            <span className="text-sm text-muted-foreground">Mortalidade estimada</span>
            <Badge className="text-lg">{mortalidade.toFixed(1)}%</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Estimativa pela equação geral do SAPS 3. Pode haver calibração específica por país (ex.:
            Brasil). Apoio à decisão — não substitui o julgamento clínico.
          </p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
