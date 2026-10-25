import { useState } from 'react'

import {
  ADRENALINA_BOLUS_EV, ADRENALINA_IM, ADRENALINA_IM_WAO, ADRENALINA_INFUSAO, CUIDADOS_ANAFILAXIA, DIRETRIZES_ANAFILAXIA, SEGUNDA_LINHA_ANAFILAXIA,
  adrenalinaImWaoMg, bolusEvMl, criteriosWao2020, fichaAnafilaxiaAdulto, infusaoPorMlH, infusaoPorMlMin, triptaseLimiar, ugMlInfusao, volumeChoqueMl,
  type AchadosWao, type Faixa,
} from '@/clinico/adulto/anafilaxia'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { numero } from '@/lib/formato'

const br = (x: number, casas = 1) => numero(Math.round(x * 10 ** casas) / 10 ** casas)
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)
const lerNumero = (v: string) => (v.trim() === '' ? Number.NaN : Number(v.replace(',', '.')))

const ACHADOS: { id: keyof AchadosWao; rotulo: string }[] = [
  { id: 'pele', rotulo: 'Início agudo com pele ou mucosa (urticária generalizada, prurido, rubor, edema de lábio, língua ou úvula)' },
  { id: 'respiratorio', rotulo: 'Comprometimento respiratório (dispneia, sibilo, estridor, PFE reduzido, hipoxemia)' },
  { id: 'pa', rotulo: 'PA reduzida ou sintoma de órgão-alvo (hipotonia, síncope, incontinência)' },
  { id: 'gi', rotulo: 'Gastrointestinal grave (cólica intensa, vômitos repetidos), sobretudo com alérgeno não alimentar' },
  { id: 'alergeno', rotulo: 'Exposição a alérgeno conhecido ou muito provável para o paciente' },
  { id: 'hipotensao', rotulo: 'Hipotensão (adulto: PAS < 90 ou queda > 30% do basal)' },
  { id: 'broncoespasmo', rotulo: 'Broncoespasmo' },
  { id: 'laringe', rotulo: 'Acometimento laríngeo (estridor, mudança de voz, odinofagia)' },
]
const SEM_ACHADOS: AchadosWao = { pele: false, respiratorio: false, pa: false, gi: false, alergeno: false, hipotensao: false, broncoespasmo: false, laringe: false }

