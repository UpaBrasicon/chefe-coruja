import { useState } from 'react'

import { INFUSOES_ADULTO, concentracao, doseAdulto, fichaInfusoesAdulto, unidadeDose, velocidadeAdulto, type InfusaoAdulto } from '@/clinico/adulto/infusoes'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const br = (x: number | null, casas = 1) => (x === null ? '—' : (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR'))
const lerNumero = (v: string) => (v.trim() === '' ? Number.NaN : Number(v.replace(',', '.')))

const TITULO: Record<InfusaoAdulto['grupo'], string> = {
  vasoativo: 'Drogas vasoativas — adulto',
  sedacao: 'Sedação e analgesia contínua — adulto',
  bloqueio: 'Bloqueio neuromuscular contínuo — adulto',
}

function Linha({ i, peso }: { i: InfusaoAdulto; peso: number }) {
  const [dose, setDose] = useState('')
  const [mlh, setMlh] = useState('')
  const d = lerNumero(dose)
  const v = lerNumero(mlh)
  const semPeso = i.porKg && !(peso > 0)
  const vel = Number.isFinite(d) ? velocidadeAdulto(i, d, peso) : null
  const doseDaBomba = Number.isFinite(v) ? doseAdulto(i, v, peso) : null
  const foraFaixa = Number.isFinite(d) && (d < i.faixa[0] || d > i.faixa[1])
  const u = unidadeDose(i)
  const conc = concentracao(i)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{i.nome}</CardTitle>
        <CardDescription>
          {i.preparo} · concentração {br(conc, 2)} {i.numerador === 'mcg' ? 'µg' : i.numerador}/mL · faixa usual {br(i.faixa[0], 3)}–{br(i.faixa[1], 3)} {u}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${i.id}-dose`}>Dose ({u}) → velocidade</Label>
          <Input id={`${i.id}-dose`} inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value)} />
          <p className="tabular-nums">{semPeso ? 'Informe o peso.' : vel === null ? '—' : <strong>{br(vel)} mL/h</strong>}</p>
          {foraFaixa && <p className="text-atencao">Fora da faixa usual do manual.</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${i.id}-mlh`}>Velocidade na bomba (mL/h) → dose</Label>
          <Input id={`${i.id}-mlh`} inputMode="decimal" value={mlh} onChange={(e) => setMlh(e.target.value)} />
          <p className="tabular-nums">{semPeso ? 'Informe o peso.' : doseDaBomba === null ? '—' : <strong>{br(doseDaBomba, 3)} {u}</strong>}</p>
        </div>
        <p className="text-muted-foreground md:col-span-2">
          Manual HCFMUSP, {i.pagina}.
          {i.errata && <><Badge variant="outline" className="mx-1">errata</Badge>{i.errata}</>}
        </p>
      </CardContent>
    </Card>
  )
}

/** Infusões contínuas do adulto, por grupo (Anexo 1 do manual do HCFMUSP). */
export function InfusoesAdulto({ grupo }: { grupo: InfusaoAdulto['grupo'] }) {
  const [peso, setPeso] = useState(0)
  return (
    <ToolLayout
      title={TITULO[grupo]}
      description="Preparo padrão do HC, velocidade pela dose e dose pela velocidade da bomba. Adulto (14 anos ou mais)."
      ficha={fichaInfusoesAdulto}
    >
      <Card>
        <CardContent className="pt-6">
          <NumberField id="inf-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={0} step={0.1} />
        </CardContent>
      </Card>
      {INFUSOES_ADULTO.filter((i) => i.grupo === grupo).map((i) => <Linha key={i.id} i={i} peso={peso} />)}
    </ToolLayout>
  )
}

export const DrogasVasoativas = () => <InfusoesAdulto grupo="vasoativo" />
export const SedacaoContinua = () => <InfusoesAdulto grupo="sedacao" />
export const BloqueioNeuromuscular = () => <InfusoesAdulto grupo="bloqueio" />
