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

const paduaFatores: { label: string; pontos: number }[] = [
  { label: 'Câncer ativo', pontos: 3 },
  { label: 'História pessoal de TEV', pontos: 3 },
  { label: 'Imobilização ≥ 3 dias', pontos: 3 },
  { label: 'Trombofilia hereditária ou adquirida', pontos: 3 },
  { label: 'Trauma ou cirurgia recente (≤ 1 mês)', pontos: 2 },
  { label: 'Idade ≥ 70 anos', pontos: 1 },
  { label: 'Insuficiência cardíaca ou respiratória', pontos: 1 },
  { label: 'Infecção aguda ou doença reumatológica', pontos: 1 },
  { label: 'Obesidade (IMC ≥ 30)', pontos: 1 },
  { label: 'Terapia hormonal', pontos: 1 },
]

const capriniAlto = [
  'AVC (< 1 mês) +5', 'Fratura de quadril, pelve ou perna +5', 'Lesão medular aguda (< 1 mês) +5', 'COVID-19 (alto risco) +5',
]
const caprini3 = [
  'História pessoal de TEV +3', 'História familiar de TEV +3', 'Fator V de Leiden +3', 'Protrombina 20210A +3',
  'Anticoagulante lúpico +3', 'Anticorpos anticardiolipina +3', 'Homocisteína sérica elevada +3',
  'Trombocitopenia induzida por heparina (HIT) +3', 'Outras trombofilias +3',
]
const caprini2 = [
  'Paciente acamado (≥ 72 h) +2', 'Imobilização com gesso +2', 'Neoplasia maligna +2', 'Cateter venoso central / PICC +2',
]
const caprini1 = [
  'Idade 41–60 anos +1', 'Idade 61–74 anos +2', 'Idade ≥ 75 anos +3',
  'IMC > 25 kg/m² +1', 'Edema nos membros inferiores +1', 'Veias varicosas +1', 'Gravidez ou puerpério +1',
  'História de aborto espontâneo +1', 'Contraceptivos orais ou reposição hormonal +1', 'Sepse (< 1 mês) +1',
  'Doença pulmonar grave / pneumonia (< 1 mês) +1', 'IAM +1', 'ICC (< 1 mês) +1', 'Doença inflamatória intestinal +1',
  'Repouso no leito por orientação médica +1', 'Pequena cirurgia (< 45 min) +1', 'Cirurgia ≥ 45 min +2',
]

type Linha = { label: string; pontos: number }

const capriniFatores: { grupo: string; itens: Linha[] }[] = [
  { grupo: '5 pontos', itens: capriniAlto.map((s) => ({ label: s, pontos: 5 })) },
  { grupo: '3 pontos', itens: caprini3.map((s) => ({ label: s, pontos: 3 })) },
  { grupo: '2 pontos', itens: caprini2.map((s) => ({ label: s, pontos: 2 })) },
  { grupo: '1 ponto', itens: caprini1.map((s) => ({ label: s, pontos: 1 })) },
]

