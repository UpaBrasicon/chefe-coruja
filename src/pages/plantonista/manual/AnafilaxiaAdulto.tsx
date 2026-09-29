import { useState } from 'react'

import {
  ADRENALINA_BOLUS_EV, ADRENALINA_IM, ADRENALINA_INFUSAO, CUIDADOS_ANAFILAXIA, SEGUNDA_LINHA_ANAFILAXIA,
  bolusEvMl, fichaAnafilaxiaAdulto, infusaoPorMlH, infusaoPorMlMin, ugMlInfusao, volumeChoqueMl, type Faixa,
} from '@/clinico/adulto/anafilaxia'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)
const lerNumero = (v: string) => (v.trim() === '' ? Number.NaN : Number(v.replace(',', '.')))

/** Anafilaxia do adulto (cap. 11 do manual do HCFMUSP). */
export function AnafilaxiaAdulto() {
  const [peso, setPeso] = useState(0)
  const [mlMin, setMlMin] = useState('')
  const [mlH, setMlH] = useState('')
  const vol = volumeChoqueMl(peso)
  const porMin = Number.isFinite(lerNumero(mlMin)) ? infusaoPorMlMin(lerNumero(mlMin)) : null
  const porHora = Number.isFinite(lerNumero(mlH)) ? infusaoPorMlH(lerNumero(mlH)) : null
  const faixaMlH: Faixa = [ADRENALINA_INFUSAO.mlMin[0] * 60, ADRENALINA_INFUSAO.mlMin[1] * 60]
  const faixaUg: Faixa = [ADRENALINA_INFUSAO.mlMin[0] * ugMlInfusao(), ADRENALINA_INFUSAO.mlMin[1] * ugMlInfusao()]

  return (
    <ToolLayout
      title="Anafilaxia — adulto"
      description="Adrenalina IM, bolus EV e infusão com a conversão para a bomba; volume por peso e segunda linha. Adulto (14 anos ou mais)."
      ficha={fichaAnafilaxiaAdulto}
    >
      <CampoPeso id="ana-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Adrenalina">
        <LinhaManual
          nome="Intramuscular (1:1.000)"
          texto={`${faixa(ADRENALINA_IM.mg)} mg (${faixa(ADRENALINA_IM.mg)} mL da diluição 1:1.000) IM no ${ADRENALINA_IM.local}, repetida a cada ${faixa(ADRENALINA_IM.repeticaoMin, 0)} minutos conforme resposta ou recidiva`}
          conta={<strong>{faixa(ADRENALINA_IM.mg)} mL</strong>}
          pagina={ADRENALINA_IM.pagina}
        />
        <LinhaManual
          nome="Bolus EV (1:10.000)"
          texto={`${br(ADRENALINA_BOLUS_EV.mg)} mg — ${ADRENALINA_BOLUS_EV.preparo}, aplicando 1 mL, ao longo de ${faixa(ADRENALINA_BOLUS_EV.minutos, 0)} min; ${ADRENALINA_BOLUS_EV.quando}`}
          conta={<><strong>{br(bolusEvMl())} mL</strong> do preparo</>}
          pagina={ADRENALINA_BOLUS_EV.pagina}
        />
        <LinhaManual
          nome="Infusão contínua"
          texto={`1 mg em 500 mL de SG ou SF, a ${faixa(ADRENALINA_INFUSAO.mlMin)} mL/min, titulando o efeito (refratário ao bolus)`}
          conta={<>{br(ugMlInfusao(), 0)} µg/mL · <strong>{faixa(faixaMlH, 0)} mL/h</strong> = {faixa(faixaUg, 0)} µg/min</>}
          pagina={ADRENALINA_INFUSAO.pagina}
        />
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ana-mlmin">Velocidade do manual (mL/min) → bomba</Label>
            <Input id="ana-mlmin" inputMode="decimal" value={mlMin} onChange={(e) => setMlMin(e.target.value)} />
            <p className="tabular-nums">{porMin ? <><strong>{br(porMin.mlH)} mL/h</strong> · {br(porMin.ugMin)} µg/min</> : '—'}</p>
            {porMin?.foraDaFaixa && <p className="text-atencao">Fora da faixa de 0,5–2 mL/min do manual.</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ana-mlh">Velocidade na bomba (mL/h) → dose</Label>
            <Input id="ana-mlh" inputMode="decimal" value={mlH} onChange={(e) => setMlH(e.target.value)} />
            <p className="tabular-nums">{porHora ? <><strong>{br(porHora.ugMin)} µg/min</strong> · {br(porHora.mlMin, 2)} mL/min</> : '—'}</p>
            {porHora?.foraDaFaixa && <p className="text-atencao">Fora da faixa de 30–120 mL/h (0,5–2 mL/min) do manual.</p>}
          </div>
        </div>
      </Bloco>

      <Bloco titulo="Volume no choque">
        <LinhaManual nome="Cristaloide" texto="10 a 20 mL por kg de peso nos primeiros minutos, por acesso calibroso" conta={vol ? <strong>{faixa(vol, 0)} mL</strong> : 'informe o peso'} pagina="p. 177" />
        {CUIDADOS_ANAFILAXIA.map((c) => <p key={c.texto} className="text-sm text-tinta-sussurro">{c.texto} ({c.pagina}).</p>)}
      </Bloco>

      <Bloco titulo="Segunda linha" descricao="Doses de adulto do capítulo. As doses por kg que o capítulo dá para criança não entram nesta tela.">
        {SEGUNDA_LINHA_ANAFILAXIA.map((d) => <LinhaManual key={d.id} nome={d.nome} texto={d.dose} pagina={d.pagina} nota={d.nota} />)}
      </Bloco>
    </ToolLayout>
  )
}
