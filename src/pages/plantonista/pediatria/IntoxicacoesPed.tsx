import { useState } from 'react'

import {
  ANTIDOTOS_APENDICE, ANTIDOTOS_TABELA3, DOSES_CAPITULO_INTOX, ERRATA_NIVEIS, REFERENCIAS_INTOX, TOXINDROMES, fichaIntoxicacaoPed,
} from '@/clinico/pediatria/intoxicacaoPed'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, Pendencia } from './PecasIcr'
import { LinhaBolusApendice, LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { LinhaReferencia } from './PecasP2'

/** Intoxicações exógenas na criança — cap. 18 do livro do ICr. */
export function IntoxicacoesPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const idadeMeses = p.anos * 12 + p.meses

  return (
    <ToolLayout
      title="Intoxicações exógenas — criança"
      description="Descontaminação, eliminação e antídotos por peso, toxíndromes e tabela de antídotos — livro do ICr-HCFMUSP. O capítulo recomenda consultar o centro de controle de intoxicações antes de um antídoto."
      ficha={fichaIntoxicacaoPed}
    >
      <CampoPaciente id="intox" p={p} onChange={setP} />
      <Pendencia p={p} />

      {calc && (
        <>
          <Bloco titulo="Descontaminação, eliminação e antídotos do capítulo (p. 205–208)">
            {DOSES_CAPITULO_INTOX.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} />)}
          </Bloco>
          <Bloco titulo="Antídotos do Apêndice (p. 894–910)" descricao="As mesmas doses da ferramenta de doses por peso.">
            {ANTIDOTOS_APENDICE.map((b) => <LinhaBolusApendice key={b.id} b={b} peso={p.peso} idadeMeses={idadeMeses} />)}
          </Bloco>
        </>
      )}

      <Bloco titulo="Condutas do capítulo">
        {REFERENCIAS_INTOX.map((r) => <LinhaReferencia key={r.rotulo} rotulo={r.rotulo} texto={r.texto} pagina={`cap. 18, ${r.pagina}`} />)}
        <Errata texto={ERRATA_NIVEIS} />
      </Bloco>

      <Bloco titulo="Toxíndromes (Tabela 2, p. 203–204)">
        <TabelaLivro cabecalho={['Síndrome', 'Manifestações', 'Agentes']} linhas={TOXINDROMES.map((t) => [t.nome, t.clinica, t.agentes])} />
      </Bloco>

      <Bloco titulo="Antídotos com eficácia comprovada (Tabela 3, p. 206)">
        <TabelaLivro cabecalho={['Agente tóxico', 'Antídoto/antagonista']} linhas={ANTIDOTOS_TABELA3.map(([a, b]) => [a, b])} largura={360} />
        <p className="text-muted-foreground">Centros de intoxicações citados no Apêndice (p. 910): CCI 0800 771 3733; CEATOX 0800 148 110.</p>
      </Bloco>
    </ToolLayout>
  )
}
