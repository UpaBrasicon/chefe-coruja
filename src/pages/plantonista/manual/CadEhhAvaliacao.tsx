import { useState } from 'react'

import {
  DIFERENCAS_2024, ERRATA_OSMOLARIDADE, TABELA_GRAVIDADE, anionGap, criteriosCad, criteriosCad2024, criteriosEhh, criteriosEhh2024, criteriosResolucao, fichaCadEhhAvaliacao,
  gravidadeCad2024, gravidadePorBicarbonato, gravidadePorPh, osmolalidadeEfetiva2024, osmolaridadeEfetiva, resolucaoCad2024, resolucaoEhh2024,
} from '@/clinico/adulto/glicemia'
import { ERRATA_SODIO_CORRIGIDO, sodioCorrigido } from '@/clinico/adulto/sodio'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { numero } from '@/lib/formato'

const br = (x: number | null | undefined, casas = 1) => (x === null || x === undefined ? '—' : numero(Math.round(x * 10 ** casas) / 10 ** casas))
const sn = (b: boolean | null) => (b === null ? 'não informado' : b ? 'sim' : 'não')

function Item({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-controle border px-3 py-2">
      <div className="text-rotulo text-tinta-sussurro">{rotulo}</div>
      <div className="text-corpo font-semibold tabular-nums">{valor}</div>
      {detalhe && <div className="text-rotulo text-tinta-sussurro">{detalhe}</div>}
    </div>
  )
}

function Errata({ children }: { children: string }) {
  return (
    <p className="text-rotulo text-tinta-sussurro">
      <Badge variant="outline" className="mr-1">errata</Badge>
      {children}
    </p>
  )
}

/**
 * CAD e EHH no adulto: critérios, gravidade e resolução pelo consenso ADA/EASD 2024
 * (Umpierrez et al., Diabetes Care 2024;47:1257–1275). Decisão do RT de 13/11/2026:
 * o consenso manda, para ninguém pegar o critério antigo por engano; o que o manual
 * do HCFMUSP (2022, cap. 64) trazia fica num bloco fechado, só para consulta.
 */
