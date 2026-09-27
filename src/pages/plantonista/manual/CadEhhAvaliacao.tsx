import { useState } from 'react'

import {
  ERRATA_OSMOLARIDADE, TABELA_GRAVIDADE, anionGap, criteriosCad, criteriosEhh, criteriosResolucao, fichaCadEhhAvaliacao, gravidadePorBicarbonato,
  gravidadePorPh, osmolaridadeEfetiva,
} from '@/clinico/adulto/glicemia'
import { ERRATA_SODIO_CORRIGIDO, sodioCorrigido } from '@/clinico/adulto/sodio'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const br = (x: number | null | undefined, casas = 1) => (x === null || x === undefined ? '—' : (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR'))
const sn = (b: boolean | null) => (b === null ? 'não informado' : b ? 'sim' : 'não')

function Item({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="text-base font-semibold tabular-nums">{valor}</div>
      {detalhe && <div className="text-xs text-muted-foreground">{detalhe}</div>}
    </div>
  )
}

function Errata({ children }: { children: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      <Badge variant="outline" className="mr-1">errata</Badge>
      {children}
    </p>
  )
}

/** CAD e EHH: critérios, gravidade e fórmulas — cap. 64 do manual do HCFMUSP. */
export function CadEhhAvaliacao() {
  const [glic, setGlic] = useState(0)
  const [na, setNa] = useState(0)
  const [cl, setCl] = useState(0)
  const [hco3, setHco3] = useState(0)
  const [ph, setPh] = useState(0)
  const [cetose, setCetose] = useState<boolean | null>(null)

  const naCorr = sodioCorrigido(na, glic)
  const osm = naCorr === null ? null : osmolaridadeEfetiva(naCorr, glic)
  const ag = hco3 > 0 ? anionGap(na, cl, hco3) : null
  const cad = criteriosCad(glic, ph, cetose)
  const ehh = osm === null ? null : criteriosEhh(glic, osm, ph)
  const gPh = gravidadePorPh(ph)
  const gBic = hco3 > 0 ? gravidadePorBicarbonato(hco3) : null
  const res = ag === null ? null : criteriosResolucao(ph, ag, hco3)

  return (
    <ToolLayout
      title="Cetoacidose e estado hiperosmolar — critérios e fórmulas"
      description="Sódio corrigido, osmolaridade efetiva, ânion-gap, critérios de CAD/EHH, gravidade (Tabela 1) e critérios para desligar a bomba, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaCadEhhAvaliacao}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 md:grid-cols-3">
          <NumberField id="cad-glic" label="Glicemia" unit="mg/dL" value={glic} onChange={setGlic} />
          <NumberField id="cad-na" label="Sódio medido" unit="mEq/L" value={na} onChange={setNa} />
          <NumberField id="cad-cl" label="Cloro" unit="mEq/L" value={cl} onChange={setCl} />
          <NumberField id="cad-hco3" label="Bicarbonato" unit="mEq/L" value={hco3} onChange={setHco3} step={0.1} />
          <NumberField id="cad-ph" label="pH arterial" value={ph} onChange={setPh} step={0.01} />
          <div className="flex flex-col gap-1.5">
            <Label>Cetonemia (ou cetonúria fortemente positiva)</Label>
            <div className="flex flex-wrap gap-2">
              {([[true, 'Positiva'], [false, 'Negativa'], [null, 'Não informada']] as const).map(([v, t]) => (
                <Button key={t} type="button" size="sm" variant={cetose === v ? 'default' : 'outline'} onClick={() => setCetose(v)}>{t}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fórmulas</CardTitle>
          <CardDescription>Sódio corrigido e osmolaridade efetiva (p. 869; regra de 1,6 mEq/L nas p. 883/886/896); ânion-gap = Na − (HCO3 + Cl) (cap. 69, p. 935).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
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
          <CardTitle className="text-base">Critérios diagnósticos (p. 864)</CardTitle>
          <CardDescription>O manual traz: CAD = glicemia &gt; 250, pH &lt; 7,3 e cetonemia; EHH = glicemia &gt; 600, osmolaridade &gt; 320 e pH &gt; 7,3. Podem coexistir (CAD com hiperosmolaridade).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="font-medium">CAD</div>
            {cad ? (
              <ul className="mt-1 text-muted-foreground">
                <li>Glicemia &gt; 250: {sn(cad.glicemia)}</li>
                <li>pH &lt; 7,3: {sn(cad.ph)}</li>
                <li>Cetose: {sn(cad.cetose)}</li>
                <li className="mt-1 font-medium text-foreground">Critérios do manual preenchidos: {sn(cad.preenche)}</li>
              </ul>
            ) : <p className="text-muted-foreground">Informe glicemia e pH.</p>}
          </div>
          <div className="rounded-lg border p-3">
            <div className="font-medium">EHH</div>
            {ehh ? (
              <ul className="mt-1 text-muted-foreground">
                <li>Glicemia &gt; 600: {sn(ehh.glicemia)}</li>
                <li>Osmolaridade efetiva &gt; 320: {sn(ehh.osmolaridade)}</li>
                <li>pH &gt; 7,3: {sn(ehh.ph)}</li>
                <li className="mt-1 font-medium text-foreground">Critérios do manual preenchidos: {sn(ehh.preenche)}</li>
              </ul>
            ) : <p className="text-muted-foreground">Informe glicemia, sódio e pH.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gravidade da CAD — Tabela 1 (p. 864–865)</CardTitle>
          <CardDescription>Cada parâmetro é mostrado separado; o manual não diz como combinar quando discordam. Leve: pH 7,25–7,30, HCO3 15–18; moderada: pH 7,00–7,24, HCO3 10–14,9; grave: pH &lt; 7,00, HCO3 &lt; 10.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <Item rotulo="Pelo pH" valor={gPh ?? '—'} detalhe={gPh ? `AG ${TABELA_GRAVIDADE[gPh].anionGap}; consciência: ${TABELA_GRAVIDADE[gPh].consciencia}` : 'pH > 7,30 ou não informado'} />
          <Item rotulo="Pelo bicarbonato" valor={gBic ?? '—'} detalhe={gBic ? `AG ${TABELA_GRAVIDADE[gBic].anionGap}; consciência: ${TABELA_GRAVIDADE[gBic].consciencia}` : 'HCO3 > 18 ou não informado'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Critérios para desligar a bomba (p. 871–873)</CardTitle>
          <CardDescription>O manual traz: pelo menos 2 de 3 — pH &gt; 7,3; ânion-gap ≤ 12; bicarbonato ≥ 15. Desligar ≥ 1 h após a primeira insulina regular SC (p. 874).</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {res ? (
            <p>
              pH &gt; 7,3: {sn(res.ph)} · AG ≤ 12: {sn(res.anionGap)} · HCO3 ≥ 15: {sn(res.bicarbonato)} —{' '}
              <strong>{res.presentes} de 3</strong> {res.desligarBomba ? '(atinge o critério do manual)' : '(não atinge o critério do manual)'}
            </p>
          ) : <p className="text-muted-foreground">Informe pH, sódio, cloro e bicarbonato.</p>}
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
