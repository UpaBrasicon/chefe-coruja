import { useState } from 'react'

import {
  CONDUTA_FIGURA1, DOSES_CRISE_ALGICA, INTERNACAO_FEBRE, REFERENCIAS_FALCIFORME, cetaminaMgH, fichaFalciformePed, intensidadeDor, paracetamolTetoDiaMg, quedaHb,
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
            <LinhaDoseLivro key={d.id} d={d} peso={p.peso} extra={d.id === 'paracetamol' && teto ? <p className="text-muted-foreground">Teto do dia (menor entre 75 mg/kg e 4 g): {br(teto, 0)} mg.</p> : undefined} />
          ))}
          {cet && (
            <LinhaLivro nome="Cetamina subanestésica (refratários, internados)" conta={<strong>{faixaBr(cet, 1)} mg/h</strong>} texto="iniciar 0,1 a 0,3 mg/kg/hora, em centros com experiência" pagina="p. 668" />
          )}
        </Bloco>
      )}

      <Bloco titulo="Febre ≥ 38,5 °C — internação (p. 667)">
        <ul className="list-disc pl-5 text-muted-foreground">
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
    </ToolLayout>
  )
}
