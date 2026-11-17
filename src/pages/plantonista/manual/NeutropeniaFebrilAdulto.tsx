import { useState } from 'react'

import {
  ANTIFUNGICOS_NF, ATB_ALTO_RISCO, DEFINICOES_NF, DIFERENCAS_NF, DIRETRIZ_NF, DURACAO_NF, ERRATA_ANFO_DEOXICOLATO, ERRATA_MASCC, INDICACOES_VANCO_NF, antifungicosPorPeso,
  fichaNeutropeniaFebrilAdulto,
} from '@/clinico/adulto/neutropeniaFebril'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { ListaLivro } from './PecasLoteE7'
import { br, faixa } from './loteE7Formato'

const ERRATA_CISNE = 'p. 1067–1068 — CISNE citado (3 níveis, usa monócitos) sem tabela de pontos: não implementado.'

/** Neutropenia febril: definições e doses empíricas (cap. 81 do manual do HCFMUSP). */
export function NeutropeniaFebrilAdulto() {
  const [peso, setPeso] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaNeutropeniaFebrilAdulto.id)
  const af = antifungicosPorPeso(peso)

  // Texto do "Copiar" (C3/C4 = A): a lista inteira de doses do capítulo; os antifúngicos por peso só com peso.
  const copia = textoCopia({
    ferramenta: 'Neutropenia febril — definições e doses (adulto)',
    dados: [['Peso', peso > 0 ? `${numeroBr(peso)} kg` : '']],
    resultado: [
      ...ATB_ALTO_RISCO.map((a) => `- Alto risco, ${a.nome}: ${a.dose} (p. 1069–1070)`),
      `Vancomicina ou teicoplanina associadas em (p. 1070): ${INDICACOES_VANCO_NF.join('; ')}. O livro não traz dose de vancomicina nem de teicoplanina neste capítulo.`,
      `- Caspofungina: ${ANTIFUNGICOS_NF.caspofungina.texto} (${ANTIFUNGICOS_NF.pagina})`,
      `- Anfotericina B lipossomal: ${ANTIFUNGICOS_NF.anfoLipossomal.texto}${af ? ` = ${faixa(af.anfoLipossomalMg, 0)} mg/dia` : ''} (${ANTIFUNGICOS_NF.pagina})`,
      `- Voriconazol: ${ANTIFUNGICOS_NF.voriconazol.texto}${af ? ` = 1º dia ${br(af.voriconazolAtaqueMg, 0)} mg 12/12 h · depois ${br(af.voriconazolManutencaoMg, 0)} mg 12/12 h` : ''} (${ANTIFUNGICOS_NF.pagina})`,
      `- Anfotericina B deoxicolato: 5 mg/kg 1 x/d (como está no livro), não calculado. Errata: ${ERRATA_ANFO_DEOXICOLATO}`,
      ...DURACAO_NF.map((d) => `Duração: ${d.texto} (${d.pagina})`),
    ],
    fonte: textoFontes(fichaNeutropeniaFebrilAdulto),
    versao: fichaNeutropeniaFebrilAdulto.versao,
    quando: new Date(),
  })

  return (
    <ToolLayout
      title="Neutropenia febril — definições e doses (adulto)"
      description="Definições, β-lactâmicos antipseudomonas do alto risco, indicações de cobertura para Gram-positivo, antifúngicos por peso e duração, pelo manual do HC. O MASCC está em ferramenta própria. Adulto (14 anos ou mais)."
      ficha={fichaNeutropeniaFebrilAdulto}
    >
      <Bloco titulo="Definições (p. 1062–1068)">
        <ListaLivro itens={DEFINICOES_NF} />
      </Bloco>

      <Bloco titulo="Alto risco: monoterapia antipseudomonas em internação (p. 1069–1070)">
        {ATB_ALTO_RISCO.map((a) => <LinhaManual key={a.nome} nome={a.nome} texto={a.dose} pagina="p. 1069–1070" />)}
        <p className="text-apoio font-medium">Vancomicina ou teicoplanina não fazem parte do esquema inicial; o livro associa em (p. 1070):</p>
        <ul className="list-disc pl-5 text-apoio">{INDICACOES_VANCO_NF.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="text-apoio text-tinta-sussurro">O livro não traz dose de vancomicina nem de teicoplanina neste capítulo.</p>
      </Bloco>

      <CampoPeso id="nf-peso" peso={peso} onChange={setPeso} />
      <Bloco titulo="Antifúngicos (p. 1072)">
        <LinhaManual nome="Caspofungina" texto={ANTIFUNGICOS_NF.caspofungina.texto} pagina={ANTIFUNGICOS_NF.pagina} />
        <LinhaManual
          nome="Anfotericina B lipossomal"
          texto={ANTIFUNGICOS_NF.anfoLipossomal.texto}
          conta={af ? <strong>{faixa(af.anfoLipossomalMg, 0)} mg/dia</strong> : 'informe o peso'}
          pagina={ANTIFUNGICOS_NF.pagina}
        />
        <LinhaManual
          nome="Voriconazol"
          texto={ANTIFUNGICOS_NF.voriconazol.texto}
          conta={af ? <>1º dia <strong>{br(af.voriconazolAtaqueMg, 0)} mg</strong> 12/12 h · depois {br(af.voriconazolManutencaoMg, 0)} mg 12/12 h</> : 'informe o peso'}
          pagina={ANTIFUNGICOS_NF.pagina}
        />
        <LinhaManual nome="Anfotericina B deoxicolato" texto="5 mg/kg 1 x/d (como está no livro)" conta="não calculado" pagina={ANTIFUNGICOS_NF.pagina} errata={ERRATA_ANFO_DEOXICOLATO} />
      </Bloco>

      <Bloco titulo="Duração (p. 1071–1072)">
        <ListaLivro itens={DURACAO_NF} />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        armadilhas={[
          `Anfotericina B deoxicolato — errata do livro: ${ERRATA_ANFO_DEOXICOLATO}`,
          // Erratas do MASCC (escore em ferramenta própria): saem da página para "Armadilhas" (C6 = A).
          ERRATA_MASCC,
          ERRATA_CISNE,
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaNeutropeniaFebrilAdulto}
        guia={guia}
        comparacao={
          // Tabela de comparação com a ABHH e o MASCC vai para "Evidências" (C6 = A); nenhuma dose do manual muda.
          <BlocoComparacao titulo="ABHH 2024 e MASCC 2026 — ao lado do manual" resumo="Consenso da ABHH de 2024 (Delphi, sem graduação, em pacientes hematológicos), lido no texto integral, e pontos do consenso MASCC de 2026, lidos no resumo. As doses e contas do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_NF.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_NF.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={af ? `Adulto · ${numeroBr(peso)} kg` : 'Adulto · informe o peso para os antifúngicos'}
        detalhe={af ? `Anfotericina B lipossomal ${faixa(af.anfoLipossomalMg, 0)} mg/dia · voriconazol ${br(af.voriconazolAtaqueMg, 0)} mg 12/12 h no 1º dia; "Copiar" leva todas as doses` : '"Copiar" leva os β-lactâmicos, os antifúngicos e a duração'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
