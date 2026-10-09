import { useState } from 'react'

import {
  ALERTA_SUBCORRECAO, CONDUTA_HIPONATREMIA, ERRATA_HIPONATREMIA, ERRATA_SODIO_CORRIGIDO, LIMITES_HIPONATREMIA, SALINA_3, TONICIDADE_TEXTO, elevacaoEstimadaSalina3,
  fichaHiponatremia, gravidadeHiponatremia, mlSalina3ParaElevar, sodioCorrigido, tonicidade, type CenarioHipo,
} from '@/clinico/adulto/sodio'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const br = (x: number | null | undefined, casas = 1) => (x === null || x === undefined ? '—' : (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR'))

const CENARIOS = Object.entries(CONDUTA_HIPONATREMIA) as [CenarioHipo, (typeof CONDUTA_HIPONATREMIA)[CenarioHipo]][]

/** Hiponatremia no adulto com NaCl 3% — cap. 66 do manual do HCFMUSP. */
export function HiponatremiaManual() {
  const [peso, setPeso] = useState(0)
  const [na, setNa] = useState(0)
  const [glic, setGlic] = useState(0)
  const [osm, setOsm] = useState(0)
  const [delta, setDelta] = useState(0)
  const [mlh, setMlh] = useState(0)
  const [cenario, setCenario] = useState<CenarioHipo>('cronica-sintomatico')

  const naCorr = glic > 0 ? sodioCorrigido(na, glic) : na > 0 ? na : null
  const grav = naCorr === null ? null : gravidadeHiponatremia(naCorr)
  const ton = osm > 0 ? tonicidade(osm) : null
  const mlDelta = delta > 0 ? mlSalina3ParaElevar(peso, delta) : null
  const sobe24h = mlh > 0 ? elevacaoEstimadaSalina3(peso, mlh * 24) : null
  const sobeBolus = elevacaoEstimadaSalina3(peso, LIMITES_HIPONATREMIA.bolusMl)
  const sobeMax = elevacaoEstimadaSalina3(peso, LIMITES_HIPONATREMIA.bolusMaxMl)
  const linha = CONDUTA_HIPONATREMIA[cenario]
  const cronica = cenario.startsWith('cronica')

  return (
    <ToolLayout
      title="Hiponatremia — NaCl 3% pelo manual"
      description="Sódio corrigido, classificação, preparo do NaCl 3% e a estimativa do livro (1 mL/kg ≈ +1 mEq/L), com os limites e as condutas das Tabelas 4 e 5 do manual do HCFMUSP. Adulto (14 anos ou mais)."
      ficha={fichaHiponatremia}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 md:grid-cols-4">
          <NumberField id="hipon-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <NumberField id="hipon-na" label="Sódio medido" unit="mEq/L" value={na} onChange={setNa} />
          <NumberField id="hipon-glic" label="Glicemia (opcional)" unit="mg/dL" value={glic} onChange={setGlic} />
          <NumberField id="hipon-osm" label="Osmolaridade sérica (opcional)" unit="mOsm/L" value={osm} onChange={setOsm} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classificação (p. 883, 886, 888)</CardTitle>
          <CardDescription>Hiponatremia: Na &lt; 135 (p. 882). Leve 130–134, moderada 120–129, grave &lt; 120. Aguda &lt; 48 h; crônica &gt; 48 h ou tempo desconhecido.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>Sódio {glic > 0 ? 'corrigido pela glicemia' : 'medido'}: <strong>{br(naCorr)} mEq/L</strong> — {naCorr === null ? '—' : grav ? <strong>{grav}</strong> : 'não é hiponatremia pelo corte do manual'}</p>
          {ton && <p>Pela osmolaridade: <strong>{TONICIDADE_TEXTO[ton]}</strong></p>}
          <p className="text-xs text-tinta-sussurro"><Badge variant="outline" className="mr-1">errata</Badge>{ERRATA_SODIO_CORRIGIDO}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">NaCl 3% (p. 889)</CardTitle>
          <CardDescription>Preparo do manual: {SALINA_3.sfMl} mL de SF + {SALINA_3.nacl20Ml} mL de NaCl 20% = {SALINA_3.totalMl} mL de NaCl 3%. Dica do livro: cada 1 mL/kg eleva o sódio em cerca de 1 mEq/L (estimativa).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p role="note" className="rounded-md border border-atencao/40 bg-atencao/[0.08] px-3 py-2 text-atencao">{ALERTA_SUBCORRECAO}</p>
          {!(peso > 0) ? <p className="text-tinta-sussurro">Informe o peso.</p> : (
            <>
              <p className="tabular-nums">Bolus de {LIMITES_HIPONATREMIA.bolusMl} mL ≈ <strong>+{br(sobeBolus)} mEq/L</strong> · máximo de {LIMITES_HIPONATREMIA.bolusMaxMl} mL ≈ +{br(sobeMax)} mEq/L</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <NumberField id="hipon-delta" label="Elevação desejada" unit="mEq/L" value={delta} onChange={setDelta} step={0.5} />
                  <p className="tabular-nums">{mlDelta === null ? '—' : <>≈ <strong>{br(mlDelta, 0)} mL</strong> de NaCl 3%</>}</p>
                  {cronica && delta > LIMITES_HIPONATREMIA.cronicaMax24h && <p className="text-atencao">Acima de {LIMITES_HIPONATREMIA.cronicaMax24h} mEq/L em 24 h, o limite do manual na crônica (Tabela 5).</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <NumberField id="hipon-mlh" label="Infusão contínua" unit="mL/h" value={mlh} onChange={setMlh} />
                  <p className="tabular-nums">{sobe24h === null ? '—' : <>Em 24 h: {br(mlh * 24, 0)} mL ≈ <strong>+{br(sobe24h)} mEq/L</strong>{naCorr !== null && <> (Na ≈ {br(naCorr + sobe24h)})</>}</>}</p>
                  {sobe24h !== null && sobe24h > LIMITES_HIPONATREMIA.cronicaMax24h && <p className="text-atencao">Estimativa acima de {LIMITES_HIPONATREMIA.cronicaMax24h} mEq/L em 24 h (limite do manual na crônica).</p>}
                  {sobe24h !== null && naCorr !== null && naCorr + sobe24h > LIMITES_HIPONATREMIA.pararEm && <p className="text-atencao">O manual traz parar a correção ao atingir {LIMITES_HIPONATREMIA.pararEm} mEq/L.</p>}
                </div>
              </div>
            </>
          )}
          <p className="text-xs text-tinta-sussurro"><Badge variant="outline" className="mr-1">errata</Badge>{ERRATA_HIPONATREMIA}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tabelas 4 e 5 — o que o manual traz</CardTitle>
          <CardDescription>Escolha o cenário. A decisão é de quem assiste o paciente.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {CENARIOS.map(([id, l]) => (
              <Button key={id} type="button" size="sm" variant={cenario === id ? 'default' : 'outline'} onClick={() => setCenario(id)} className="whitespace-normal text-left">{l.cenario}</Button>
            ))}
          </div>
          <ul className="list-disc pl-5">{linha.manual.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="text-tinta-sussurro">{linha.pagina}</p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
