import { useState } from 'react'

import {
  AFERESE_TABELA4, CCP, CH, CH_TABELA4, CRIO, CRIO_TABELA4, ERRATA_TRANSFUSAO, GATILHOS_HB, GATILHOS_PLAQUETAS, INCREMENTO_CH, PAGINA_GATILHOS_HB, PFC, PFC_TABELA4, PLAQUETAS,
  REGRA_HB_TEXTO, TRANSFUSAO_MACICA, TRAUMA_TRANSFUSAO, criterioMacica, doseCcp, doseCrio, dosePfc, dosePlaquetas, expectativaCh, fichaTransfusaoAdulto, gatilhosAbaixo,
  respostaPlaquetas, velocidadeCh,
} from '@/clinico/adulto/transfusao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { CampoPeso } from './PecasLoteC'

const mil = (x: number) => br(x, 0)

/** Transfusão de hemocomponentes no adulto (cap. 82 do manual do HCFMUSP). */
export function TransfusaoAdulto() {
  const [peso, setPeso] = useState(0)
  const [hb, setHb] = useState(0)
  const [ht, setHt] = useState(0)
  const [unidades, setUnidades] = useState(1)
  const [ch24, setCh24] = useState(0)
  const [ch1, setCh1] = useState(0)
  const [plqAntes, setPlqAntes] = useState(0)
  const [plqDepois, setPlqDepois] = useState(0)
  const [fib, setFib] = useState(0)
  const [unCrio, setUnCrio] = useState(0)
  const [inr, setInr] = useState(0)

  const abaixo = gatilhosAbaixo(hb)
  const exp = expectativaCh(hb, unidades, informado(ht))
  const vel = velocidadeCh(informado(peso))
  const mac = criterioMacica(informado(ch24), informado(ch1))
  const plq = dosePlaquetas(peso)
  const resp = plqAntes > 0 && plqDepois > 0 ? respostaPlaquetas(plqAntes, plqDepois) : null
  const pfc = dosePfc(peso)
  const crio = doseCrio(peso, fib > 0 ? fib : undefined, informado(unCrio))
  const ccp = inr > 0 ? doseCcp(peso, inr) : null

  return (
    <ToolLayout
      title="Transfusão de hemocomponentes — adulto"
      description="Gatilhos, incremento esperado, volume e velocidade de hemácias, plaquetas, plasma, crioprecipitado e complexo protrombínico, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaTransfusaoAdulto}
    >
      <CampoPeso id="tr-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Concentrado de hemácias — gatilhos" descricao={`${PAGINA_GATILHOS_HB}. A decisão envolve volemia, choque, duração e gravidade da anemia e parâmetros cardiopulmonares (p. 1075).`}>
        <NumberField id="tr-hb" label="Hb atual" unit="g/dL" value={hb} onChange={setHb} step={0.1} />
        <div className="flex flex-col gap-1">
          {GATILHOS_HB.map((g) => (
            <div key={g.id} className={`rounded-md border px-3 py-1.5 ${abaixo.includes(g.id) ? 'border-atencao' : ''}`}>
              <span className="font-medium">{g.condicao}</span>: {g.texto}
              {abaixo.includes(g.id) && <span className="ml-1 text-atencao">— Hb informada abaixo do número da tabela</span>}
            </div>
          ))}
        </div>
        {REGRA_HB_TEXTO.map((t) => <Trecho key={t.texto} texto={t.texto} pagina={t.pagina} />)}
      </Bloco>

      <Bloco titulo="Concentrado de hemácias — incremento, volume e velocidade" descricao={`Sem sangramento, cada unidade: Hb +${INCREMENTO_CH.hbGdl} g/dL e Ht +${INCREMENTO_CH.htPct}% (${INCREMENTO_CH.pagina}).`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-ht" label="Ht atual (opcional)" unit="%" value={ht} onChange={setHt} step={1} />
          <NumberField id="tr-un" label="Unidades" unit="CH" value={unidades} onChange={setUnidades} min={1} step={1} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Hb esperada" valor={exp ? `${br(exp.hb)} g/dL` : 'informe a Hb'} />
          <Resultado rotulo="Ht esperado" valor={exp?.ht != null ? `${br(exp.ht, 0)}%` : '—'} />
        </div>
        <Trecho texto={`Volume de ${faixaBr(CH.volumeMl, 0)} mL por CH; duração média de ${faixaBr(CH.duracaoH, 0)} h, não ultrapassar ${CH.duracaoMaxH} h`} pagina={CH.pagina} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo={`Primeiros ${CH.inicial.minutos} min (${faixaBr(CH.inicial.mlMin, 0)} mL/min)`} valor={`${faixaBr(vel.inicialMlH, 0)} mL/h`} />
          <Resultado rotulo={`Depois (${CH.depois.mlMin} mL/min)`} valor={`${br(vel.depoisMlH, 0)} mL/h`} />
          <Resultado rotulo="Alto risco de sobrecarga (1 mL/kg/h)" valor={vel.sobrecargaMlH ? `${br(vel.sobrecargaMlH, 0)} mL/h` : 'informe o peso'} />
        </div>
        <Trecho
          texto={`Tabela 4: ${faixaBr(CH_TABELA4.volumeMl, 0)} mL por unidade; os ${CH_TABELA4.lentoMin} minutos iniciais são lentos; ${faixaBr(CH_TABELA4.mlKgH, 0)} mL/kg/h${vel.tabela4MlH ? ` = ${faixaBr(vel.tabela4MlH, 0)} mL/h` : ''}`}
          pagina={CH_TABELA4.pagina}
          errata="Diverge do texto da p. 1076 (volume e velocidade); as duas versões ficam na tela."
        />
      </Bloco>

      <Bloco titulo="Transfusão maciça" descricao={`${TRANSFUSAO_MACICA.definicao} (${TRANSFUSAO_MACICA.pagina}). ABC score em ferramenta própria.`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-ch24" label="CH nas últimas 24 h" value={ch24} onChange={setCh24} step={1} />
          <NumberField id="tr-ch1" label="CH na última 1 h" value={ch1} onChange={setCh1} step={1} />
        </div>
        {(ch24 > 0 || ch1 > 0) && (
          <p>
            {mac.por24h || mac.por1h
              ? `Cabe na definição do livro: ${[mac.por24h && '≈ 10 CH em 24 h', mac.por1h && '> 4 unidades em 1 h'].filter(Boolean).join(' e ')}.`
              : 'Abaixo dos números da definição do livro (≈ 10 CH em 24 h; > 4 em 1 h). A definição por volemia não é calculada.'}
          </p>
        )}
        <Trecho texto={`Proporção: ${TRANSFUSAO_MACICA.proporcao}`} pagina={TRANSFUSAO_MACICA.pagina} />
        <Trecho texto={TRANSFUSAO_MACICA.citrato} pagina={TRANSFUSAO_MACICA.pagina} />
        <p className="text-muted-foreground">O capítulo não traz dose de cálcio para a hipocalcemia por citrato.</p>
        {TRAUMA_TRANSFUSAO.map((t) => <Trecho key={t.texto} texto={t.texto} pagina={t.pagina} />)}
      </Bloco>

      <Bloco titulo="Plaquetas" descricao={`Tabela 3, p. 1078. ${PLAQUETAS.contraProfilatica} (p. 1078).`}>
        <div className="flex flex-col gap-1">
          {GATILHOS_PLAQUETAS.map((g) => (
            <div key={g.condicoes[0]} className="rounded-md border px-3 py-1.5">
              <span className="font-medium">{g.limiar ? `< ${mil(g.limiar)}/µL` : '—'}</span>: {g.condicoes.join('; ')}
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Randômicas (1 U/10 kg)" valor={plq ? `${br(plq.randomicas)} U` : 'informe o peso'} />
          <Resultado rotulo="Equivalente em aférese (6 randômicas ≈ 1)" valor={plq ? `${br(plq.afereseEquivalente)} U` : '—'} />
          <Resultado rotulo="Aférese 5 mL/kg (Tabela 4)" valor={plq ? `${br(plq.afereseMlKg, 0)} mL` : '—'} />
        </div>
        <Trecho texto={`1 aférese (ou 6 randômicas): ↑ ${mil(PLAQUETAS.incrementoAferese[0])}–${mil(PLAQUETAS.incrementoAferese[1])}/µL; aférese ${faixaBr(AFERESE_TABELA4.volumeMl, 0)} mL em ${faixaBr(AFERESE_TABELA4.minutos, 0)} min (Tabela 4, p. 1082)`} pagina="p. 1078" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo={`Primeiros 15 min (${faixaBr(PLAQUETAS.inicial.mlMin, 0)} mL/min)`} valor={`${faixaBr([PLAQUETAS.inicial.mlMin[0] * 60, PLAQUETAS.inicial.mlMin[1] * 60], 0)} mL/h`} />
          <Resultado rotulo="Depois" valor={`${PLAQUETAS.depoisMlH} mL/h`} />
          <Resultado rotulo="Alto risco de sobrecarga (1 mL/kg/h)" valor={plq ? `${br(plq.sobrecargaMlH, 0)} mL/h` : '—'} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-plq-a" label="Plaquetas antes" unit="/µL" value={plqAntes} onChange={setPlqAntes} step={1000} />
          <NumberField id="tr-plq-d" label="Plaquetas 30–60 min depois" unit="/µL" value={plqDepois} onChange={setPlqDepois} step={1000} />
          <Resultado rotulo="Incremento" valor={resp ? `${mil(resp.incremento)}/µL${resp.acimaDe10mil ? ' (> 10.000)' : ' (≤ 10.000)'}` : '—'} />
        </div>
        <Trecho texto={PLAQUETAS.respostaNormal} pagina="p. 1079" />
      </Bloco>

      <Bloco titulo="Plasma fresco congelado" descricao={`Alvo: ${PFC.alvo} (${PFC.pagina}).`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Dose 10–20 mL/kg" valor={pfc ? `${faixaBr(pfc.ml, 0)} mL` : 'informe o peso'} />
          <Resultado rotulo="Bolsas de 200–250 mL" valor={pfc ? `${faixaBr(pfc.bolsas)} bolsas (livro: 3–5)` : '—'} />
          <Resultado rotulo="Velocidade 2–5 mL/kg/h" valor={pfc ? `${faixaBr(pfc.mlH, 0)} mL/h` : '—'} />
          <Resultado rotulo="Hipervolemia/ICC 1 mL/kg/h" valor={pfc ? `${br(pfc.iccMlH, 0)} mL/h` : '—'} />
        </div>
        <Trecho
          texto={`Tabela 4: ${faixaBr(PFC_TABELA4.mlKg, 0)} mL/kg${pfc ? ` = ${faixaBr(pfc.tabela4Ml, 0)} mL` : ''}; ${faixaBr(PFC_TABELA4.mlKgH, 0)} mL/kg/h${pfc ? ` = ${faixaBr(pfc.tabela4MlH, 0)} mL/h` : ''}; ↑ maioria dos fatores em ≈ 20%`}
          pagina={PFC_TABELA4.pagina}
          errata="Diverge do texto da p. 1080 (10–20 mL/kg; 2–5 mL/kg/h)."
        />
        <Trecho texto={PFC.inrProcedimento} pagina="p. 1080" />
      </Bloco>

      <Bloco titulo="Crioprecipitado" descricao={`Sangramento maior com fibrinogênio < ${CRIO.gatilho} mg/dL; no trauma, considerar < ${faixaBr(CRIO.gatilhoTrauma, 0)} mg/dL. Alvo > ${CRIO.alvoAcimaDe} mg/dL (${CRIO.pagina}).`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-fib" label="Fibrinogênio atual" unit="mg/dL" value={fib} onChange={setFib} step={5} />
          <NumberField id="tr-uncrio" label="Unidades (vazio = peso ÷ 10)" value={unCrio} onChange={setUnCrio} step={1} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="1 U/10 kg" valor={crio ? `${br(crio.unidadesPeso)} U (livro: 5–10 U)` : 'informe o peso'} />
          <Resultado rotulo="Incremento esperado (7–10 mg/dL por U)" valor={crio ? `${faixaBr(crio.incremento, 0)} mg/dL` : '—'} />
          <Resultado rotulo="Fibrinogênio esperado" valor={crio?.fibrinogenioEsperado ? `${faixaBr(crio.fibrinogenioEsperado, 0)} mg/dL` : '—'} />
          <Resultado rotulo="Unidades para passar de 100 mg/dL" valor={crio?.unidadesParaAlvo ? `${faixaBr(crio.unidadesParaAlvo, 0)} U` : '—'} />
        </div>
        <Trecho
          texto={`Tabela 4: ${faixaBr(CRIO_TABELA4.unidades, 0)} unidades ↑ fibrinogênio em ${faixaBr(CRIO_TABELA4.incremento, 0)} mg/dL; ${faixaBr(CRIO_TABELA4.mlPorUnidade, 0)} mL por unidade; 30–60 min`}
          pagina={CRIO_TABELA4.pagina}
          errata="Pela conta por unidade (7–10 mg/dL), 5–10 unidades dão 35–100 mg/dL; a conta da tela usa o incremento por unidade."
        />
      </Bloco>

      <Bloco titulo="Complexo protrombínico" descricao={`${CCP.indicacao} (${CCP.pagina}). ${CCP.nota}`}>
        {CCP.fixas.map((f) => <Trecho key={f.id} texto={`${f.texto} — ${br(f.ui / CCP.uiMin, 0)} min a ${CCP.uiMin} UI/min`} pagina={CCP.pagina} />)}
        <NumberField id="tr-inr" label="INR" value={inr} onChange={setInr} step={0.1} />
        {ccp === null ? (
          <p className="text-muted-foreground">{peso > 0 ? 'Informe o INR.' : 'Informe o peso e o INR.'}</p>
        ) : ccp.length === 0 ? (
          <p>O livro não traz dose por peso para INR abaixo de 2.</p>
        ) : (
          ccp.map((d) => (
            <div key={d.faixa} className="rounded-md border px-3 py-2">
              <p className="font-medium">{d.faixa}</p>
              <p className="tabular-nums">
                {br(d.uiKg, 0)} UI/kg × {br(peso)} kg = {mil(d.uiCalculada)} UI{d.limitada ? ` → teto de ${mil(d.maxUi)} UI` : ''} · <strong>{mil(d.ui)} UI</strong> · ≥ {br(d.minutos, 0)} min a {CCP.uiMin} UI/min
              </p>
            </div>
          ))
        )}
        {ccp && ccp.length > 1 && <p className="text-atencao">INR exatamente na divisa de duas faixas do livro: as duas doses aparecem.</p>}
      </Bloco>

      <Bloco titulo="Errata e divergências do livro">
        <ul className="list-disc pl-5 text-muted-foreground">
          {ERRATA_TRANSFUSAO.map((e) => <li key={e}>{e}</li>)}
        </ul>
      </Bloco>
    </ToolLayout>
  )
}
