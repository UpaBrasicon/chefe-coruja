import { useState } from 'react'

import {
  ALERTA_SUBCORRECAO, CONDUTA_HIPONATREMIA, DIFERENCAS_HIPONATREMIA, DIRETRIZ_HIPONATREMIA, ERRATA_HIPONATREMIA, ERRATA_SODIO_CORRIGIDO, LIMITES_HIPONATREMIA, SALINA_3, TONICIDADE_TEXTO, elevacaoEstimadaSalina3,
  fichaHiponatremia, gravidadeHiponatremia, mlSalina3ParaElevar, sodioCorrigido, tonicidade, type CenarioHipo,
} from '@/clinico/adulto/sodio'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'
import { numero } from '@/lib/formato'

const br = (x: number | null | undefined, casas = 1) => (x === null || x === undefined ? '—' : numero(Math.round(x * 10 ** casas) / 10 ** casas))

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
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaHiponatremia.id)

  const naCorr = glic > 0 ? sodioCorrigido(na, glic) : na > 0 ? na : null
  const grav = naCorr === null ? null : gravidadeHiponatremia(naCorr)
  const ton = osm > 0 ? tonicidade(osm) : null
  const mlDelta = delta > 0 ? mlSalina3ParaElevar(peso, delta) : null
  const sobe24h = mlh > 0 ? elevacaoEstimadaSalina3(peso, mlh * 24) : null
  const sobeBolus = elevacaoEstimadaSalina3(peso, LIMITES_HIPONATREMIA.bolusMl)
  const sobeMax = elevacaoEstimadaSalina3(peso, LIMITES_HIPONATREMIA.bolusMaxMl)
  const linha = CONDUTA_HIPONATREMIA[cenario]
  const cronica = cenario.startsWith('cronica')

  // Os alertas de limite que a tela já mostra em cor de atenção; o resumo os repete.
  const alertaDelta = peso > 0 && cronica && delta > LIMITES_HIPONATREMIA.cronicaMax24h ? `Acima de ${LIMITES_HIPONATREMIA.cronicaMax24h} mEq/L em 24 h, o limite do manual na crônica (Tabela 5).` : null
  const alerta24h = peso > 0 && sobe24h !== null && sobe24h > LIMITES_HIPONATREMIA.cronicaMax24h ? `Estimativa acima de ${LIMITES_HIPONATREMIA.cronicaMax24h} mEq/L em 24 h (limite do manual na crônica).` : null
  const alertaParar = peso > 0 && sobe24h !== null && naCorr !== null && naCorr + sobe24h > LIMITES_HIPONATREMIA.pararEm ? `O manual traz parar a correção ao atingir ${LIMITES_HIPONATREMIA.pararEm} mEq/L.` : null
  const alertas = [alertaDelta, alerta24h, alertaParar].filter((a): a is string => a !== null)

  const textoNa = naCorr === null ? '' : `${br(naCorr)} mEq/L — ${grav ?? 'não é hiponatremia pelo corte do manual'}`
  const textoDelta = mlDelta === null ? null : `Elevar ${br(delta)} mEq/L ≈ ${br(mlDelta, 0)} mL de NaCl 3%`
  const texto24h = sobe24h === null ? null : `Em 24 h: ${br(mlh * 24, 0)} mL ≈ +${br(sobe24h)} mEq/L${naCorr !== null ? ` (Na ≈ ${br(naCorr + sobe24h)})` : ''}`

  // Texto do "Copiar" (C4 = A): dados, classificação, contas do NaCl 3%, alertas e a conduta do cenário.
  const copia = naCorr !== null
    ? textoCopia({
        ferramenta: 'Hiponatremia — NaCl 3% pelo manual (adulto)',
        dados: [
          ['Peso', peso > 0 ? `${numeroBr(peso)} kg` : ''],
          ['Sódio medido', `${numeroBr(na)} mEq/L`],
          ['Glicemia', glic > 0 ? `${numeroBr(glic)} mg/dL` : ''],
          ['Osmolaridade sérica', osm > 0 ? `${numeroBr(osm)} mOsm/L` : ''],
          ['Elevação desejada', peso > 0 && delta > 0 ? `${numeroBr(delta)} mEq/L` : ''],
          ['Infusão contínua', peso > 0 && mlh > 0 ? `${numeroBr(mlh)} mL/h` : ''],
          ['Cenário', linha.cenario],
        ],
        resultado: [
          `Sódio ${glic > 0 ? 'corrigido pela glicemia' : 'medido'}: ${textoNa} (p. 883, 886, 888)`,
          ...(ton ? [`Pela osmolaridade: ${TONICIDADE_TEXTO[ton]}`] : []),
          ...(peso > 0
            ? [
                `NaCl 3% (p. 889): bolus de ${LIMITES_HIPONATREMIA.bolusMl} mL ≈ +${br(sobeBolus)} mEq/L · máximo de ${LIMITES_HIPONATREMIA.bolusMaxMl} mL ≈ +${br(sobeMax)} mEq/L`,
                ...(textoDelta ? [textoDelta] : []),
                ...(texto24h ? [texto24h] : []),
                ...alertas,
              ]
            : []),
          `Tabelas 4 e 5 — ${linha.cenario} (${linha.pagina}):`,
          ...linha.manual.map((t) => `- ${t}`),
        ],
        fonte: textoFontes(fichaHiponatremia),
        versao: fichaHiponatremia.versao,
        quando: new Date(),
      })
    : undefined

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
          <CardTitle className="text-corpo">Classificação (p. 883, 886, 888)</CardTitle>
          <CardDescription>Hiponatremia: Na &lt; 135 (p. 882). Leve 130–134, moderada 120–129, grave &lt; 120. Aguda &lt; 48 h; crônica &gt; 48 h ou tempo desconhecido.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-apoio">
          <p>Sódio {glic > 0 ? 'corrigido pela glicemia' : 'medido'}: <strong>{br(naCorr)} mEq/L</strong> — {naCorr === null ? '—' : grav ? <strong>{grav}</strong> : 'não é hiponatremia pelo corte do manual'}</p>
          {ton && <p>Pela osmolaridade: <strong>{TONICIDADE_TEXTO[ton]}</strong></p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">NaCl 3% (p. 889)</CardTitle>
          <CardDescription>Preparo do manual: {SALINA_3.sfMl} mL de SF + {SALINA_3.nacl20Ml} mL de NaCl 20% = {SALINA_3.totalMl} mL de NaCl 3%. Dica do livro: cada 1 mL/kg eleva o sódio em cerca de 1 mEq/L (estimativa).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-apoio">
          <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-atencao">{ALERTA_SUBCORRECAO}</p>
          {!(peso > 0) ? <p className="text-tinta-sussurro">Informe o peso.</p> : (
            <>
              <p className="tabular-nums">Bolus de {LIMITES_HIPONATREMIA.bolusMl} mL ≈ <strong>+{br(sobeBolus)} mEq/L</strong> · máximo de {LIMITES_HIPONATREMIA.bolusMaxMl} mL ≈ +{br(sobeMax)} mEq/L</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <NumberField id="hipon-delta" label="Elevação desejada" unit="mEq/L" value={delta} onChange={setDelta} step={0.5} />
                  <p className="tabular-nums">{mlDelta === null ? '—' : <>≈ <strong>{br(mlDelta, 0)} mL</strong> de NaCl 3%</>}</p>
                  {alertaDelta && <p className="text-atencao">{alertaDelta}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <NumberField id="hipon-mlh" label="Infusão contínua" unit="mL/h" value={mlh} onChange={setMlh} />
                  <p className="tabular-nums">{sobe24h === null ? '—' : <>Em 24 h: {br(mlh * 24, 0)} mL ≈ <strong>+{br(sobe24h)} mEq/L</strong>{naCorr !== null && <> (Na ≈ {br(naCorr + sobe24h)})</>}</>}</p>
                  {alerta24h && <p className="text-atencao">{alerta24h}</p>}
                  {alertaParar && <p className="text-atencao">{alertaParar}</p>}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Tabelas 4 e 5 — o que o manual traz</CardTitle>
          <CardDescription>Escolha o cenário. A decisão é de quem assiste o paciente.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-apoio">
          <div className="flex flex-wrap gap-2">
            {CENARIOS.map(([id, l]) => (
              <Button key={id} type="button" size="sm" variant={cenario === id ? 'default' : 'outline'} onClick={() => setCenario(id)} className="whitespace-normal text-left">{l.cenario}</Button>
            ))}
          </div>
          <ul className="list-disc pl-5">{linha.manual.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="text-tinta-sussurro">{linha.pagina}</p>
        </CardContent>
      </Card>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={naCorr === null}
        armadilhas={[`Sódio corrigido — errata do livro: ${ERRATA_SODIO_CORRIGIDO}`, `NaCl 3% — errata do livro: ${ERRATA_HIPONATREMIA}`, ...(guia?.armadilhas ?? [])]}
        ficha={fichaHiponatremia}
        guia={guia}
        comparacao={
          <BlocoComparacao titulo="Europeia 2014 e ERA 2024 — ao lado do manual" resumo="Diretriz europeia de 2014 (ESICM, ESE e ERA-EDTA; 1 = recomenda, 2 = sugere; A–D = qualidade) e revisão da ERA de 2024 (sem graduação), lidas no texto integral. As contas do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_HIPONATREMIA.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-tinta-sussurro">{DIFERENCAS_HIPONATREMIA.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={naCorr !== null ? `Na ${br(naCorr)} mEq/L · ${grav ? `hiponatremia ${grav}` : 'sem hiponatremia pelo corte do manual'}` : 'Informe o sódio'}
        detalhe={alertas[0] ?? textoDelta ?? texto24h ?? (naCorr !== null && peso > 0 ? `Bolus de ${LIMITES_HIPONATREMIA.bolusMl} mL de NaCl 3% ≈ +${br(sobeBolus)} mEq/L` : undefined)}
        tom={alertas.length > 0 ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
