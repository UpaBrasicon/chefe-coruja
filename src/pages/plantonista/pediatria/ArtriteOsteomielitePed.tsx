import { useState } from 'react'

import {
  CENARIOS, DURACAO, TABELA2_OSTEO, TABELA3, classificarOsteomielite, faixaOsteo, fichaOsteoarticularPed, sinovialSugestivo, type Cenario,
} from '@/clinico/pediatria/osteoarticularPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Opcoes } from './PecasIcr'
import { Aviso, LinhaDoseLivro } from './PecasP4'
import { ListaLivro } from './PecasP5'

const FAIXA_TEXTO = { '0-3m': '0 a 3 meses', '3m-5a': '3 meses a 5 anos', '>5a': 'mais de 5 anos' } as const

/** Artrite séptica e osteomielite — cap. 49 do livro do ICr. */
export function ArtriteOsteomielitePed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [cenario, setCenario] = useState<Cenario>('mssa90')
  const [dias, setDias] = useState(0)
  const [sin, setSin] = useState(0)
  const [pmn, setPmn] = useState(false)
  const [gram, setGram] = useState(false)
  const temIdade = p.anos > 0 || p.meses > 0 || p.rn
  const faixa = temIdade ? faixaOsteo(p.rn ? 0 : p.anos * 12 + p.meses) : null
  const tipo = dias > 0 ? classificarOsteomielite(dias) : null
  const sinovial = sinovialSugestivo(sin, pmn, gram)
  const calc = p.peso > 0 && idadePediatrica(p.anos, p.meses)

  return (
    <ToolLayout
      title="Artrite séptica e osteomielite — criança"
      description="Antibiótico pela frequência local de MRSA (Tabela 3, doses mínimas) com máximos do Apêndice, cobertura por faixa etária, classificação temporal, líquido sinovial e duração — livro do ICr-HCFMUSP. A escolha é do médico."
      ficha={fichaOsteoarticularPed}
    >
      <CampoPaciente id="ost" p={p} onChange={setP} />

      <Bloco titulo="Agentes e cobertura por idade (Tabela 2, p. 497–498)">
        {faixa ? (
          <p>
            <strong>{FAIXA_TEXTO[faixa]}</strong>: {TABELA2_OSTEO[faixa].agentes}. Cobertura: {TABELA2_OSTEO[faixa].cobertura}.
          </p>
        ) : (
          <p className="text-tinta-sussurro">Informe a idade.</p>
        )}
        <p className="text-tinta-sussurro">MSSA: oxacilina, cefazolina, ampicilina ou clindamicina. MRSA: clindamicina, vancomicina ou linezolida, conforme a sensibilidade local.</p>
      </Bloco>

      <Bloco titulo="Antibiótico pela resistência local (Tabela 3, p. 498–499)">
        <Opcoes<Cenario> label="Resistência local" valor={cenario} opcoes={CENARIOS} onChange={setCenario} />
        {!calc ? (
          <Aviso>Informe o peso (idade até 13 anos e 11 meses) para calcular as doses.</Aviso>
        ) : p.rn ? (
          <Aviso>Recém-nascido: a Figura 2 (p. 500) diz que o tratamento deve ser individualizado; a ferramenta não calcula.</Aviso>
        ) : (
          TABELA3[cenario].map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)
        )}
      </Bloco>

      <Bloco titulo="Osteomielite — tempo de sintomas (p. 494)">
        <NumberField id="ost-dias" label="Dias desde o início dos sintomas" unit="dias" value={dias} onChange={setDias} min={0} />
        {tipo && <p>Pelo livro: <strong>osteomielite {tipo}</strong> (aguda até 2 semanas; subaguda de 2 semanas a 3 meses; crônica depois).</p>}
      </Bloco>

      <Bloco titulo="Líquido sinovial (p. 496)">
        <NumberField id="ost-sin" label="Leucócitos no líquido sinovial" unit="/mm³" value={sin} onChange={setSin} min={0} />
        <div className="flex flex-wrap gap-4">
          <Opcoes label="Predomínio de PMN?" valor={pmn} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setPmn} />
          <Opcoes label="Gram positivo?" valor={gram} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setGram} />
        </div>
        {sinovial && <p>{sinovial.achados.length ? <>Achados sugestivos de artrite séptica pelo livro: <strong>{sinovial.achados.join('; ')}</strong>.</> : 'Nenhum dos achados sugestivos citados pelo livro.'}</p>}
      </Bloco>

      <Bloco titulo="Duração e cirurgia">
        <ListaLivro itens={DURACAO} />
      </Bloco>
    </ToolLayout>
  )
}
