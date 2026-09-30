import { useState } from 'react'

import { BOLUS } from '@/clinico/pediatria/bolus'
import {
  FLUDROCORTISONA_UG, NOTA_APENDICE, NOTA_FLUDRO_APENDICE, REFERENCIAS_ADRENAL, expansaoAdrenalMl, fichaInsuficienciaAdrenalPed, fludrocortisonaDispensavel,
  hidrocortisonaBolusMg, hidrocortisonaManutencao, hidrocortisonaReducao,
} from '@/clinico/pediatria/insuficienciaAdrenalPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, faixaBr, idadePediatrica, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Pendencia } from './PecasIcr'
import { LinhaBolusApendice } from './PecasP4'
import { CampoSC, LinhaFaixa, ListaLivro } from './PecasP5'

const HC_APENDICE = BOLUS.find((b) => b.id === 'hidrocortisona-adrenal')

/** Crise adrenal — cap. 53 do livro do ICr. */
export function InsuficienciaAdrenalPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [scInformada, setSc] = useState(0)
  const [hcDia, setHcDia] = useState(0)
  const calc = podeCalcular(p)
  const sc = idadePediatrica(p.anos, p.meses) ? scInformada : 0
  const man = hidrocortisonaManutencao(sc)
  const fludro = fludrocortisonaDispensavel(hcDia)

  return (
    <ToolLayout
      title="Crise adrenal — hidrocortisona por m²"
      description="Hidrocortisona em bolo e manutenção por superfície corpórea informada, redução, expansão com SF e fludrocortisona — livro do ICr-HCFMUSP (cap. 53), com a alternativa por peso do Apêndice ao lado."
      ficha={fichaInsuficienciaAdrenalPed}
    >
      <CampoPaciente id="adr" p={p} onChange={setP} />
      <CampoSC id="adr-sc" valor={scInformada} onChange={setSc} />

      {p.rn ? (
        <Pendencia p={p} />
      ) : (
        <Bloco titulo="Hidrocortisona pelo capítulo (p. 530)" descricao="Por m² de superfície corpórea; sem superfície informada não há conta.">
          <LinhaFaixa nome="Bolo inicial" faixa={hidrocortisonaBolusMg(sc)} unidade="mg" casas={1} texto='75 a 100 mg/m² EV "em bolo" (alternativa: IM)' pagina="p. 530" />
          <LinhaFaixa
            nome="Manutenção (6/6 h)"
            faixa={man?.dia ?? null}
            unidade="mg/dia"
            casas={1}
            texto="75 a 100 mg/m²/dia EV, dividida a cada 6 horas"
            pagina="p. 530"
            extra={man && <span className="text-tinta-sussurro"> · {faixaBr(man.porDose, 1)} mg/dose</span>}
          />
          <LinhaFaixa nome="Redução gradual" faixa={hidrocortisonaReducao(sc)} unidade="mg/dia" casas={1} texto="reduzir para 75 e até 50 mg/m²/dia conforme a evolução; então pode iniciar VO" pagina="p. 530" />
          {calc && <LinhaFaixa nome="Expansão com SF 0,9%" faixa={expansaoAdrenalMl(p.peso)} unidade="mL" casas={0} texto="20 mL/kg a cada 20 minutos até remissão do choque" pagina="p. 530" />}
          {!calc && <Nota>Informe o peso para o volume da expansão.</Nota>}
        </Bloco>
      )}

      <Bloco titulo="9α-fluor-hidrocortisona (p. 530)" descricao={`${FLUDROCORTISONA_UG[0]} a ${FLUDROCORTISONA_UG[1]} µg VO ou por SNG, 1x ao dia — importante na insuficiência primária.`}>
        <NumberField id="adr-hcdia" label="Hidrocortisona EV nas 24 h" unit="mg" value={hcDia} onChange={setHcDia} min={0} />
        {fludro !== null && (
          <p>{fludro ? <strong>Acima de 50 mg em 24 h: o livro considera a fludrocortisona dispensável (ação mineralocorticoide da hidrocortisona).</strong> : 'Até 50 mg em 24 h: o livro mantém a fludrocortisona.'}</p>
        )}
        <Nota>{NOTA_FLUDRO_APENDICE}</Nota>
      </Bloco>

      {calc && HC_APENDICE && (
        <Bloco titulo="Alternativa por peso — Apêndice (p. 903)">
          <LinhaBolusApendice b={HC_APENDICE} peso={p.peso} idadeMeses={p.anos * 12 + p.meses} />
          <Nota>{NOTA_APENDICE}</Nota>
        </Bloco>
      )}

      <Bloco titulo="Do capítulo">
        <ListaLivro itens={REFERENCIAS_ADRENAL} />
      </Bloco>
    </ToolLayout>
  )
}
