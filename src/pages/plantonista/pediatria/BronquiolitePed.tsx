import { useState } from 'react'

import {
  FATORES_RISCO, FR_HIDRATACAO, INDICACOES_INTERNACAO, REFERENCIAS_BRONQUIOLITE, criteriosPalivizumabe, fichaBronquiolite, fluxoCnafLMin, indicacoesPresentes,
} from '@/clinico/pediatria/bronquiolite'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaReferencia } from './PecasP2'
import { Marcadores } from './PecasP4'

/** Bronquiolite — cap. 29 do livro do ICr. */
export function BronquiolitePed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [fr, setFr] = useState(0)
  const [achados, setAchados] = useState<Set<string>>(new Set())
  const [riscos, setRiscos] = useState<Set<string>>(new Set())
  const [ig, setIg] = useState(0)
  const [dpc, setDpc] = useState(false)
  const [cardio, setCardio] = useState(false)
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const cnaf = !p.rn && pediatrico ? fluxoCnafLMin(p.peso) : null
  const presentes = indicacoesPresentes(achados, fr > 0 ? fr : null)
  const pali = criteriosPalivizumabe({ idadeMeses: p.anos * 12 + p.meses, igSemanas: ig > 0 ? ig : null, dpc, cardiopatia: cardio })

  return (
    <ToolLayout
      title="Bronquiolite — internação, CNAF e palivizumabe"
      description="Indicações de internação, fatores de risco, fluxo da cânula nasal de alto fluxo por peso e critérios de palivizumabe — livro do ICr-HCFMUSP. O capítulo não traz escore nem dose de medicamento."
      ficha={fichaBronquiolite}
    >
      <CampoPaciente id="bq" p={p} onChange={setP} />

      <Bloco titulo="Indicações de internação (p. 302–303)" descricao="Marque o que está presente. A decisão é do médico.">
        <NumberField id="bq-fr" label="Frequência respiratória" unit="irpm" value={fr} onChange={setFr} min={0} />
        <Marcadores itens={INDICACOES_INTERNACAO} marcados={achados} onChange={setAchados} />
        {presentes.length > 0 ? (
          <p>
            <strong>{presentes.length}</strong> achado(s) que o livro lista como indicação de internação: {presentes.join('; ')}.
          </p>
        ) : (
          <p className="text-muted-foreground">Nenhum achado da lista do livro marcado.</p>
        )}
        {fr > FR_HIDRATACAO && <Nota>FR acima de {FR_HIDRATACAO}: o livro cita diminuição da ingesta e possível necessidade de hidratação EV (isotônicos) ou por sonda (p. 303).</Nota>}
        <p className="font-medium">Pesam na decisão (p. 303):</p>
        <Marcadores itens={FATORES_RISCO} marcados={riscos} onChange={setRiscos} />
      </Bloco>

      <Pendencia p={p} />
      {cnaf && (
        <Bloco titulo="Cânula nasal de alto fluxo (p. 303)">
          <LinhaLivro nome="Fluxo" conta={<strong>{faixaBr(cnaf, 1)} L/min</strong>} texto="1 a 2 L/kg/min" pagina="p. 303" nota="CPAP e CNAF são intercambiáveis; o CNAF inicial teve mais falha que o CPAP em estudo multicêntrico (p. 303)." />
        </Bloco>
      )}

      <Bloco titulo="Palivizumabe (p. 304)" descricao="Portaria SAS-SCTIE/MS n. 23/2018 citada no livro. &quot;Até 2 anos&quot; lido como até 24 meses completos.">
        <NumberField id="bq-ig" label="Idade gestacional ao nascer" unit="semanas" value={ig} onChange={setIg} min={0} max={42} />
        <Opcoes label="Doença pulmonar crônica da prematuridade" valor={dpc} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setDpc} />
        <Opcoes label="Cardiopatia congênita com repercussão hemodinâmica" valor={cardio} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setCardio} />
        {pali.length > 0 ? <p>Critério(s) do livro presentes: <strong>{pali.join('; ')}</strong>.</p> : <p className="text-muted-foreground">Nenhum critério do livro preenchido com os dados informados.</p>}
      </Bloco>

      <Bloco titulo="Do capítulo">
        {REFERENCIAS_BRONQUIOLITE.map((r) => <LinhaReferencia key={r.rotulo} rotulo={r.rotulo} texto={r.texto} pagina={`cap. 29, ${r.pagina}`} />)}
      </Bloco>
    </ToolLayout>
  )
}
