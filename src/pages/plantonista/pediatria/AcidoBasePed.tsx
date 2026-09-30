import { useState } from 'react'

import {
  AG_TEXTO, BIC14_MEQ_ML, ERRATA_ALCALOSE_METABOLICA, ERRATA_BIC14, HCL_MMOL_L, HCO3_DESEJADO, NORMAIS_IDADE, NORMAL_TABELA2, NOTA_MARGEM, NOTA_TEMPOS, PH_NORMAL, anionGap,
  bicarbonatoMeq, criterioBicarbonato, fichaAcidoBasePed, hclMeq, lerGasometria, mlBic14, mlHcl, razaoDelta, type Tempo,
} from '@/clinico/pediatria/acidobasePed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, LinhaLivro, Nota, Opcoes, Pendencia } from './PecasIcr'

/** Distúrbios acidobásicos na criança — cap. 55 do Pronto-Socorro ICr-HCFMUSP. */
export function AcidoBasePed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [g, setG] = useState({ ph: 0, pco2: 0, hco3: 0, na: 0, cl: 0 })
  const [tempo, setTempo] = useState<Tempo>('aguda')
  const [agNormal, setAgNormal] = useState(12)
  const [hco3Desejado, setHco3Desejado] = useState(0)
  const leitura = lerGasometria(g.ph, g.pco2, g.hco3, tempo)
  const ag = g.na > 0 && g.cl > 0 && g.hco3 > 0 ? anionGap(g.na, g.cl, g.hco3) : null
  const delta = ag !== null && agNormal > 0 ? razaoDelta(ag, g.hco3, agNormal) : null
  const calc = podeCalcular(p)
  const indicaBic = g.ph > 0 && g.hco3 > 0 ? criterioBicarbonato(g.ph, g.hco3) : null
  const bic = calc && g.hco3 > 0 ? bicarbonatoMeq(p.peso, g.hco3) : null
  const hcl = calc && g.hco3 > 0 && hco3Desejado > 0 ? hclMeq(p.peso, g.hco3, hco3Desejado) : null

  return (
    <ToolLayout
      title="Distúrbios acidobásicos — criança"
      description="Leitura da gasometria em três etapas, compensação esperada (Tabela 3), ânion-gap e razão delta, bicarbonato e HCl pelo livro do ICr-HCFMUSP. O diagnóstico é do profissional."
      ficha={fichaAcidoBasePed}
    >
      <CampoPaciente id="ab" p={p} onChange={setP} semIdade />

      <Bloco titulo="Gasometria (p. 561–563; 571–572)" descricao={`Acidemia pH < ${PH_NORMAL[0]}; alcalemia pH > ${PH_NORMAL[1]}. Normais da Tabela 2: HCO3 ${NORMAL_TABELA2.hco3} ± 2 mM, pCO2 ${NORMAL_TABELA2.pco2} ± 2 mmHg.`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ab-ph" label="pH" value={g.ph} onChange={(v) => setG({ ...g, ph: v })} step={0.01} />
          <NumberField id="ab-pco2" label="pCO2" unit="mmHg" value={g.pco2} onChange={(v) => setG({ ...g, pco2: v })} />
          <NumberField id="ab-hco3" label="HCO3" unit="mEq/L" value={g.hco3} onChange={(v) => setG({ ...g, hco3: v })} step={0.1} />
          <Opcoes label="Se respiratório" valor={tempo} opcoes={[['aguda', 'Agudo'], ['cronica', 'Crônico']]} onChange={setTempo} />
        </div>
        {leitura && (
          <div className="rounded-lg border px-3 py-2">
            <p>
              <strong>{leitura.estado}</strong>
              {leitura.primarios.length > 0 && <> — {leitura.primarios.join(' + ')}</>}
            </p>
            {leitura.compensacao && (
              <p className="tabular-nums">
                Esperado: {leitura.compensacao.esperado} · {leitura.compensacao.texto}
              </p>
            )}
            {leitura.alertas.map((a) => (
              <p key={a} className="text-atencao">
                {a}
              </p>
            ))}
          </div>
        )}
        <Nota>{NOTA_TEMPOS}</Nota>
        <Nota>{NOTA_MARGEM}</Nota>
        <Errata texto={ERRATA_ALCALOSE_METABOLICA} />
        <details className="text-xs text-tinta-sussurro">
          <summary className="cursor-pointer">Valores normais por idade (Tabela 1, p. 562)</summary>
          <ul className="mt-1">
            {NORMAIS_IDADE.map((n) => (
              <li key={n.faixa}>
                {n.faixa}: pH {n.ph} · pCO2 {n.pco2} · HCO3 {n.hco3}
              </li>
            ))}
          </ul>
        </details>
      </Bloco>

      <Bloco titulo="Ânion-gap e razão delta (p. 564 e 571)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ab-na" label="Sódio" unit="mEq/L" value={g.na} onChange={(v) => setG({ ...g, na: v })} />
          <NumberField id="ab-cl" label="Cloro" unit="mEq/L" value={g.cl} onChange={(v) => setG({ ...g, cl: v })} />
          <NumberField id="ab-agn" label="Ânion-gap normal do laboratório" unit="mEq/L" value={agNormal} onChange={setAgNormal} />
        </div>
        {ag !== null && (
          <p className="tabular-nums">
            Ânion-gap = Na − (Cl + HCO3): <strong>{br(ag)} mEq/L</strong>
          </p>
        )}
        {delta && (
          <p className="tabular-nums">
            ΔAG/ΔHCO3 = <strong>{br(delta.razao, 2)}</strong> — {delta.texto}
          </p>
        )}
        <Nota>{AG_TEXTO} A razão usa HCO3 normal de {NORMAL_TABELA2.hco3} (Tabela 2) e o ânion-gap normal informado (valor inicial 12, do cap. 52, p. 517).</Nota>
      </Bloco>

      <Pendencia p={p} />

      {calc && (
        <Bloco titulo="Bicarbonato de sódio (p. 566)" descricao="Na CAD a indicação e a dose seguem o cap. 52 (ferramenta de CAD).">
          {indicaBic !== null && <p>{indicaBic ? 'pH < 7,1 ou HCO3 < 8 mEq/L: critério geral do livro presente.' : 'Critério geral do livro (pH < 7,1 ou HCO3 < 8) ausente.'}</p>}
          <LinhaLivro
            nome="Correção até HCO3 15"
            texto={`mEq = (${HCO3_DESEJADO} − HCO3) × 0,3 × peso; solução isosmolar a 1,4% (${br(BIC14_MEQ_ML, 2)} mEq/mL) em 1 a 2 h, com gasometria depois`}
            conta={bic !== null && <strong>{br(bic, 1)} mEq = {br(mlBic14(bic), 0)} mL a 1,4%</strong>}
            pagina="p. 566"
            errata={ERRATA_BIC14}
          />
        </Bloco>
      )}

      {calc && (
        <Bloco titulo="Alcalose metabólica grave — HCl (p. 567–568)" descricao="pH > 7,55 ou HCO3 > 40, cloreto-sensível refratária; uso raro. HCl 0,1 M ou 0,2 M em acesso central.">
          <NumberField id="ab-hco3d" label="HCO3 desejado (o livro não fixa)" unit="mEq/L" value={hco3Desejado} onChange={setHco3Desejado} />
          {hcl && (
            <LinhaLivro
              nome="HCl"
              texto="mEq = 0,5 × peso × (HCO3 plasmático − HCO3 desejado); metade primeiro e o resto após reavaliação; máx. 0,2 mEq/kg/h"
              conta={
                <strong>
                  {br(hcl.total, 1)} mEq (metade {br(hcl.metade, 1)} mEq ≥ {br(hcl.horasMin, 1)} h a ≤ {br(hcl.maxMeqH, 1)} mEq/h)
                </strong>
              }
              pagina="p. 567–568"
              nota={`Metade: ${br(mlHcl(hcl.metade, HCL_MMOL_L['0,1 M']), 0)} mL de HCl 0,1 M ou ${br(mlHcl(hcl.metade, HCL_MMOL_L['0,2 M']), 0)} mL de HCl 0,2 M.`}
            />
          )}
        </Bloco>
      )}
    </ToolLayout>
  )
}