export function CadEhhAvaliacao() {
  const [glic, setGlic] = useState(0)
  const [na, setNa] = useState(0)
  const [cl, setCl] = useState(0)
  const [hco3, setHco3] = useState(0)
  const [ph, setPh] = useState(0)
  const [cetose, setCetose] = useState<boolean | null>(null)
  const [dmPrevio, setDmPrevio] = useState(false)
  const [bhb, setBhb] = useState(0)
  const [cetonaRes, setCetonaRes] = useState(0)
  const [diurese, setDiurese] = useState(0)

  const naCorr = sodioCorrigido(na, glic)
  const osm = naCorr === null ? null : osmolaridadeEfetiva(naCorr, glic)
  const ag = hco3 > 0 ? anionGap(na, cl, hco3) : null
  const cad = criteriosCad(glic, ph, cetose)
  const ehh = osm === null ? null : criteriosEhh(glic, osm, ph)
  const gPh = gravidadePorPh(ph)
  const gBic = hco3 > 0 ? gravidadePorBicarbonato(hco3) : null
  const res = ag === null ? null : criteriosResolucao(ph, ag, hco3)

  // consenso ADA/EASD 2024 (Na medido na osmolalidade efetiva; BHB opcional)
  const osm2024 = osmolalidadeEfetiva2024(na, glic)
  const bhbOpc = bhb > 0 ? bhb : undefined
  const cad2024 = criteriosCad2024({ glicemia: glic, dmPrevio, bhb: bhbOpc, cetonuria2mais: cetose, ph, hco3 })
  const ehh2024 = osm2024 === null ? null : criteriosEhh2024({ glicemia: glic, osmEfetiva: osm2024, bhb: bhbOpc, cetonuria2mais: cetose, ph, hco3 })
  const g2024 = gravidadeCad2024({ bhb: bhbOpc, ph: ph > 0 ? ph : undefined, hco3: hco3 > 0 ? hco3 : undefined })
  const resCad2024 = cetonaRes > 0 || (ph > 0 && hco3 > 0) ? resolucaoCad2024(ph, hco3, cetonaRes) : null
  const resEhh2024 = osm2024 !== null && diurese > 0 ? resolucaoEhh2024(osm2024, diurese, glic) : null

  return (
    <ToolLayout
      title="Cetoacidose e estado hiperosmolar — critérios e fórmulas"
      description="Critérios de CAD e EHH, gravidade e resolução pelo consenso ADA/EASD/JBDS 2024. Adulto (14 anos ou mais). O que o manual do HC (2022) trazia fica no fim, fechado, só para consulta."
      ficha={fichaCadEhhAvaliacao}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 md:grid-cols-3">
          <NumberField id="cad-glic" label="Glicemia" unit="mg/dL" value={glic} onChange={setGlic} />
          <NumberField id="cad-na" label="Sódio medido" unit="mEq/L" value={na} onChange={setNa} />
          <NumberField id="cad-cl" label="Cloro" unit="mEq/L" value={cl} onChange={setCl} />
          <NumberField id="cad-hco3" label="Bicarbonato" unit="mEq/L" value={hco3} onChange={setHco3} step={0.1} />
          <NumberField id="cad-ph" label="pH (venoso ou arterial)" value={ph} onChange={setPh} step={0.01} />
          <div className="flex flex-col gap-1.5">
            <Label>Cetonúria 2+ ou mais (se não tiver o β-hidroxibutirato)</Label>
            <div className="flex flex-wrap gap-2">
              {([[true, 'Positiva'], [false, 'Negativa'], [null, 'Não informada']] as const).map(([v, t]) => (
                <Button key={t} type="button" size="sm" variant={cetose === v ? 'default' : 'outline'} onClick={() => setCetose(v)}>{t}</Button>
              ))}
            </div>
          </div>
          <NumberField id="cad-bhb" label="β-hidroxibutirato (preferido)" unit="mmol/L" value={bhb} onChange={setBhb} step={0.1} />
          <label className="flex items-center gap-2 text-apoio"><input type="checkbox" className="size-4" checked={dmPrevio} onChange={(e) => setDmPrevio(e.target.checked)} /> Diabetes prévio</label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Critérios, gravidade e resolução — consenso ADA/EASD 2024</CardTitle>
          <CardDescription>Umpierrez et al., Diabetes Care 2024;47:1257–1275 (Fig. 2, p. 1262; Tabela 2, p. 1263; Fig. 4, p. 1264). CAD: glicose ≥ 200 OU diabetes prévio; BHB ≥ 3,0; pH &lt; 7,3 e/ou HCO₃ &lt; 18; o ânion-gap não entra. EHH: osmolalidade efetiva &gt; 300 pelo sódio MEDIDO, sem exigir alteração do sensório.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-apoio">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-controle border p-3">
              <div className="font-medium">CAD (Fig. 2A)</div>
              {cad2024 ? (
                <ul className="mt-1 text-tinta-sussurro">
                  <li>Glicose ≥ 200 mg/dL ou diabetes prévio: {sn(cad2024.hiperglicemiaOuDm)}</li>
                  <li>BHB ≥ 3,0 mmol/L ou cetonúria 2+: {sn(cad2024.cetose)}</li>
                  <li>pH &lt; 7,3 e/ou HCO₃ &lt; 18: {sn(cad2024.acidose)}</li>
                  <li className="mt-1 font-medium text-tinta">Critérios do consenso preenchidos: {sn(cad2024.preenche)}{cad2024.euglicemica && ' — CAD euglicêmica (glicose < 200): dextrose desde o início'}</li>
                </ul>
              ) : <p className="text-tinta-sussurro">Informe glicemia, pH e bicarbonato.</p>}
            </div>
            <div className="rounded-controle border p-3">
              <div className="font-medium">EHH (Fig. 2B) — os quatro juntos</div>
              {ehh2024 ? (
                <ul className="mt-1 text-tinta-sussurro">
                  <li>Glicose ≥ 600 mg/dL: {sn(ehh2024.glicemia)}</li>
                  <li>Osmolalidade efetiva &gt; 300 (2 × Na medido + glicose/18 = {br(osm2024)}) ou total &gt; 320: {sn(ehh2024.hiperosmolar)}</li>
                  <li>BHB &lt; 3,0 ou cetonúria &lt; 2+: {sn(ehh2024.semCetoseSignificativa)}</li>
                  <li>pH ≥ 7,3 e HCO₃ ≥ 15: {sn(ehh2024.semAcidose)}</li>
                  <li className="mt-1 font-medium text-tinta">Critérios do consenso preenchidos: {sn(ehh2024.preenche)}</li>
                </ul>
              ) : <p className="text-tinta-sussurro">Informe glicemia, sódio, pH e bicarbonato.</p>}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <Item rotulo="Gravidade pelo BHB (Tabela 2)" valor={g2024.porBhb ?? '—'} detalhe="3,0–6,0 leve/moderada; > 6,0 grave" />
            <Item rotulo="Pelo pH" valor={g2024.porPh ?? '—'} detalhe="> 7,25 a < 7,30 leve; 7,0–7,25 moderada; < 7,0 grave" />
            <Item rotulo="Pelo HCO₃" valor={g2024.porHco3 ?? '—'} detalhe="15–18 leve; 10 a < 15 moderada; < 10 grave" />
            <Item rotulo="Pior parâmetro" valor={g2024.pior ?? '—'} detalhe="o consenso não exige todas as variáveis" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField id="cad-cetona-res" label="Cetona atual (para a resolução)" unit="mmol/L" value={cetonaRes} onChange={setCetonaRes} step={0.1} />
            <NumberField id="cad-diurese" label="Diurese (para o EHH)" unit="mL/kg/h" value={diurese} onChange={setDiurese} step={0.1} />
          </div>
          <p>
            Resolução da CAD (Fig. 4): pH venoso &gt; 7,3 ou HCO₃ &gt; 18 <strong>e</strong> cetona &lt; 0,6 mmol/L —{' '}
            {resCad2024 ? <strong>{resCad2024.resolvida ? 'atinge' : 'não atinge'}</strong> : <span className="text-tinta-sussurro">informe pH, bicarbonato e cetona</span>}
          </p>
          <p>
            Resolução do EHH (Fig. 4): osmolalidade &lt; 300, diurese &gt; 0,5 mL/kg/h e glicose &lt; 250 —{' '}
            {resEhh2024 ? <strong>{resEhh2024.resolvido ? 'atinge' : 'não atinge'}</strong> : <span className="text-tinta-sussurro">informe sódio, glicemia e diurese</span>}
          </p>
        </CardContent>
      </Card>

      <details className="rounded-container border border-fio bg-superficie px-4 py-3 text-apoio">
        <summary className="cursor-pointer font-medium text-tinta">O que o manual do HC (2022) trazia — só para consulta, não é a conduta desta tela</summary>
        <div className="mt-3 flex flex-col gap-4">
      <p className="text-tinta-sussurro">Manual de Medicina de Emergência do HCFMUSP, 3ª ed., 2022, cap. 64. Onde ele difere do consenso 2024, vale o consenso (lista no fim).</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Fórmulas do manual</CardTitle>
          <CardDescription>Sódio corrigido e osmolaridade efetiva (p. 869; regra de 1,6 mEq/L nas p. 883/886/896); ânion-gap = Na − (HCO3 + Cl) (cap. 69, p. 935).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-apoio">
          <div className="grid gap-2 sm:grid-cols-3">
            <Item rotulo="Sódio corrigido" valor={`${br(naCorr)} mEq/L`} detalhe="Na + 1,6 × (glicemia − 100)/100" />
            <Item rotulo="Osmolaridade efetiva" valor={`${br(osm)} mOsm`} detalhe="2 × Na corrigido + glicemia/18" />
            <Item rotulo="Ânion-gap" valor={`${br(ag)} mEq/L`} detalhe="Na medido − (HCO3 + Cl)" />
          </div>
          <Errata>{ERRATA_SODIO_CORRIGIDO}</Errata>
          <Errata>{ERRATA_OSMOLARIDADE}</Errata>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Critérios diagnósticos do manual (p. 864)</CardTitle>
          <CardDescription>O manual traz: CAD = glicemia &gt; 250, pH &lt; 7,3 e cetonemia; EHH = glicemia &gt; 600, osmolaridade &gt; 320 e pH &gt; 7,3. Podem coexistir (CAD com hiperosmolaridade).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-apoio sm:grid-cols-2">
          <div className="rounded-controle border p-3">
            <div className="font-medium">CAD</div>
            {cad ? (
              <ul className="mt-1 text-tinta-sussurro">
                <li>Glicemia &gt; 250: {sn(cad.glicemia)}</li>
                <li>pH &lt; 7,3: {sn(cad.ph)}</li>
                <li>Cetose: {sn(cad.cetose)}</li>
                <li className="mt-1 font-medium text-tinta">Critérios do manual preenchidos: {sn(cad.preenche)}</li>
              </ul>
            ) : <p className="text-tinta-sussurro">Informe glicemia e pH.</p>}
          </div>
          <div className="rounded-controle border p-3">
            <div className="font-medium">EHH</div>
            {ehh ? (
              <ul className="mt-1 text-tinta-sussurro">
                <li>Glicemia &gt; 600: {sn(ehh.glicemia)}</li>
                <li>Osmolaridade efetiva &gt; 320: {sn(ehh.osmolaridade)}</li>
                <li>pH &gt; 7,3: {sn(ehh.ph)}</li>
                <li className="mt-1 font-medium text-tinta">Critérios do manual preenchidos: {sn(ehh.preenche)}</li>
              </ul>
            ) : <p className="text-tinta-sussurro">Informe glicemia, sódio e pH.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Gravidade da CAD no manual — Tabela 1 (p. 864–865)</CardTitle>
          <CardDescription>Cada parâmetro é mostrado separado; o manual não diz como combinar quando discordam. Leve: pH 7,25–7,30, HCO3 15–18; moderada: pH 7,00–7,24, HCO3 10–14,9; grave: pH &lt; 7,00, HCO3 &lt; 10.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-apoio sm:grid-cols-2">
          <Item rotulo="Pelo pH" valor={gPh ?? '—'} detalhe={gPh ? `AG ${TABELA_GRAVIDADE[gPh].anionGap}; consciência: ${TABELA_GRAVIDADE[gPh].consciencia}` : 'pH > 7,30 ou não informado'} />
          <Item rotulo="Pelo bicarbonato" valor={gBic ?? '—'} detalhe={gBic ? `AG ${TABELA_GRAVIDADE[gBic].anionGap}; consciência: ${TABELA_GRAVIDADE[gBic].consciencia}` : 'HCO3 > 18 ou não informado'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Critérios do manual para desligar a bomba (p. 871–873)</CardTitle>
          <CardDescription>O manual traz: pelo menos 2 de 3 — pH &gt; 7,3; ânion-gap ≤ 12; bicarbonato ≥ 15. Desligar ≥ 1 h após a primeira insulina regular SC (p. 874).</CardDescription>
        </CardHeader>
        <CardContent className="text-apoio">
          {res ? (
            <p>
              pH &gt; 7,3: {sn(res.ph)} · AG ≤ 12: {sn(res.anionGap)} · HCO3 ≥ 15: {sn(res.bicarbonato)} —{' '}
              <strong>{res.presentes} de 3</strong> {res.desligarBomba ? '(atinge o critério do manual)' : '(não atinge o critério do manual)'}
            </p>
          ) : <p className="text-tinta-sussurro">Informe pH, sódio, cloro e bicarbonato.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Manual do HC × consenso 2024 — todas as diferenças</CardTitle>
          <CardDescription>Onde diferem, esta tela segue o consenso.</CardDescription>
        </CardHeader>
        <CardContent className="text-apoio">
          <ul className="flex flex-col gap-1">
            {DIFERENCAS_2024.map((d) => <li key={d.tema}><strong>{d.tema}:</strong> manual — {d.manual}; consenso — {d.consenso}.</li>)}
          </ul>
        </CardContent>
      </Card>
        </div>
      </details>
    </ToolLayout>
  )
}
