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

const sinaisAlarme = [
  'Dor abdominal intensa (referida ou à palpação) e contínua',
  'Vômitos persistentes',
  'Acúmulo de líquidos (ascite, derrame pleural/pericárdico)',
  'Hipotensão postural e/ou lipotímia',
  'Hepatomegalia > 2 cm abaixo do rebordo costal',
  'Letargia e/ou irritabilidade',
  'Aumento progressivo do hematócrito',
]

const sinaisChoque = [
  'Sinais de choque (taquicardia, pulso filiforme, enchimento capilar > 2 s, extremidades frias, oligúria < 1,5 mL/kg/h, hipotensão, PA convergente < 20 mmHg)',
  'Sangramento grave',
  'Disfunção grave de órgãos',
]

export function ClassificacaoDengue() {
  const [paciente, setPaciente] = useState<'adulto' | 'crianca'>('adulto')
  const [peso, setPeso] = useState(70)
  const [sangramentoPele, setSangramentoPele] = useState(false)
  const [sangramentoMucosa, setSangramentoMucosa] = useState(false)
  const [alarme, setAlarme] = useState<Set<string>>(new Set())
  const [choque, setChoque] = useState<Set<string>>(new Set())

  function alternar(set: Set<string>, setSet: (s: Set<string>) => void, label: string) {
    const novo = new Set(set)
    if (novo.has(label)) novo.delete(label)
    else novo.add(label)
    setSet(novo)
  }

  const grupo: 'A' | 'B' | 'C' | 'D' = choque.size > 0
    ? 'D'
    : alarme.size > 0 || sangramentoMucosa
      ? 'C'
      : sangramentoPele
        ? 'B'
        : 'A'

  // Hidratação conforme MS 2024
  const fator = paciente === 'crianca' ? peso : peso
  const hidratacao = {
    A: {
      orientacao: `Ingesta de ${(60 * fator).toFixed(0)} mL de líquidos em 24 horas (${((60 * fator) / 3).toFixed(0)} mL nas primeiras 4–6 h com SRO + ${(((60 * fator) / 3) * 2).toFixed(0)} mL de líquidos caseiros no restante).`,
    },
    B: {
      orientacao: 'Solicitar obrigatoriamente hemograma. Se hematócrito normal, tratar ambulatorialmente. Em hemoconcentração ou sinais de alarme, conduzir como Grupo C.',
    },
    C: {
      expansao1: `Expansão volêmica imediata: ${(10 * fator).toFixed(0)} mL de SF 0,9% na 1ª hora.`,
      expansao2: `Manter ${(10 * fator).toFixed(0)} mL na 2ª hora (máx. de cada fase: ${(30 * fator).toFixed(0)} mL em 2 h, até 3 fases).`,
      manutencao: `Fase de manutenção: ${(25 * fator).toFixed(0)} mL de SF 0,9% em 6 h, depois ${(25 * fator).toFixed(0)} mL em 8 h.`,
    },
    D: {
      expansao: `Expansão rápida: ${(20 * fator).toFixed(0)} mL de SF 0,9% em até 20 minutos (repetir até 3 vezes).`,
    },
  } as const

  return (
    <ToolLayout
      title="Dengue — Classificação, Conduta e Hidratação (MS)"
      description="Classificação em grupos A–D e orientação de hidratação conforme Ministério da Saúde."
      referencia="Ministério da Saúde — Manual de Dengue (atualização)."
      revisadoEm="Revisado em 08/2026"
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>Paciente</Label>
            <Select value={paciente} onValueChange={(v) => setPaciente((v as 'adulto') ?? 'adulto')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adulto">Adulto</SelectItem>
                <SelectItem value="crianca">Criança (&lt; 13 anos)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NumberField id="dg-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={1} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sinais</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
            <input type="checkbox" checked={sangramentoPele} onChange={() => setSangramentoPele((v) => !v)} className="size-4" />
            <span>Sangramento espontâneo de pele ou induzido (prova do laço, petéquias)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
            <input type="checkbox" checked={sangramentoMucosa} onChange={() => setSangramentoMucosa((v) => !v)} className="size-4" />
            <span>Sangramento de mucosa</span>
          </label>

          <div className="mt-2 text-xs font-medium text-muted-foreground">Sinais de alarme</div>
          {sinaisAlarme.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
              <input type="checkbox" checked={alarme.has(s)} onChange={() => alternar(alarme, setAlarme, s)} className="size-4" />
              <span>{s}</span>
            </label>
          ))}

          <div className="mt-2 text-xs font-medium text-muted-foreground">Choque / gravidade</div>
          {sinaisChoque.map((s) => (
            <label key={s} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
              <input type="checkbox" checked={choque.has(s)} onChange={() => alternar(choque, setChoque, s)} className="size-4" />
              <span>{s}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className={grupo === 'D' ? 'border-red-400' : grupo === 'C' ? 'border-amber-400' : 'border-primary'}>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            Grupo
            <Badge className="text-lg">{grupo}</Badge>
            <span className="text-sm font-normal text-muted-foreground">
              {grupo === 'A' && 'Sem sinais de alarme'}
              {grupo === 'B' && 'Sangramento de pele/induzido, sem sinais de alarme'}
              {grupo === 'C' && 'Sinais de alarme'}
              {grupo === 'D' && 'Choque ou disfunção grave de órgãos'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {grupo === 'A' && (
            <>
              <p className="text-muted-foreground">{hidratacao.A.orientacao}</p>
              <p className="text-muted-foreground">☞ Exames complementares a critério médico.</p>
            </>
          )}
          {grupo === 'B' && (
            <>
              <p className="text-muted-foreground">{hidratacao.B.orientacao}</p>
              <p className="text-muted-foreground">☞ Reposição oral com SRO e líquidos caseiros (grupo A).</p>
            </>
          )}
          {grupo === 'C' && (
            <>
              <p><strong>1ª hora:</strong> {hidratacao.C.expansao1}</p>
              <p><strong>2ª hora:</strong> {hidratacao.C.expansao2}</p>
              <p><strong>Manutenção:</strong> {hidratacao.C.manutencao}</p>
              <p className="text-amber-700">☞ Hemograma, albumina e transaminases obrigatórios. Internação até estabilização (mín. 48 h). Reavaliar após 1 h e Ht a cada 2 h.</p>
            </>
          )}
          {grupo === 'D' && (
            <>
              <p><strong>Expansão rápida:</strong> {hidratacao.D.expansao}</p>
              <p className="text-red-700">☞ Reavaliação a cada 15–30 min, Ht a cada 2 h. Acompanhamento preferencial em UTI.</p>
            </>
          )}
        </CardContent>
      </Card>
    </ToolLayout>
  )
}