function Checklist({ itens, selecionados, alternar }: { itens: Linha[]; selecionados: Set<string>; alternar: (label: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {itens.map((f) => (
        <label key={f.label} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
          <input
            type="checkbox"
            checked={selecionados.has(f.label)}
            onChange={() => alternar(f.label)}
            className="size-4"
          />
          <span className="flex-1">{f.label.replace(/ \+\d+$/, '')}</span>
          <Badge variant="outline">+{f.pontos}</Badge>
        </label>
      ))}
    </div>
  )
}

export function ProfilaxiaTEV() {
  const [tipo, setTipo] = useState<'clinico' | 'cirurgico' | 'ortopedico' | 'obstetrico'>('clinico')
  const [paduaSel, setPaduaSel] = useState<Set<string>>(new Set())
  const [capriniSel, setCapriniSel] = useState<Set<string>>(new Set())
  const [cirurgiaOrtop, setCirurgiaOrtop] = useState('')
  const [obstetrico, setObstetrico] = useState('')

  function alternar(set: Set<string>, setSet: (s: Set<string>) => void, label: string) {
    const novo = new Set(set)
    if (novo.has(label)) novo.delete(label)
    else novo.add(label)
    setSet(novo)
  }

  const padua = paduaFatores.filter((f) => paduaSel.has(f.label)).reduce((s, f) => s + f.pontos, 0)
  const caprini = capriniFatores
    .flatMap((g) => g.itens)
    .filter((f) => capriniSel.has(f.label))
    .reduce((s, f) => s + f.pontos, 0)

  function classeCaprini(p: number) {
    if (p <= 1) return { risco: 'Baixo', texto: 'Deambulação precoce. Profilaxia mecânica considerada.' }
    if (p <= 2) return { risco: 'Moderado', texto: 'Profilaxia farmacológica ou mecânica.' }
    if (p <= 4) return { risco: 'Alto', texto: 'Profilaxia farmacológica + mecânica.' }
    return { risco: 'Muito alto', texto: 'Profilaxia farmacológica + mecânica. Considerar dosagem ajustada.' }
  }

  return (
    <ToolLayout
      title="Profilaxia de Tromboembolismo Venoso"
      description="Escore de Pádua (clínico), Caprini (cirúrgico), avaliação ortopédica e obstétrica."
    >
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-2">
            <Label>Tipo de paciente</Label>
            <Select value={tipo} onValueChange={(v) => setTipo((v as typeof tipo) ?? 'clinico')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clinico">Paciente clínico</SelectItem>
                <SelectItem value="cirurgico">Paciente cirúrgico</SelectItem>
                <SelectItem value="ortopedico">Cirúrgico ortopédico</SelectItem>
                <SelectItem value="obstetrico">Paciente obstétrico</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {tipo === 'clinico' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Escore de Pádua
              <Badge className="text-base">Total: {padua}</Badge>
            </CardTitle>
            <CardDescription>Risco alto se ≥ 4 pontos.</CardDescription>
          </CardHeader>
          <CardContent>
            <Checklist itens={paduaFatores} selecionados={paduaSel} alternar={(l) => alternar(paduaSel, setPaduaSel, l)} />
            <div className="mt-4 rounded-lg border p-3 text-sm">
              {padua >= 4 ? (
                <p><Badge variant="destructive" className="mr-2">Alto risco</Badge>Profilaxia farmacológica + mecânica recomendada.</p>
              ) : (
                <p><Badge variant="success" className="mr-2">Baixo risco</Badge>Deambulação precoce e profilaxia mecânica.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {tipo === 'cirurgico' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Escore de Caprini
              <Badge className="text-base">Total: {caprini}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {capriniFatores.map((g) => (
              <div key={g.grupo} className="flex flex-col gap-1.5">
                <div className="text-xs font-medium text-muted-foreground">{g.grupo}</div>
                <Checklist itens={g.itens} selecionados={capriniSel} alternar={(l) => alternar(capriniSel, setCapriniSel, l)} />
              </div>
            ))}
            <div className="rounded-lg border p-3 text-sm">
              <Badge variant={caprini <= 1 ? 'success' : caprini <= 2 ? 'info' : caprini <= 4 ? 'warning' : 'destructive'} className="mr-2">
                {classeCaprini(caprini).risco}
              </Badge>
              {classeCaprini(caprini).texto}
            </div>
          </CardContent>
        </Card>
      )}

      {tipo === 'ortopedico' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cirurgia ortopédica</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex flex-col gap-2">
              <Label>Tipo de cirurgia</Label>
              <Select value={cirurgiaOrtop || null} onValueChange={(v) => setCirurgiaOrtop(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quadril">Artroplastia de quadril</SelectItem>
                  <SelectItem value="joelho">Artroplastia de joelho</SelectItem>
                  <SelectItem value="fratura">Fratura de quadril</SelectItem>
                  <SelectItem value="outra">Outra ortopédica c/ impacto na mobilidade</SelectItem>
                  <SelectItem value="sem">Outra ortopédica s/ impacto na mobilidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cirurgiaOrtop && cirurgiaOrtop !== 'sem' && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                <Badge variant="warning" className="mb-1">Alto risco</Badge>
                <p>Profilaxia obrigatória (farmacológica + mecânica), conforme diretrizes.</p>
              </div>
            )}
            {cirurgiaOrtop === 'sem' && (
              <p className="text-sm text-muted-foreground">Avaliar pelo Escore de Pádua (aba clínico).</p>
            )}
          </CardContent>
        </Card>
      )}

      {tipo === 'obstetrico' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Condição obstétrica</CardTitle>
            <CardDescription>Profilaxia não farmacológica indicada para todas as pacientes.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label>Subgrupo de risco</Label>
              <Select value={obstetrico || null} onValueChange={(v) => setObstetrico(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Sem fatores de risco específicos</SelectItem>
                  <SelectItem value="baixo">Trombofilia de baixo risco (sem TEV prévia)</SelectItem>
                  <SelectItem value="provocado">TEV anterior provocado</SelectItem>
                  <SelectItem value="nao_provocado">TEV anterior não provocado ou associado a estrogênio</SelectItem>
                  <SelectItem value="2mais">2 ou mais fatores de risco</SelectItem>
                  <SelectItem value="alto">Trombofilia de alto risco</SelectItem>
                  <SelectItem value="covid">COVID-19 confirmado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {obstetrico && (
              <div className="rounded-lg border p-3 text-sm">
                {obstetrico === 'nenhum' && <p>Sem profilaxia farmacológica de rotina. Manter medidas mecânicas.</p>}
                {obstetrico === 'baixo' && <p>Considerar profilaxia farmacológica no pós-parto, individualizando.</p>}
                {obstetrico === 'provocado' && <p>Profilaxia farmacológica (enoxaparina) no período pós-parto.</p>}
                {obstetrico === 'nao_provocado' && <p>Profilaxia farmacológica anteparto e pós-parto.</p>}
                {obstetrico === '2mais' && <p>Considerar profilaxia farmacológica anteparto e pós-parto.</p>}
                {obstetrico === 'alto' && <p>Profilaxia farmacológica anteparto e pós-parto (alto risco).</p>}
                {obstetrico === 'covid' && <p>Profilaxia farmacológica, avaliando risco-benefício.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referência rápida — fármacos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="success" className="mb-1">Enoxaparina — 1ª linha</Badge>
            <p>40 mg SC 1×/dia. ClCr ≤ 30 → 20 mg 1×/dia. IMC ≥ 35: considerar 60 mg. Antídoto: protamina.</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Heparina não fracionada</Badge>
            <p>5.000 UI SC 8/8h ou 12/12h. Antídoto: protamina 1 mg/100 UI (máx. 50 mg).</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Fondaparinux</Badge>
            <p>2,5 mg SC 1×/dia. Opção em HIT. Contraindicado se ClCr ≤ 30.</p>
          </div>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
