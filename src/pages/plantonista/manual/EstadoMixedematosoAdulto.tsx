import { useState } from 'react'

import { DIFERENCAS_MIXEDEMA, DIRETRIZ_MIXEDEMA, ERRATA_INVERNO, FORA_ENDOCRINO, NOTA_MIXEDEMA_PESO_IDADE, REPOSICAO_MIXEDEMA, SUPORTE_MIXEDEMA, fichaMixedema, totaisMixedema } from '@/clinico/adulto/endocrino'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco } from './LoteAPecas'
import { faixaBr } from './loteAFormato'
import { LinhaManual } from './PecasLoteC'
import { Fora } from './PecasLoteE6'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Estado mixedematoso — reposição hormonal e suporte (cap. 71 do manual do HCFMUSP). */
export function EstadoMixedematosoAdulto() {
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaMixedema.id)
  const t = totaisMixedema()
  const conta: Record<string, string> = {
    'T3 + T4 combinadas': `T3 de manutenção: ${faixaBr(t.t3CombinadaUgDia, 0)} µg/dia`,
    Hidrocortisona: `${t.hidrocortisonaMgDia} mg/dia`,
  }
  return (
    <ToolLayout
      title="Estado mixedematoso — adulto"
      description="Doses de T4, T3 e hidrocortisona e medidas de suporte, como o manual do HCFMUSP traz. Escore diagnóstico em ferramenta própria. Adulto (14 anos ou mais)."
      ficha={fichaMixedema}
    >
      <Bloco titulo="Reposição hormonal" descricao={NOTA_MIXEDEMA_PESO_IDADE}>
        {REPOSICAO_MIXEDEMA.map((d) => (
          <LinhaManual key={d.droga} nome={d.droga} texto={d.texto} pagina={d.pagina} errata={d.errata} conta={conta[d.droga] && <strong>{conta[d.droga]}</strong>} />
        ))}
        <p className="text-tinta-sussurro">Via EV idealmente; com disponibilidade limitada, VO ou por sonda (p. 961).</p>
      </Bloco>

      <Bloco titulo="Suporte (Tabela 5)">
        {SUPORTE_MIXEDEMA.map((d) => <LinhaManual key={d.droga} nome={d.droga} texto={d.texto} pagina={d.pagina} />)}
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_ENDOCRINO} />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        armadilhas={[
          ...REPOSICAO_MIXEDEMA.flatMap((d) => (d.errata ? [`${d.droga} — errata do livro: ${d.errata}`] : [])),
          // Errata sem efeito em conta: sai da página para "Armadilhas" (C6 = A).
          ERRATA_INVERNO,
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaMixedema}
        guia={guia}
        comparacao={
          // Tabela de comparação com o consenso de 2026 vai para "Evidências" (C6 = A); nenhuma dose do manual muda.
          <BlocoComparacao titulo="Consenso 2026 — ao lado do manual" resumo="Coma mixedematoso pelo consenso conjunto de 2026 (BTA, ETA, SfE e WEDS), lido no texto integral; é consenso de especialistas, sem graduação. As doses e o escore do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_MIXEDEMA.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_MIXEDEMA.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      {/* Tela de referência sem dado para informar: o resumo nomeia o estado da tela, sem "Copiar". */}
      <ResumoFlutuante
        principal="Adulto · doses fixas do manual"
        detalhe="Nada é calculado por peso: T4, T3, hidrocortisona e suporte nas listas acima"
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
