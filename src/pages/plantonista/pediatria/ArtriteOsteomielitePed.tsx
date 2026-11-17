import { useState } from 'react'

import {
  CENARIOS, DURACAO, TABELA2_OSTEO, TABELA3, classificarOsteomielite, faixaOsteo, fichaOsteoarticularPed, sinovialSugestivo, type Cenario,
} from '@/clinico/pediatria/osteoarticularPed'
import { calcularDoseLivro, textoDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { textoFontes } from '@/clinico/ficha'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Opcoes } from './PecasIcr'
import { Aviso, LinhaDoseLivro } from './PecasP4'
import { ListaLivro } from './PecasP5'

const FAIXA_TEXTO = { '0-3m': '0 a 3 meses', '3m-5a': '3 meses a 5 anos', '>5a': 'mais de 5 anos' } as const

const casasLivro = (u: string, x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/** Linha do "Copiar": a mesma conta da LinhaDoseLivro (PecasP4). */
function doseLivroTxt(d: DoseLivro, peso: number, rn = false): string[] {
  if (rn && !d.neonatal) return []
  const r = calcularDoseLivro(d, peso)
  if (!r) return []
  const fmt = (f: [number, number]) => faixaBr(f, casasLivro(d.unidade, f[1]))
  const conta = [r.porDose && `${fmt(r.porDose)} ${d.unidade}/dose`, r.dia && `${fmt(r.dia)} ${d.unidade}/dia`].filter(Boolean).join(' · ')
  return [`- ${d.nome}: ${conta || textoDoseLivro(d)}${r.noMaximo ? ` (limitado ao máximo${d.fonteMaximo ? `, ${d.fonteMaximo}` : ''})` : ''} · ${d.via} (${d.pagina})`]
}

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
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaOsteoarticularPed.id)
  const doses = calc && !p.rn
  const cenarioTxt = CENARIOS.find(([c]) => c === cenario)?.[1] ?? ''
  const temConta = doses || faixa !== null || tipo !== null || sinovial !== null

  // Texto do "Copiar" (C3 e C4 = A): cobertura pela idade, doses do cenário escolhido e leituras, com a página do livro.
  const copia = () =>
    textoCopia({
      ferramenta: 'Artrite séptica e osteomielite — criança (PS Pediatria ICr-HCFMUSP)',
      dados: [
        ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
        ['Idade', p.rn ? 'recém-nascido' : temIdade ? `${p.anos} anos e ${p.meses} meses` : ''],
        ['Resistência local', doses ? cenarioTxt : ''],
        ['Dias de sintomas', dias > 0 ? String(dias) : ''],
        ['Leucócitos no líquido sinovial', sin > 0 ? `${numeroBr(sin)}/mm³` : ''],
        ['Predomínio de PMN', pmn ? 'sim' : ''],
        ['Gram positivo', gram ? 'sim' : ''],
      ],
      resultado: [
        ...(faixa ? [`${FAIXA_TEXTO[faixa]}: ${TABELA2_OSTEO[faixa].agentes}. Cobertura: ${TABELA2_OSTEO[faixa].cobertura} (Tabela 2, p. 497–498)`] : []),
        ...(doses ? [`Antibiótico — ${cenarioTxt} (Tabela 3, p. 498–499):`, ...TABELA3[cenario].flatMap((d) => doseLivroTxt(d, p.peso, p.rn))] : []),
        ...(tipo ? [`Osteomielite ${tipo} (p. 494)`] : []),
        ...(sinovial ? [sinovial.achados.length ? `Achados sugestivos de artrite séptica: ${sinovial.achados.join('; ')} (p. 496)` : 'Nenhum dos achados sugestivos citados pelo livro (p. 496)'] : []),
      ],
      fonte: textoFontes(fichaOsteoarticularPed),
      versao: fichaOsteoarticularPed.versao,
      quando: new Date(),
    })

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

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temConta}
        armadilhas={[...(guia?.armadilhas ?? [])]}
        ficha={fichaOsteoarticularPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={doses ? `Criança · ${numeroBr(p.peso)} kg${faixa ? ` · ${FAIXA_TEXTO[faixa]}` : ''}` : faixa ? `Faixa: ${FAIXA_TEXTO[faixa]}` : temConta ? 'Leituras nos blocos acima' : 'Informe peso e idade'}
        detalhe={doses ? `${cenarioTxt}; doses acima, "Copiar" leva todas.` : undefined}
        textoCopia={temConta ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
