import { useState, type ReactNode } from 'react'

import {
  DIFERENCAS_2024, DIVERGENCIAS_CAD, INSULINA_BOMBA, POTASSIO_MANUAL, TRATAMENTO_2024, ajusteInsulina, bicarbonato, bicarbonato2024, duasBolsas, faixaPotassio,
  fichaCadEhhTratamento, fluido2024, hidratacao, insulina2024, insulinaInicial, insulinaReduzida, mlHDeInsulina, potassio2024, solucaoSegundaFase, transicaoSc, type EsquemaInsulina,
} from '@/clinico/adulto/glicemia'
import { sodioCorrigido } from '@/clinico/adulto/sodio'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const br = (x: number | null | undefined, casas = 1) => (x === null || x === undefined ? '—' : (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR'))
const faixa = (f: [number, number] | undefined, casas = 0) => (f ? `${br(f[0], casas)}–${br(f[1], casas)}` : '—')

function Secao({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">{children}</CardContent>
    </Card>
  )
}

const ACAO = { dobrar: 'queda < 50 mg/dL/h → o manual traz dobrar a taxa', metade: 'queda > 70 mg/dL/h → o manual traz reduzir a taxa pela metade', manter: 'queda dentro de 50–70 mg/dL/h (esperada pelo manual)' }

/** CAD e EHH: hidratação, insulina EV, potássio, bicarbonato, 2 bolsas e transição SC — cap. 64 do manual do HCFMUSP. */
export function CadEhhTratamento() {
  const [peso, setPeso] = useState(0)
  const [na, setNa] = useState(0)
  const [glic, setGlic] = useState(0)
  const [k, setK] = useState(0)
  const [ph, setPh] = useState(0)
  const [esquema, setEsquema] = useState<EsquemaInsulina>('com-bolus')
  const [glicAnt, setGlicAnt] = useState(0)
  const [glicAtual, setGlicAtual] = useState(0)
  const [taxa, setTaxa] = useState(0)
  const [total, setTotal] = useState(500)
  const [dextrose, setDextrose] = useState(0)
  const [ins24, setIns24] = useState(0)

  const h = hidratacao(peso)
  const naRef = glic > 0 ? sodioCorrigido(na, glic) : na > 0 ? na : null
  const sol = naRef === null ? null : solucaoSegundaFase(naRef)
  const ins = insulinaInicial(peso, esquema)
  const red = insulinaReduzida(peso)
  const aj = ajusteInsulina(glicAnt, glicAtual, taxa)
  const fk = faixaPotassio(k)
  const bic = bicarbonato(ph)
  const bolsas = duasBolsas(total, dextrose)
  const sc = transicaoSc(ins24, peso)
  const i24 = insulina2024(peso)
  const k24 = potassio2024(k)
  const bic24 = bicarbonato2024(ph)
  const f24 = fluido2024()
  const T = TRATAMENTO_2024

  return (
    <ToolLayout
      title="Cetoacidose e estado hiperosmolar — tratamento"
      description="Hidratação, insulina regular EV (bomba de 50 U/250 mL), ajuste pela queda horária, potássio, bicarbonato, sistema de 2 bolsas e transição para SC: manual do HCFMUSP e consenso ADA/EASD 2024, lado a lado. Adulto (14 anos ou mais)."
      ficha={fichaCadEhhTratamento}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 md:grid-cols-3">
          <NumberField id="cadt-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <NumberField id="cadt-glic" label="Glicemia" unit="mg/dL" value={glic} onChange={setGlic} />
          <NumberField id="cadt-na" label="Sódio medido" unit="mEq/L" value={na} onChange={setNa} />
          <NumberField id="cadt-k" label="Potássio" unit="mEq/L" value={k} onChange={setK} step={0.1} />
          <NumberField id="cadt-ph" label="pH arterial" value={ph} onChange={setPh} step={0.01} />
        </CardContent>
      </Card>

      <Secao titulo="Hidratação (p. 869–870)" descricao="O manual traz NaCl 0,9% 1.000–1.500 mL na 1ª hora (15–20 mL/kg nas Figuras 2–3), repetível se hipotenso; depois 250–500 mL/h. Ringer-lactato é citado como possivelmente superior (p. 869).">
        <div className="grid gap-2 sm:grid-cols-2">
          <p>1ª hora: <strong>1.000–1.500 mL</strong> · por peso (15–20 mL/kg): <strong>{faixa(h?.primeiraHoraPorPesoMl)} mL</strong></p>
          <p>2ª fase: <strong>250–500 mL/h</strong> · por peso (4–14 mL/kg/h): <strong>{faixa(h?.segundaFasePorPesoMlH)} mL/h</strong></p>
        </div>
        <p>
          Sódio de referência {glic > 0 ? 'corrigido' : 'medido'}: {br(naRef)} mEq/L → o manual traz salina <strong>{sol ?? '—'}</strong> na 2ª fase (Na &lt; 135 → 0,9%; normal ou alto → 0,45%; as figuras usam o sódio corrigido).
        </p>
        <p className="text-muted-foreground">Ao chegar a glicemia de 250–300 mg/dL (texto, p. 870), associar glicose 5–10% mantendo 250–500 mL/h; opção do livro: 1 L de soro glicosado + 20 mL de NaCl 20%.</p>
      </Secao>

      <Secao titulo="Sistema de 2 bolsas — Tabela 5 (p. 870)" descricao="Bolsa 1: SF + KCl 40 mEq/L; bolsa 2: SG 10% + KCl 40 mEq/L (Figura 1). A glicose final é proporcional à vazão da bolsa 2.">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="cadt-total" label="Vazão total" unit="mL/h" value={total} onChange={setTotal} />
          <NumberField id="cadt-dext" label="Glicose final desejada (0–10)" unit="%" value={dextrose} onChange={setDextrose} step={2.5} max={10} />
        </div>
        <p className="tabular-nums">{bolsas ? <>Bolsa 1 (SF): <strong>{br(bolsas.bolsa1)} mL/h</strong> · Bolsa 2 (SG 10%): <strong>{br(bolsas.bolsa2)} mL/h</strong></> : 'Glicose final entre 0 e 10%.'}</p>
      </Secao>

      <Secao titulo="Insulina regular EV (p. 871)" descricao={`O manual traz bolus de 0,1 U/kg e bomba a 0,1 U/kg/h, ou 0,14 U/kg/h sem bolus. Preparo: ${INSULINA_BOMBA.unidades} U em ${INSULINA_BOMBA.volumeMl} mL de SF (0,2 U/mL; 5 mL = 1 U). Iniciar junto com a hidratação, exceto se K < 3,3.`}>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={esquema === 'com-bolus' ? 'default' : 'outline'} onClick={() => setEsquema('com-bolus')}>Com bolus (0,1 U/kg/h)</Button>
          <Button type="button" size="sm" variant={esquema === 'sem-bolus' ? 'default' : 'outline'} onClick={() => setEsquema('sem-bolus')}>Sem bolus (0,14 U/kg/h)</Button>
        </div>
        {ins ? (
          <p className="tabular-nums">
            {ins.bolusU > 0 && <>Bolus: <strong>{br(ins.bolusU)} U</strong> · </>}
            Bomba: <strong>{br(ins.uH)} U/h = {br(ins.mlH)} mL/h</strong>
            {red && <> · dose reduzida das Figuras 2–3 (0,05 U/kg/h): {br(red.uH)} U/h = {br(red.mlH)} mL/h</>}
          </p>
        ) : <p className="text-muted-foreground">Informe o peso.</p>}
        {fk === 'baixo' && <p className="text-atencao">K &lt; 3,3 mEq/L: o manual traz repor potássio antes de iniciar a insulina.</p>}
      </Secao>

      <Secao titulo="Ajuste pela glicemia capilar horária (p. 871)" descricao="Queda esperada de 50–70 mg/dL/h. O manual traz dobrar a taxa se cair menos de 50 e reduzir pela metade se cair mais de 70.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="cadt-ga" label="Glicemia 1 h atrás" unit="mg/dL" value={glicAnt} onChange={setGlicAnt} />
          <NumberField id="cadt-gb" label="Glicemia agora" unit="mg/dL" value={glicAtual} onChange={setGlicAtual} />
          <NumberField id="cadt-tx" label="Taxa atual" unit="U/h" value={taxa} onChange={setTaxa} step={0.1} />
        </div>
        {aj ? (
          <p className="tabular-nums">
            Queda: {br(aj.queda, 0)} mg/dL/h — {ACAO[aj.acao]} → <strong>{br(aj.novaUH)} U/h = {br(mlHDeInsulina(aj.novaUH))} mL/h</strong>
          </p>
        ) : <p className="text-muted-foreground">Informe as duas glicemias e a taxa atual.</p>}
      </Secao>

      <Secao titulo="Potássio (p. 871, 874)" descricao="Faixas do manual: < 3,3 / 3,3–5,0 / > 5 mEq/L. Dosar K a cada 2 h no início (p. 869).">
        {fk ? (
          <ul className="list-disc pl-5">{POTASSIO_MANUAL[fk].map((t) => <li key={t}>{t}</li>)}</ul>
        ) : <p className="text-muted-foreground">Informe o potássio.</p>}
      </Secao>

      <Secao titulo="Bicarbonato (p. 874; cap. 69, p. 938)" descricao="O manual traz bicarbonato só com pH < 6,9: 100 mEq EV em 2 h, gasometria após 1–2 h; preparo de 100 mL de NaHCO3 8,4% em 400 mL de água destilada.">
        {bic ? (
          bic.indicado ? <p>pH {br(ph, 2)} &lt; 6,9: <strong>100 mEq em 2 h</strong> — 500 mL de preparo = <strong>{br(bic.mlH, 0)} mL/h</strong></p> : <p>pH {br(ph, 2)} ≥ 6,9: fora da indicação do manual.</p>
        ) : <p className="text-muted-foreground">Informe o pH.</p>}
        <p className="text-muted-foreground">Fosfato (p. 874): só com disfunção cardíaca grave/arritmias, fraqueza muscular/insuficiência respiratória, rabdomiólise/anemia significativa ou fósforo &lt; 1,0 mEq/L — 25 mEq de fosfato de potássio no lugar do KCl.</p>
      </Secao>

      <Secao titulo="Transição para insulina SC (p. 874)" descricao="O manual traz 2/3 da insulina das últimas 24 h, ou 0,6 U/kg de NPH; desligar a bomba ao menos 1 h após a primeira insulina regular SC.">
        <NumberField id="cadt-24h" label="Insulina EV nas últimas 24 h" unit="U" value={ins24} onChange={setIns24} step={0.1} />
        <p className="tabular-nums">2/3 da dose de 24 h: <strong>{br(sc.doisTercos)} U</strong> · NPH 0,6 U/kg: <strong>{br(sc.nphPorPeso)} U</strong></p>
      </Secao>

      <Secao titulo="Consenso ADA/EASD 2024 — o que muda em relação ao manual" descricao="Umpierrez et al., Diabetes Care 2024;47:1257–1275. As contas abaixo usam o peso e a bomba do manual (0,2 U/mL). A conduta é do médico.">
        <p><strong>Fluido</strong> ({T.fluido.pagina}): {T.fluido.texto} → <span className="tabular-nums">{faixa(f24.mlH)} mL/h; {faixa(f24.totalEm2a4h)} mL em 2–4 h</span>. {T.fluido.fragil}.</p>
        <p><strong>Glicose</strong> ({T.glicose.pagina}): {T.glicose.texto}.</p>
        <p>
          <strong>Insulina</strong> ({T.insulina.pagina}): {T.insulina.texto}.
          {i24 && <> Para o peso informado: <span className="tabular-nums">0,1 U/kg/h = <strong>{br(i24.uH)} U/h = {br(i24.mlH)} mL/h</strong>; bolus só se atraso: {br(i24.bolusSeAtrasoU)} U; 0,05 U/kg/h (glicose &lt; 250 ou EHH) = {br(i24.reduzidaUH)} U/h = {br(i24.reduzidaMlH)} mL/h</span>.</>}
        </p>
        <p>
          <strong>Potássio</strong> ({T.potassio.pagina}): {k24 ? <>{T.potassio.texto[k24]}.</> : <span className="text-muted-foreground">informe o potássio — faixas &lt; 3,5 / 3,5–5,0 / &gt; 5,0 mmol/L.</span>}
          {k24 === 'baixo' && <span className="text-atencao"> Insulina só depois de K &gt; 3,5 (o manual usa 3,3).</span>}
        </p>
        <p>
          <strong>Bicarbonato</strong> ({T.bicarbonato.pagina}): {T.bicarbonato.texto}.
          {bic24 !== null && <> pH {br(ph, 2)}: <strong>{bic24 ? 'dentro da indicação do consenso (< 7,0)' : 'fora da indicação do consenso (≥ 7,0)'}</strong>{bic24 && !bic?.indicado && <span className="text-atencao"> — pelo manual (&lt; 6,9) não estaria.</span>}</>}
        </p>
        <p><strong>Fosfato</strong> ({T.fosfato.pagina}): {T.fosfato.texto}. <strong>Monitorização</strong> ({T.monitorizacao.pagina}): {T.monitorizacao.texto}.</p>
        <p><strong>EHH</strong> ({T.ehh.pagina}): {T.ehh.texto}.</p>
        <p><strong>Transição</strong> ({T.transicao.pagina}): {T.transicao.texto}{peso > 0 && <> → basal <span className="tabular-nums">{faixa([T.transicao.basalUKg[0] * peso, T.transicao.basalUKg[1] * peso], 1)} U</span></>}.</p>
        <details className="text-muted-foreground">
          <summary className="cursor-pointer text-foreground">Manual do HC × consenso 2024 — todas as diferenças</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {DIFERENCAS_2024.map((d) => <li key={d.tema}><strong>{d.tema}:</strong> manual — {d.manual}; consenso — {d.consenso}.</li>)}
          </ul>
        </details>
      </Secao>

      <Secao titulo="Texto × fluxogramas do capítulo" descricao="A ferramenta segue o texto; estas são as divergências encontradas no próprio livro (errata).">
        <ul className="flex flex-col gap-1">
          {DIVERGENCIAS_CAD.map((d) => (
            <li key={d.tema}><strong>{d.tema}:</strong> texto — {d.texto}; figura — {d.figura}.</li>
          ))}
        </ul>
        <p className="text-muted-foreground">UTI (p. 876): desconforto respiratório agudo, pH &lt; 6,9, choque cardiogênico, edema cerebral.</p>
      </Secao>
    </ToolLayout>
  )
}