/** Anafilaxia do adulto (cap. 11 do manual do HCFMUSP). */
export function AnafilaxiaAdulto() {
  const [peso, setPeso] = useState(0)
  const [mlMin, setMlMin] = useState('')
  const [mlH, setMlH] = useState('')
  const [achados, setAchados] = useState<AchadosWao>(SEM_ACHADOS)
  const [basal, setBasal] = useState('')
  const wao = criteriosWao2020(achados)
  const imWao = adrenalinaImWaoMg(peso)
  const limiar = Number.isFinite(lerNumero(basal)) ? triptaseLimiar(lerNumero(basal)) : null
  const vol = volumeChoqueMl(peso)
  const porMin = Number.isFinite(lerNumero(mlMin)) ? infusaoPorMlMin(lerNumero(mlMin)) : null
  const porHora = Number.isFinite(lerNumero(mlH)) ? infusaoPorMlH(lerNumero(mlH)) : null
  const faixaMlH: Faixa = [ADRENALINA_INFUSAO.mlMin[0] * 60, ADRENALINA_INFUSAO.mlMin[1] * 60]
  const faixaUg: Faixa = [ADRENALINA_INFUSAO.mlMin[0] * ugMlInfusao(), ADRENALINA_INFUSAO.mlMin[1] * ugMlInfusao()]

  return (
    <ToolLayout
      title="Anafilaxia — adulto"
      description="Adrenalina IM, bolus EV e infusão com a conversão para a bomba; volume por peso e segunda linha; critérios da WAO 2020 e Practice Parameter 2023 ao lado. Adulto (14 anos ou mais)."
      ficha={fichaAnafilaxiaAdulto}
    >
      <CampoPeso id="ana-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Critérios da WAO 2020 (Tabela 2)" descricao="Ajudam a reconhecer; o Practice Parameter 2023 diz que não é preciso preenchê-los antes de dar adrenalina.">
        <div className="grid gap-1.5 text-apoio">
          {ACHADOS.map((a) => (
            <label key={a.id} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={achados[a.id]} onChange={(e) => setAchados((x) => ({ ...x, [a.id]: e.target.checked }))} />
              {a.rotulo}
            </label>
          ))}
        </div>
        {wao.provavel ? (
          <p><strong>Anafilaxia muito provável pela WAO 2020 — critério {wao.criterio}.</strong></p>
        ) : (
          <p className="text-tinta-sussurro">Nenhum dos dois critérios da WAO preenchido com o que foi marcado.</p>
        )}
      </Bloco>

      <Bloco titulo="Adrenalina">
        <LinhaManual
          nome="Intramuscular (1:1.000)"
          texto={`${faixa(ADRENALINA_IM.mg)} mg (${faixa(ADRENALINA_IM.mg)} mL da diluição 1:1.000) IM no ${ADRENALINA_IM.local}, repetida a cada ${faixa(ADRENALINA_IM.repeticaoMin, 0)} minutos conforme resposta ou recidiva`}
          conta={<strong>{faixa(ADRENALINA_IM.mg)} mL</strong>}
          pagina={ADRENALINA_IM.pagina}
        />
        <LinhaManual
          origem="A WAO 2020 traz"
          nome="Intramuscular por peso"
          texto={`${br(ADRENALINA_IM_WAO.mgKg, 2)} mg/kg, máximo ${br(ADRENALINA_IM_WAO.maximoMg)} mg, repetida a cada ${faixa(ADRENALINA_IM_WAO.repeticaoMin, 0)} minutos se refratária`}
          conta={imWao ? <><strong>{br(imWao.mg, 2)} mg</strong> = {br(imWao.mg, 2)} mL de 1:1.000{imWao.noMaximo && ' (no máximo)'}</> : 'informe o peso'}
          pagina="WAO 2020"
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
        <div className="grid gap-3 text-apoio md:grid-cols-2">
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
        {CUIDADOS_ANAFILAXIA.map((c) => <p key={c.texto} className="text-apoio text-tinta-sussurro">{c.texto} ({c.pagina}).</p>)}
      </Bloco>

      <Bloco titulo="Triptase (Practice Parameter 2023)" descricao="Colher o quanto antes, idealmente até 2 h do início, e repetir depois como basal (recomendação 2, p. 7).">
        <div className="flex max-w-xs flex-col gap-1.5 text-apoio">
          <Label htmlFor="ana-triptase">Triptase basal (ng/mL)</Label>
          <Input id="ana-triptase" inputMode="decimal" value={basal} onChange={(e) => setBasal(e.target.value)} />
          <p className="tabular-nums">{limiar !== null ? <>Elevação significativa se a aguda for de <strong>{br(limiar)} ng/mL</strong> ou mais (1,2 × basal + 2; p. 3 e 16).</> : '—'}</p>
        </div>
      </Bloco>

      <Bloco titulo="WAO 2020 e Practice Parameter 2023 × manual do HC">
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
            <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretrizes</TableHead><TableHead className="pr-3 pb-2">Onde</TableHead><TableHead className="pb-2">Manual do HC</TableHead></TableRow></TableHeader>
            <TableBody>
              {DIRETRIZES_ANAFILAXIA.map((d) => (
                <TableRow key={d.tema} className="border-t">
                  <TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell>
                  <TableCell className="pr-3 py-2">{d.texto}</TableCell>
                  <TableCell className="pr-3 py-2 text-tinta-sussurro">{d.onde}</TableCell>
                  <TableCell className="py-2 text-tinta-sussurro">{d.livro}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Bloco>

      <Bloco titulo="Segunda linha" descricao="Doses de adulto do capítulo. As doses por kg que o capítulo dá para criança não entram nesta tela.">
        {SEGUNDA_LINHA_ANAFILAXIA.map((d) => <LinhaManual key={d.id} nome={d.nome} texto={d.dose} pagina={d.pagina} nota={d.nota} />)}
      </Bloco>
    </ToolLayout>
  )
}
