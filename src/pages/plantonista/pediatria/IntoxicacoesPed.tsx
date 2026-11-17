import { useState } from 'react'

import {
  ANTIDOTOS_APENDICE, ANTIDOTOS_TABELA3, DOSES_CAPITULO_INTOX, ERRATA_NIVEIS, REFERENCIAS_INTOX, TOXINDROMES, fichaIntoxicacaoPed,
} from '@/clinico/pediatria/intoxicacaoPed'
import { calcularBolus, type Bolus } from '@/clinico/pediatria/bolus'
import { calcularDoseLivro, textoDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { textoFontes } from '@/clinico/ficha'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Pendencia } from './PecasIcr'
import { LinhaBolusApendice, LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { LinhaReferencia } from './PecasP2'

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

/** Linha do "Copiar": a mesma conta da LinhaBolusApendice (PecasP4). */
function bolusTxt(b: Bolus, peso: number, idadeMeses?: number): string[] {
  const r = calcularBolus(b, peso, idadeMeses)
  if (!r || r.aplica === 'nao') return []
  return [`- ${b.nome}: ${faixaBr(r.faixa, r.faixa[1] >= 10 ? 1 : 2)} ${b.unidade}${r.volumeMl ? ` · ${faixaBr(r.volumeMl, 2)} mL` : ''}${r.noMaximo ? ' (limitado ao máximo do livro)' : ''}${r.aplica === 'indefinido' ? ' (depende da idade)' : ''} · ${b.via} (Apêndice, ${b.pagina})`]
}

/** Intoxicações exógenas na criança — cap. 18 do livro do ICr. */
export function IntoxicacoesPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const idadeMeses = p.anos * 12 + p.meses
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaIntoxicacaoPed.id)

  // Texto do "Copiar" (C3 e C4 = A): doses do capítulo e antídotos do Apêndice para o peso, com a página do livro.
  const copia = () =>
    textoCopia({
      ferramenta: 'Intoxicações exógenas — criança (PS Pediatria ICr-HCFMUSP)',
      dados: [
        ['Peso', `${numeroBr(p.peso)} kg`],
        ['Idade', p.anos > 0 || p.meses > 0 ? `${p.anos} anos e ${p.meses} meses` : ''],
      ],
      resultado: [
        'Descontaminação, eliminação e antídotos do capítulo:',
        ...DOSES_CAPITULO_INTOX.flatMap((d) => doseLivroTxt(d, p.peso)),
        'Antídotos do Apêndice:',
        ...ANTIDOTOS_APENDICE.flatMap((b) => bolusTxt(b, p.peso, idadeMeses)),
      ],
      fonte: textoFontes(fichaIntoxicacaoPed),
      versao: fichaIntoxicacaoPed.versao,
      quando: new Date(),
    })

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
      </Bloco>

      <Bloco titulo="Toxíndromes (Tabela 2, p. 203–204)">
        <TabelaLivro cabecalho={['Síndrome', 'Manifestações', 'Agentes']} linhas={TOXINDROMES.map((t) => [t.nome, t.clinica, t.agentes])} />
      </Bloco>

      <Bloco titulo="Antídotos com eficácia comprovada (Tabela 3, p. 206)">
        <TabelaLivro cabecalho={['Agente tóxico', 'Antídoto/antagonista']} linhas={ANTIDOTOS_TABELA3.map(([a, b]) => [a, b])} largura={360} />
        <p className="text-tinta-sussurro">Centros de intoxicações citados no Apêndice (p. 910): CCI 0800 771 3733; CEATOX 0800 148 110.</p>
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc}
        // A errata dos níveis séricos (unidades incoerentes, não usados como corte) vai para "Armadilhas" (C6 = A).
        armadilhas={[ERRATA_NIVEIS, ...(guia?.armadilhas ?? [])]}
        ficha={fichaIntoxicacaoPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(p.peso)} kg${p.anos > 0 || p.meses > 0 ? ` · ${p.anos} a ${p.meses} m` : ''}` : 'Informe peso e idade'}
        detalhe={calc ? 'Doses do peso nas listas acima; "Copiar" leva todas.' : undefined}
        textoCopia={calc ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
