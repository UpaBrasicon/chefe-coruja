import { useState } from 'react'

import {
  CONDUTA_FIGURA1, DIFERENCAS_PCDT_FALCIFORME, DOSES_CRISE_ALGICA, INTERNACAO_FEBRE, PCDT_FALCIFORME, REFERENCIAS_FALCIFORME, antibioticoFebre, benzatinaProfilaxia, cetaminaMgH,
  fichaFalciformePed, hidroxiureiaMgDia, intensidadeDor, paracetamolTetoDiaMg, penicilinaVProfilaxia, quedaHb, sequestroPcdt,
} from '@/clinico/pediatria/falciformePed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Nota, Pendencia } from './PecasIcr'
import { LinhaReferencia } from './PecasP2'
import { LinhaDoseLivro } from './PecasP4'

/** Doença falciforme — crise álgica e complicações agudas (cap. 63 do livro do ICr). */
export function FalciformePed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [dor, setDor] = useState(0)
  const [hb, setHb] = useState({ basal: 0, atual: 0 })
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const intensidade = intensidadeDor(dor)
  const cet = calc ? cetaminaMgH(p.peso) : null
  const teto = calc ? paracetamolTetoDiaMg(p.peso) : null
  const q = quedaHb(hb.basal, hb.atual)
  const hu = calc ? hidroxiureiaMgDia(p.peso) : null
  const benz = calc ? benzatinaProfilaxia(p.peso) : null
  const penV = calc ? penicilinaVProfilaxia(p.anos * 12 + p.meses, p.peso) : null
  const atb = calc ? antibioticoFebre(p.peso) : null
  const seq = calc ? sequestroPcdt(p.peso) : null

  return (
    <ToolLayout
      title="Doença falciforme — crise álgica e complicações agudas"
      description="Crise álgica pela intensidade da dor (Figura 1), morfina e analgésicos por peso, febre, sequestro esplênico, AVC e síndrome torácica aguda — livro do ICr-HCFMUSP."
      ficha={fichaFalciformePed}
    >
      <CampoPaciente id="falc" p={p} onChange={setP} />

      <Bloco titulo="Crise álgica (Figura 1, p. 668)" descricao="Avaliar e medicar em até 1 h da chegada; escala de dor adequada à idade.">
        <NumberField id="falc-dor" label="Nota da dor (1 a 10)" value={dor} onChange={setDor} min={0} max={10} />
        {intensidade && (
          <p>
            Dor <strong>{intensidade}</strong> ({intensidade === 'leve' ? '1–3' : intensidade === 'moderada' ? '4–6' : '7–10'}) — a Figura 1 traz: {CONDUTA_FIGURA1[intensidade]}
          </p>
        )}
        <Nota>O livro não faz recomendação a favor ou contra fluidos (bolus ou manutenção) na crise álgica (p. 669).</Nota>
      </Bloco>

      <Pendencia p={p} />
      {calc && (
        <Bloco titulo="Analgesia pelo peso">
          {DOSES_CRISE_ALGICA.map((d) => (
            <LinhaDoseLivro key={d.id} d={d} peso={p.peso} extra={d.id === 'paracetamol' && teto ? <p className="text-tinta-sussurro">Teto do dia (menor entre 75 mg/kg e 4 g): {br(teto, 0)} mg.</p> : undefined} />
          ))}
          {cet && (
            <LinhaLivro nome="Cetamina subanestésica (refratários, internados)" conta={<strong>{faixaBr(cet, 1)} mg/h</strong>} texto="iniciar 0,1 a 0,3 mg/kg/hora, em centros com experiência" pagina="p. 668" />
          )}
        </Bloco>
      )}

      <Bloco titulo="Febre ≥ 38,5 °C — internação (p. 667)">
        <ul className="list-disc pl-5 text-tinta-sussurro">
          {INTERNACAO_FEBRE.map((i) => <li key={i}>{i}</li>)}
        </ul>
      </Bloco>

      <Bloco titulo="Sequestro esplênico (p. 670)">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="falc-hbb" label="Hb basal (ambulatorial)" unit="g/dL" value={hb.basal} onChange={(x) => setHb({ ...hb, basal: x })} min={0} step={0.1} />
          <NumberField id="falc-hba" label="Hb atual" unit="g/dL" value={hb.atual} onChange={(x) => setHb({ ...hb, atual: x })} min={0} step={0.1} />
        </div>
        {q && (
          <p>
            Queda de <strong className="tabular-nums">{br(q.queda, 1)} g/dL</strong> — {q.criterio ? 'atinge' : 'não atinge'} os 2 g/dL que o livro usa na definição (com aumento abrupto do baço).
          </p>
        )}
      </Bloco>

      <Bloco titulo="Complicações agudas">
        {REFERENCIAS_FALCIFORME.map((r) => <LinhaReferencia key={r.rotulo} rotulo={r.rotulo} texto={r.texto} pagina={`cap. 63, ${r.pagina}`} />)}
        <Nota>Volumes de concentrado de hemácias: ferramenta de hemocomponentes (cap. 67).</Nota>
      </Bloco>

      <Bloco titulo="PCDT da Doença Falciforme — Ministério da Saúde, 2024" descricao="Portaria Conjunta SAES/SECTICS nº 16, de 1/11/2024 (substitui a de 2018). Páginas do PDF. Decisão do RT em 28/09/2026: fonte ao lado do livro.">
        {calc && seq && (
          <LinhaLivro nome="Sequestro esplênico" conta={<>expansor <strong>{faixaBr(seq.expansorMl, 0)} mL</strong> · SF {faixaBr(seq.sfMl, 0)} mL em 2 h · CH <strong>{br(seq.chMl, 0)} mL</strong></>} texto={PCDT_FALCIFORME.sequestro.texto} pagina={PCDT_FALCIFORME.sequestro.pagina} />
        )}
        <LinhaReferencia rotulo="Síndrome torácica aguda" texto={PCDT_FALCIFORME.sta.texto} pagina={PCDT_FALCIFORME.sta.pagina} />
        {calc && atb && (
          <LinhaLivro nome="Antibiótico na febre" conta={<>penicilina cristalina <strong>{faixaBr(atb.penicilinaUDia, 0)} U/dia</strong> (6/6 h) · ceftriaxona <strong>{faixaBr(atb.ceftriaxonaMgDia, 0)} mg/dia</strong> (12/12 h){atb.ceftriaxonaNoTeto && ', no teto de 4 g'}</>} texto={PCDT_FALCIFORME.febre.texto} pagina={PCDT_FALCIFORME.febre.pagina} nota={PCDT_FALCIFORME.febre.alerta} />
        )}
        <LinhaReferencia rotulo="Transfusão simples — indicações" texto={`${PCDT_FALCIFORME.transfusaoSimples.indicacoes.join('; ')}. ${PCDT_FALCIFORME.transfusaoSimples.formula}.`} pagina={PCDT_FALCIFORME.transfusaoSimples.pagina} />
        {calc && hu && (
          <LinhaLivro nome="Hidroxiureia (ambulatório, para conferência)" conta={<>inicial <strong>{br(hu.inicial, 0)} mg/dia</strong> · +{br(hu.incremento, 0)} mg/dia a cada {PCDT_FALCIFORME.hidroxiureia.aCadaSemanas} semanas · máximo {br(hu.maximo, 0)} mg/dia{hu.comprimido100 && ' · comprimido de 100 mg (≤ 25 kg)'}</>} texto={`${PCDT_FALCIFORME.hidroxiureia.criterios}. Exclusão: ${PCDT_FALCIFORME.hidroxiureia.exclusao}.`} pagina={PCDT_FALCIFORME.hidroxiureia.pagina} />
        )}
        {calc && penV && benz && (
          <LinhaLivro nome="Profilaxia com penicilina (3 meses a 5 anos)" conta={<>penicilina V <strong>{br(penV.mg, 0)} mg 12/12 h</strong> ({penV.criterio}) · ou benzatina <strong>{benz.ui.toLocaleString('pt-BR')} UI</strong> {PCDT_FALCIFORME.profilaxia.benzatinaIntervalo} ({benz.criterio})</>} texto={`Alergia à penicilina: ${PCDT_FALCIFORME.profilaxia.alergia}.`} pagina={PCDT_FALCIFORME.profilaxia.pagina} />
        )}
        <ul className="list-disc pl-5 text-tinta-sussurro">{DIFERENCAS_PCDT_FALCIFORME.map((d) => <li key={d}>{d}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
