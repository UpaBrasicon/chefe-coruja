import { useState } from 'react'

import {
  ERRATA_EHH_EXPANSAO, ERRATA_QUADRO11, INSULINA_EHH, INSULINA_EV, INSULINA_UI_ML, LIMITES_EHH, NORMAIS_QUADRO6, NOTA_K_CAD, NOTA_MG_EHH, NOTA_OSM_NORMAL, NOTA_SORO_CAD,
  PH_BICARBONATO_CAD, REPOSICAO_K_CAD, SORO_MANUTENCAO_CAD, anionGapCad, bicarbonatoCad, criteriosCad, criteriosEhh, doseInsulinaPeloLivro, edemaCerebral, expansaoChoqueCad,
  expansaoEhh, fichaCadPed, gravidadeCad, hidratacaoCad, insulinaEhhUiH, insulinaEv, insulinaScIcr, kMaxMeqH, kclOralMeqDia, magnesioEhh, nphIcr, osmEfetivaCad, pushGlicose25,
  sodioRealCad, todosAtendem, type Criterio, type MotivoDose,
} from '@/clinico/pediatria/cadPed'
import { manutencao } from '@/clinico/pediatria/manutencao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Button } from '@/components/ui/button'

import { PACIENTE_VAZIO, br, faixaBr, idadeAnos, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, LinhaLivro, Nota, Opcoes, Pendencia } from './PecasIcr'

function ListaCriterios({ titulo, cs }: { titulo: string; cs: Criterio[] }) {
  const todos = todosAtendem(cs)
  return (
    <div className="rounded-lg border px-3 py-2">
      <div className="font-medium">
        {titulo}: {todos === null ? 'dados incompletos' : todos ? 'critérios do livro presentes' : 'critérios do livro não preenchidos'}
      </div>
      <ul className="mt-1 text-muted-foreground">
        {cs.map((c) => (
          <li key={c.nome}>
            {c.atende === null ? '○' : c.atende ? '●' : '✕'} {c.nome}: {c.texto}
          </li>
        ))}
      </ul>
    </div>
  )
}

const MOTIVOS: [MotivoDose, string][] = [
  ['menor5', 'Menor de 5 anos'],
  ['glicemiaMenor250', 'Glicemia < 250 no início da insulina'],
  ['transferencia', 'Transferência entre hospitais'],
  ['grave', 'CAD grave'],
  ['adolescente', 'Adolescente'],
  ['cetosePersistente', 'Cetose persistente'],
]

