import { useState } from 'react'

import {
  DOSES_CRISE_HA, ERRATAS_CRISE_HA, HIDRALAZINA_IV, INFUSOES_CRISE_HA, REFERENCIAS_CRISE_HA, ROTULO_ESTAGIO, acimaDoP95, classificar13ouMais, classificarMenor13,
  fichaCriseHipertensivaPed, pamMinima8h,
} from '@/clinico/pediatria/criseHipertensivaPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, idadeAnos, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, LinhaLivro, Pendencia } from './PecasIcr'
import { LinhaBolusApendice, LinhaDoseLivro } from './PecasP4'

/** Crise hipertensiva na criança — cap. 26 do livro do ICr. */
export function CriseHipertensivaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [pas, setPas] = useState(0)
  const [pad, setPad] = useState(0)
  const [pc, setPc] = useState({ p90s: 0, p95s: 0, p90d: 0, p95d: 0 })
  const [pam, setPam] = useState(0)
  const idade = idadeAnos(p.anos, p.meses)
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const faixa = idade < 1 || p.rn ? 'lactente' : idade < 13 ? 'crianca' : 'adolescente'
  const estagio = !pediatrico ? null : faixa === 'crianca' ? classificarMenor13(pas, pad, pc) : faixa === 'adolescente' ? classificar13ouMais(pas, pad) : null
  const acima = faixa === 'crianca' ? acimaDoP95(pas, pc.p95s) : null
  const pamMin = pamMinima8h(pam)
  const calc = !p.rn && p.peso > 0 && pediatrico
  const idadeMeses = p.anos * 12 + p.meses

  return (
    <ToolLayout
      title="Crise hipertensiva — criança"
      description="Classificação da PA (Tabela 1), meta de redução da PAM e drogas por peso (Tabela 3) — livro do ICr-HCFMUSP. O livro não traz as tabelas de percentis: p90 e p95 são lidos pelo médico nas tabelas da AAP (2017)."
      ficha={fichaCriseHipertensivaPed}
    >
      <CampoPaciente id="ha" p={p} onChange={setP} />

      <Bloco titulo="Classificação (Tabela 1, p. 272)">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="ha-pas" label="PA sistólica" unit="mmHg" value={pas} onChange={setPas} min={0} />
          <NumberField id="ha-pad" label="PA diastólica" unit="mmHg" value={pad} onChange={setPad} min={0} />
        </div>
        {faixa === 'crianca' && (
          <>
            <p className="text-tinta-sussurro">1 a &lt; 13 anos: percentis para sexo, idade e altura nas tabelas da AAP (p. 272).</p>
            <div className="grid gap-3 sm:grid-cols-4">
              <NumberField id="ha-p90s" label="p90 sistólica" unit="mmHg" value={pc.p90s} onChange={(x) => setPc({ ...pc, p90s: x })} min={0} />
              <NumberField id="ha-p95s" label="p95 sistólica" unit="mmHg" value={pc.p95s} onChange={(x) => setPc({ ...pc, p95s: x })} min={0} />
              <NumberField id="ha-p90d" label="p90 diastólica" unit="mmHg" value={pc.p90d} onChange={(x) => setPc({ ...pc, p90d: x })} min={0} />
              <NumberField id="ha-p95d" label="p95 diastólica" unit="mmHg" value={pc.p95d} onChange={(x) => setPc({ ...pc, p95d: x })} min={0} />
            </div>
          </>
        )}
        {faixa === 'lactente' && <p className="text-tinta-sussurro">A Tabela 1 começa em 1 ano: para menores de 1 ano (e RN) o livro não classifica.</p>}
        {faixa === 'adolescente' && <p className="text-tinta-sussurro">≥ 13 anos: cortes fixos (normal &lt; 120 × 80; elevada 120–129 × &lt; 80; estágio 1 130–139 × 80–89; estágio 2 ≥ 140 × 90).</p>}
        {estagio && (
          <p>
            Pela Tabela 1: <strong>{ROTULO_ESTAGIO[estagio]}</strong> (sistólica e diastólica avaliadas em separado; vale a mais alta).
          </p>
        )}
        {acima !== null && acima > 30 && <p className="text-atencao">PAS {br(acima, 0)} mmHg acima do p95: o livro diz que aumento &gt; 30 mmHg acima do p95 deve preocupar para lesão de órgão-alvo (p. 272).</p>}
      </Bloco>

      <Bloco titulo="Meta na emergência hipertensiva (p. 275)" descricao="O livro não traz fórmula de PAM: informe a PAM medida.">
        <NumberField id="ha-pam" label="PAM atual" unit="mmHg" value={pam} onChange={setPam} min={0} />
        {pamMin !== null && (
          <p>
            Redução de no máximo 25% nas primeiras 8 h: PAM não abaixo de <strong className="tabular-nums">{br(pamMin, 0)} mmHg</strong>; depois, PA em torno do p95 em 12 a 24/48 h.
          </p>
        )}
      </Bloco>

      <Pendencia p={p} />
      {calc && (
        <>
          <Bloco titulo="Sintomas ameaçadores à vida (Tabela 3, p. 276)">
            {HIDRALAZINA_IV && <LinhaBolusApendice b={HIDRALAZINA_IV} peso={p.peso} idadeMeses={idadeMeses} />}
            {INFUSOES_CRISE_HA.map((f) => (
              <LinhaLivro
                key={f.id}
                nome={f.nome}
                conta={<strong>{faixaBr([f.faixa[0] * p.peso, f.faixa[1] * p.peso], 1)} µg/min</strong>}
                texto={`${faixaBr(f.faixa, 2)} µg/kg/min${f.maximo ? ` até ${br(f.maximo, 2)} µg/kg/min (${br(f.maximo * p.peso, 1)} µg/min)` : ''}. ${f.nota}`}
                pagina={f.pagina}
              />
            ))}
          </Bloco>
          <Bloco titulo="Sintomas menos significativos — VO (Tabela 3, p. 276)">
            {DOSES_CRISE_HA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} />)}
          </Bloco>
        </>
      )}

      <Bloco titulo="Erratas e divergências conferidas no PDF">
        {ERRATAS_CRISE_HA.map((e) => <Errata key={e} texto={e} />)}
      </Bloco>
      <Bloco titulo="Do capítulo">
        {REFERENCIAS_CRISE_HA.map((r) => (
          <p key={r.texto} className="text-tinta-sussurro">
            {r.texto} ({r.pagina})
          </p>
        ))}
      </Bloco>
    </ToolLayout>
  )
}
