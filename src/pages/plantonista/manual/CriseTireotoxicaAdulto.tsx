import { useState } from 'react'

import { DIFERENCAS_TT, DIRETRIZ_TT, DROGAS_CRISE_TIREOTOXICA, ERRATA_ORDEM_IODO, FORA_ENDOCRINO, esmololMgMin, fichaCriseTireotoxica, totaisTireotoxica } from '@/clinico/adulto/endocrino'
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

import { Bloco } from './LoteAPecas'
import { faixaBr } from './loteAFormato'
import { EscolhaDaAmpola } from '@/components/plantonista/calc/EscolhaDaAmpola'
import { CampoPeso, LinhaManual } from './PecasLoteC'
import { Errata, Fora } from './PecasLoteE6'

/** Crise tireotóxica — drogas (cap. 70 do manual do HCFMUSP). */
export function CriseTireotoxicaAdulto() {
  const [peso, setPeso] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaCriseTireotoxica.id)
  const t = totaisTireotoxica()
  const esm = esmololMgMin(peso)

  const conta: Record<string, string> = {
    Propiltiouracil: `${faixaBr(t.ptuManutencaoMgDia, 0)} mg/dia pela conta; ${faixaBr(t.ptuEscritoMgDia, 0)} escrito`,
    Metimazol: `${faixaBr(t.metimazolMgDia, 0)} mg/dia`,
    'Ácido iopanoico': `${t.iopanoicoD1G} g no 1º dia`,
    'Propranolol VO': `${faixaBr(t.propranololVoMgDia, 0)} mg/dia (dose habitual)`,
    Esmolol: esm ? `${faixaBr(esm.mgMin, 1)} mg/min (${faixaBr(esm.mgH, 0)} mg/h)` : 'informe o peso',
    Hidrocortisona: `${t.hidrocortisonaMgDia} mg/dia`,
    Dexametasona: `${faixaBr(t.dexametasonaMgDia, 0)} mg/dia`,
  }

  // Texto do "Copiar" (C3/C4 = A): a lista inteira de drogas com os totais da tela; o esmolol só com peso.
  const copia = textoCopia({
    ferramenta: 'Crise tireotóxica — drogas (adulto)',
    dados: [['Peso', peso > 0 ? `${numeroBr(peso)} kg` : '']],
    resultado: [
      ...DROGAS_CRISE_TIREOTOXICA.map((d) => {
        const c = d.droga === 'Esmolol' && !esm ? undefined : conta[d.droga]
        return `- ${d.droga}: ${d.texto}${c ? ` → ${c}` : ''} (${d.pagina})`
      }),
      `Errata do livro: ${ERRATA_ORDEM_IODO}`,
    ],
    fonte: textoFontes(fichaCriseTireotoxica),
    versao: fichaCriseTireotoxica.versao,
    quando: new Date(),
  })

  return (
    <ToolLayout
      title="Crise tireotóxica — adulto"
      description="Tionamidas, iodo, lítio, betabloqueadores e corticoide com doses e totais diários, como o manual do HCFMUSP traz. Burch-Wartofsky em ferramenta própria. Adulto (14 anos ou mais)."
      ficha={fichaCriseTireotoxica}
    >
      <CampoPeso id="ct-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Drogas da crise tireotóxica" descricao="Cap. 70, p. 953–954. O capítulo não traz diluição (sem mL/h).">
        {DROGAS_CRISE_TIREOTOXICA.map((d) => (
          <LinhaManual key={d.droga} nome={d.droga} texto={d.texto} pagina={d.pagina} errata={d.errata} conta={conta[d.droga] && <strong>{conta[d.droga]}</strong>}
            // os números vêm do texto do item (teste em ampolas.test.ts): metoprolol 5 mg IV; dexametasona 2–4 mg EV
            extra={d.droga === 'Metoprolol' ? <EscolhaDaAmpola chave="adulto-endocrino:metoprolol" dose={[5, 5]} unidade="mg" />
              : d.droga === 'Dexametasona' ? <EscolhaDaAmpola chave="adulto-endocrino:dexametasona" dose={[2, 4]} unidade="mg" /> : undefined} />
        ))}
        <Errata texto={ERRATA_ORDEM_IODO} />
        <p className="text-tinta-sussurro">Suporte: antitérmico (paracetamol; a Figura 1, p. 956, diz evitar AAS), hidratação, nutrição, oxigênio, tratamento de ICC e do fator desencadeante (Tabela 6, p. 955). O peso só entra na conta do esmolol.</p>
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_ENDOCRINO} />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        armadilhas={[
          ...DROGAS_CRISE_TIREOTOXICA.flatMap((d) => (d.errata ? [`${d.droga} — errata do livro: ${d.errata}`] : [])),
          ERRATA_ORDEM_IODO,
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaCriseTireotoxica}
        guia={guia}
        comparacao={
          // Tabela de comparação com o consenso europeu vai para "Evidências" (C6 = A); nenhuma dose do manual muda.
          <BlocoComparacao titulo="ETA/BTA/SfE 2026 — ao lado do manual" resumo="Consenso europeu de 2026 sobre tempestade tireoidiana (sem graduação), lido no texto integral. As doses e contas do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Consenso</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_TT.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_TT.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={peso > 0 ? `Adulto · ${numeroBr(peso)} kg` : 'Adulto · doses fixas do manual'}
        detalhe={esm ? `Esmolol ${faixaBr(esm.mgMin, 1)} mg/min; "Copiar" leva todas as drogas` : 'O peso só entra na conta do esmolol; "Copiar" leva todas as drogas'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