/** Cetoacidose diabética e EHH na criança — cap. 52 do Pronto-Socorro ICr-HCFMUSP. */
export function CadEhhPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [g, setG] = useState({ glicemia: 0, ph: 0, bic: 0, na: 0, cl: 0, cetonemia: 0 })
  const [cetonuria, setCetonuria] = useState<'nd' | 'sim' | 'nao'>('nd')
  const [venoso, setVenoso] = useState(true)
  const [corte, setCorte] = useState<15 | 18>(15)
  const [motivos, setMotivos] = useState<MotivoDose[]>([])
  const [uiKgH, setUiKgH] = useState(0.1)

  const calc = podeCalcular(p)
  const naReal = g.na > 0 && g.glicemia > 0 ? sodioRealCad(g.na, g.glicemia) : null
  const osm = g.na > 0 && g.glicemia > 0 ? osmEfetivaCad(g.na, g.glicemia) : null
  const ag = g.na > 0 && g.cl > 0 && g.bic > 0 ? anionGapCad(g.na, g.cl, g.bic) : null
  const gaso = { glicemia: g.glicemia, ph: g.ph, bic: g.bic, cetonemia: g.cetonemia || undefined, cetonuria2mais: cetonuria === 'nd' ? undefined : cetonuria === 'sim', osm: osm ?? undefined, venoso }
  const grav = gravidadeCad(g.ph, g.bic, corte)
  const motivosAuto: MotivoDose[] = idadeAnos(p.anos, p.meses) < 5 && (p.anos > 0 || p.meses > 0) ? ['menor5'] : []
  const livro = doseInsulinaPeloLivro([...new Set([...motivosAuto, ...motivos])])
  const choque = calc ? expansaoChoqueCad(p.peso) : null
  const etapas = calc ? hidratacaoCad(p.peso) : null
  const ins = calc ? insulinaEv(p.peso, uiKgH) : null
  const sc = calc ? insulinaScIcr(p.peso) : null
  const bic = calc && g.bic > 0 ? bicarbonatoCad(p.peso, g.bic) : null
  const edema = calc ? edemaCerebral(p.peso) : null
  const ehh = calc ? expansaoEhh(p.peso) : null
  const man = calc ? manutencao(p.peso) : null
  const mgEhh = calc ? magnesioEhh(p.peso) : null

  return (
    <ToolLayout
      title="Cetoacidose diabética e EHH — criança"
      description="Critérios, gravidade, fórmulas do Quadro 6, fluidos, potássio, insulina, bicarbonato e edema cerebral por peso, como o livro do ICr-HCFMUSP traz. Pediatria: até antes dos 14 anos."
      ficha={fichaCadPed}
    >
      <CampoPaciente id="cad" p={p} onChange={setP} />

      <Bloco titulo="Critérios e gravidade (Quadros 2 e 3, p. 515–516)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="cad-glic" label="Glicemia" unit="mg/dL" value={g.glicemia} onChange={(v) => setG({ ...g, glicemia: v })} />
          <NumberField id="cad-ph" label="pH" value={g.ph} onChange={(v) => setG({ ...g, ph: v })} step={0.01} />
          <NumberField id="cad-bic" label="Bicarbonato" unit="mEq/L" value={g.bic} onChange={(v) => setG({ ...g, bic: v })} step={0.1} />
          <NumberField id="cad-na" label="Sódio" unit="mEq/L" value={g.na} onChange={(v) => setG({ ...g, na: v })} />
          <NumberField id="cad-cl" label="Cloro" unit="mEq/L" value={g.cl} onChange={(v) => setG({ ...g, cl: v })} />
          <NumberField id="cad-cet" label="Cetonemia (se houver)" unit="mmol/L" value={g.cetonemia} onChange={(v) => setG({ ...g, cetonemia: v })} step={0.1} />
          <Opcoes label="Cetonúria 2+ ou mais?" valor={cetonuria} opcoes={[['nd', 'Não informada'], ['sim', 'Sim'], ['nao', 'Não']]} onChange={setCetonuria} />
          <Opcoes label="Gasometria" valor={venoso} opcoes={[[true, 'Venosa'], [false, 'Arterial']]} onChange={setVenoso} />
          <Opcoes label="Corte do bicarbonato na CAD" valor={corte} opcoes={[[15, '< 15 (BSPED/NICE 2021)'], [18, '< 18 (ISPAD 2022)']]} onChange={setCorte} />
        </div>
        <ListaCriterios titulo="CAD" cs={criteriosCad(gaso, corte)} />
        <ListaCriterios titulo="EHH (ISPAD)" cs={criteriosEhh(gaso)} />
        {grav && (
          <p>
            Gravidade da CAD pelo Quadro 3: <strong>{grav}</strong>
          </p>
        )}
        <Nota>A diferença de pH entre venosa e arterial costuma ser de 0,02 a 0,15, mais alta na venosa (p. 516).</Nota>
      </Bloco>

      <Bloco titulo="Fórmulas do Quadro 6 (p. 517)">
        <p className="tabular-nums">
          Na real = Na + 2 × (glicemia − 100)/100: <strong>{naReal === null ? '—' : `${br(naReal)} mEq/L`}</strong>
        </p>
        <p className="tabular-nums">
          Osmolalidade efetiva = 2 × Na + glicose/18: <strong>{osm === null ? '—' : `${br(osm, 0)} mOsm/kg`}</strong> (normal {NORMAIS_QUADRO6.osm.join('–')})
        </p>
        <p className="tabular-nums">
          Ânion-gap = Na − (Cl + HCO3): <strong>{ag === null ? '—' : `${br(ag)} mEq/L`}</strong> (normal 12 ± 2)
        </p>
        <Nota>{NOTA_OSM_NORMAL}</Nota>
      </Bloco>

      <Pendencia p={p} />

      {calc && choque && etapas && (
        <Bloco titulo="CAD — fluidos (p. 518–520; Figura 3)" descricao="Fluido isotônico (SF 0,9% ou Ringer), antes da insulina.">
          <LinhaLivro
            nome="Com choque"
            texto={choque.texto}
            conta={<strong>{br(20 * p.peso, 0)} mL em {br(choque.minutos, 0)} min ({br(choque.mlH, 0)} mL/h)</strong>}
            pagina={choque.pagina}
            nota={choque.noTeto ? 'Com o teto de 1.000 mL/h a alíquota leva mais que 20 min.' : undefined}
          />
          {etapas.map((e) => (
            <LinhaLivro key={e.nome} nome={e.nome} texto={e.texto} conta={<strong>{br(e.mlH, 0)} mL/h{e.noTeto && ' (teto)'}</strong>} pagina={e.pagina} />
          ))}
          <LinhaLivro nome="Glicemia < 200 na expansão" texto="push de glicose 25% 1 a 2 mL/kg e seguir com fluido isotônico" conta={<strong>{faixaBr(pushGlicose25(p.peso), 0)} mL</strong>} pagina="p. 518" />
          <LinhaLivro
            nome="Soro de manutenção isotônico"
            texto={`SG 5% ${SORO_MANUTENCAO_CAD.sg5Ml} mL + NaCl 20% ${SORO_MANUTENCAO_CAD.nacl20Ml} mL + KCl 19,1% ${SORO_MANUTENCAO_CAD.kcl191Ml} mL no volume de Holliday-Segar; glicemia entre 200 e 250`}
            conta={man && <strong>{br(man.mlDia, 0)} mL/dia ({br(man.mlH)} mL/h)</strong>}
            pagina={SORO_MANUTENCAO_CAD.pagina}
            nota={NOTA_SORO_CAD}
          />
        </Bloco>
      )}

      {calc && (
        <Bloco titulo="CAD — potássio (p. 520–521; Quadro 8)">
          {REPOSICAO_K_CAD.map((l) => (
            <LinhaLivro
              key={l.quando}
              nome={l.quando}
              texto={l.texto}
              conta={l.maxMeqKgH !== null ? <strong>até {br(kMaxMeqH(p.peso, l.maxMeqKgH), 1)} mEq/h</strong> : undefined}
              pagina={l.pagina}
            />
          ))}
          <LinhaLivro nome="Após a estabilização" texto="KCl xarope 4 mEq/kg/dia por 48 a 72 h, com monitorização diária" conta={<strong>{br(kclOralMeqDia(p.peso), 0)} mEq/dia</strong>} pagina="p. 521" />
          <Nota>{NOTA_K_CAD}</Nota>
          <Nota>Fosfato: reposição indicada com fósforo &lt; 1 a 1,5 mg/dL ou anemia, disfunção cardíaca, fraqueza muscular, depressão respiratória (p. 520).</Nota>
        </Bloco>
      )}

      {calc && ins && sc && (
        <Bloco
          titulo="CAD — insulina (p. 521–522)"
          descricao={`Início na 2ª hora, após melhora da perfusão; sem bolus EV. Faixa ${INSULINA_EV.faixa.join(' a ')} UI/kg/h, queda de ${INSULINA_EV.quedaAlvo.join(' a ')} mg/dL/h, ajuste de ${INSULINA_EV.passo} UI/kg/h.`}
        >
          <div className="flex flex-wrap gap-2">
            {MOTIVOS.map(([m, t]) => (
              <Button key={m} type="button" size="sm" variant={motivos.includes(m) || motivosAuto.includes(m) ? 'default' : 'outline'} onClick={() => setMotivos(motivos.includes(m) ? motivos.filter((x) => x !== m) : [...motivos, m])}>
                {t}
              </Button>
            ))}
          </div>
          <p>{livro.texto}</p>
          <Opcoes label="Dose para o cálculo" valor={uiKgH} opcoes={[[0.05, '0,05 UI/kg/h'], [0.1, '0,1 UI/kg/h']]} onChange={setUiKgH} />
          <LinhaLivro
            nome="Insulina regular EV contínua"
            texto={`50 UI em 500 mL de NaCl 0,9% (1 mL = ${br(INSULINA_UI_ML)} UI), em veia diferente da hidratação; desprezar os primeiros 50 mL se frasco/equipo de PVC`}
            conta={<strong>{br(ins.uiH, 2)} UI/h = {br(ins.mlH, 1)} mL/h</strong>}
            pagina="p. 521"
          />
          <LinhaLivro
            nome="Esquema SC do ICr-HCFMUSP"
            texto="análogo de ação rápida 0,15 U/kg a cada 2 h desde a recuperação da perfusão; se queda > 100 mg/dL/h, 0,1 UI/kg a cada 2 h; se persistir, intervalo de 3 h"
            conta={<strong>{br(sc.inicial, 1)} U → {br(sc.reduzida, 1)} U</strong>}
            pagina="p. 521"
          />
          <LinhaLivro nome="Após a resolução" texto="NPH 0,3 UI/kg/dose a cada 8 h (ICr-HCFMUSP)" conta={<strong>{br(nphIcr(p.peso), 1)} UI/dose</strong>} pagina="p. 522" />
          <Nota>Resolução: pH &gt; 7,3 e/ou bic &gt; 15 (ou &gt; 18) ou cetonemia &lt; 1 mmol/L, em geral por volta de 12 h (p. 522).</Nota>
        </Bloco>
      )}

      {calc && bic && edema && (
        <Bloco titulo="CAD — bicarbonato e edema cerebral (p. 522–524)">
          <LinhaLivro
            nome="Bicarbonato"
            texto={`só em pH < ${PH_BICARBONATO_CAD} mesmo após a 1ª hora de expansão; 1 a 2 mEq/kg em 1 a 2 h, ou (15 − bic) × 0,3 × peso`}
            conta={<strong>{faixaBr(bic.porKg, 0)} mEq{bic.formula !== null && ` · fórmula ${br(bic.formula, 1)} mEq`}</strong>}
            pagina="p. 522"
          />
          <LinhaLivro nome="Manitol" texto="0,5 a 1 g/kg em 10 a 15 min; repetir se não houver resposta em 30 min a 1 h" conta={<strong>{faixaBr(edema.manitolG, 1)} g</strong>} pagina="Quadro 11, p. 524" />
          <LinhaLivro nome="NaCl 3%" texto="2,5 a 5 mL/kg em 10 a 15 min, alternativa ao manitol" conta={<strong>{faixaBr(edema.nacl3Ml, 0)} mL</strong>} pagina="Quadro 11, p. 524" />
          <Nota>O Quadro 11 traz ainda: reduzir os fluidos em um terço, cabeceira a 30°, PaCO2 27–30 mmHg se intubado, TC após as medidas iniciais.</Nota>
          <Errata texto={ERRATA_QUADRO11} />
        </Bloco>
      )}

      {calc && ehh && mgEhh && (
        <Bloco titulo="EHH (p. 522–523; Figura 4)" descricao={`Queda do Na até ${LIMITES_EHH.naPorHora.join(' a ')} mEq/L/h (limite ${LIMITES_EHH.na24h.join(' a ')} em 24 h); osmolalidade até ${LIMITES_EHH.osmPorHora} mOsm/kg/h.`}>
          <LinhaLivro nome="Expansão (texto)" texto="≥ 20 mL/kg de SF 0,9% ou isotônico durante 2 a 4 h; alíquotas até restaurar a perfusão" conta={<strong>{br(ehh.texto.mlH, 0)} mL/h{ehh.texto.noTeto && ' (teto)'}</strong>} pagina="p. 522" />
          <LinhaLivro nome="Com choque (Figura 4)" texto="50 mL/kg/h, máx. 1.000 mL/h, até estabilidade" conta={<strong>{br(ehh.choqueFigura4.mlH, 0)} mL/h{ehh.choqueFigura4.noTeto && ' (teto)'}</strong>} pagina="Figura 4, p. 525" />
          <Errata texto={ERRATA_EHH_EXPANSAO} />
          <LinhaLivro
            nome="Insulina EV"
            texto={`${INSULINA_EHH.faixa.join(' a ')} U/kg/h quando a queda da glicemia for ≤ ${INSULINA_EHH.iniciarQuedaAte} mg/dL/h apesar da hidratação; queda-alvo ${INSULINA_EHH.quedaAlvo.join(' a ')} mg/dL/h; sem bolus`}
            conta={<strong>{faixaBr(insulinaEhhUiH(p.peso), 2)} UI/h</strong>}
            pagina="p. 523"
          />
          <LinhaLivro nome="Potássio" texto={`${LIMITES_EHH.kMeqL} mEq/L no fluido quando o K estiver normal e a função renal restabelecida`} pagina="p. 523" />
          <LinhaLivro
            nome="Magnésio (hipomagnesemia grave < 1 mg/dL)"
            texto="25 a 50 mg/kg a cada 4 a 6 h; máx. 150 mg/min ou 2 g/h"
            conta={<strong>{faixaBr(mgEhh.mg, 0)} mg em ≥ {faixaBr(mgEhh.minutosMin, 0)} min</strong>}
            pagina="p. 523"
            nota={NOTA_MG_EHH}
          />
        </Bloco>
      )}
    </ToolLayout>
  )
}
