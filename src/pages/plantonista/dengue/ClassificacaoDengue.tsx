import { useState } from 'react'

import { fichaDengue, grupoDengue, hidratacaoAdulto } from '@/clinico/dengue'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { NumberField } from '@/components/plantonista/NumberField'
import { SemReferenciaPediatrica } from '@/components/plantonista/SemReferenciaPediatrica'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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

  const grupo = grupoDengue({
    sangramentoPele,
    sangramentoMucosa,
    sinaisAlarme: alarme.size,
    sinaisChoque: choque.size,
  })
  const fases = hidratacaoAdulto(grupo, peso)
  const crianca = paciente === 'crianca'

  return (
    <ToolLayout
      title="Dengue — Classificação, Conduta e Hidratação (MS)"
      description="Classificação em grupos A–D para qualquer idade; volumes de hidratação do adulto."
      ficha={fichaDengue}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>Paciente</Label>
            <div className="flex gap-2">
              {([['adulto', 'Adulto (14 anos ou mais)'], ['crianca', 'Criança (menos de 14 anos)']] as const).map(([v, rotulo]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={paciente === v}
                  onClick={() => setPaciente(v)}
                  className={cn('rounded-lg border px-3 py-2 text-left text-sm', paciente === v ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')}
                >
                  {rotulo}
                </button>
              ))}
            </div>
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

      <Card className={grupo === 'D' ? 'border-critico/30' : grupo === 'C' ? 'border-atencao/30' : 'border-primary'}>
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
          {crianca ? (
            <SemReferenciaPediatrica detalhe="A classificação acima vale para a criança. O volume de hidratação da criança está na ferramenta Dengue — criança (seção Pediatria), pelo livro do ICr-HCFMUSP." />
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {fases.map((f) => (
                  <tr key={f.etapa} className="border-b last:border-0">
                    <td className="py-1.5 pr-3 font-medium">{f.etapa}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{f.regra}</td>
                    <td className="py-1.5 text-right tabular-nums">{f.volumeMl === null ? '—' : `${f.volumeMl.toLocaleString('pt-BR')} mL`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {grupo === 'B' && <p className="text-muted-foreground">☞ Grupo B não se decide sem hemograma: com hemoconcentração, a conduta é a do grupo C.</p>}
          {grupo === 'C' && <p className="text-atencao">☞ Hemograma, albumina e transaminases na admissão. Internação até estabilizar, no mínimo 48 h. Reavaliar após 1 h e Ht a cada 2 h.</p>}
          {grupo === 'D' && <p className="text-critico">☞ Reavaliação a cada 15–30 min, Ht a cada 2 h. Leito de terapia intensiva de preferência.</p>}
          <p className="text-muted-foreground">O grupo muda no curso da doença: vale para a reavaliação de agora.</p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}

