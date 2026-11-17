import { useState } from 'react'

import { DIRETRIZ_SSJ_NET_2025, DOSES_DERMATOSES, DOSES_FIXAS_DERMATOSES, ERRATA_DERMATOSES, dosesDermatoses, fichaDermatosesAdulto } from '@/clinico/adulto/dermatoses'
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
import { Erratas } from './PecasLoteE7'
import { br, faixa } from './loteE7Formato'

/** Dermatoses graves do adulto: doses por peso e fixas (cap. 96 do manual do HCFMUSP). */
export function DermatosesGravesAdulto() {
  const [peso, setPeso] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaDermatosesAdulto.id)
  const d = dosesDermatoses(peso)
  const D = DOSES_DERMATOSES

  // Texto do "Copiar" (C3/C4 = A): peso, doses por peso de SSJ/NET e DRESS e a lista de doses fixas do capítulo.
  const copia = d
    ? textoCopia({
        ferramenta: 'Dermatoses graves — doses (adulto)',
        dados: [['Peso', `${numeroBr(peso)} kg`]],
        resultado: [
          `- SSJ/NET, prednisona: ${D.ssjNetPrednisona.texto} = ${faixa(d.ssjNetPrednisonaMg, 0)} mg/dia (${D.ssjNetPrednisona.pagina})`,
          `- SSJ/NET, ciclosporina: ${D.ssjNetCiclosporina.texto} = ${faixa(d.ssjNetCiclosporinaMg, 0)} mg/dia (${D.ssjNetCiclosporina.pagina})`,
          `- DRESS, prednisona: ${D.dressPrednisona.texto}, até normalizar os exames e por 6-8 semanas depois = ${br(d.dressPrednisonaMg, 0)} mg/dia (${D.dressPrednisona.pagina})`,
          ...DOSES_FIXAS_DERMATOSES.map((x) => `- ${x.nome}: ${x.texto} (${x.pagina})`),
        ],
        fonte: textoFontes(fichaDermatosesAdulto),
        versao: fichaDermatosesAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Dermatoses graves — doses (adulto)"
      description="SSJ/NET e DRESS com doses por peso, farmacodermias leves, herpes-zóster, erisipela e celulite, pelo manual do HC. RegiSCAR e os itens do SCORTEN estão em ferramentas próprias. Adulto (14 anos ou mais)."
      ficha={fichaDermatosesAdulto}
    >
      <CampoPeso id="der-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="SSJ/NET e DRESS (p. 1282, 1285)">
        <LinhaManual nome="SSJ/NET — prednisona" texto={D.ssjNetPrednisona.texto} conta={d ? <strong>{faixa(d.ssjNetPrednisonaMg, 0)} mg/dia</strong> : 'informe o peso'} pagina={D.ssjNetPrednisona.pagina} />
        <LinhaManual nome="SSJ/NET — ciclosporina" texto={D.ssjNetCiclosporina.texto} conta={d ? <strong>{faixa(d.ssjNetCiclosporinaMg, 0)} mg/dia</strong> : 'informe o peso'} pagina={D.ssjNetCiclosporina.pagina} />
        <LinhaManual nome="DRESS — prednisona" texto={`${D.dressPrednisona.texto}, até normalizar os exames e por 6-8 semanas depois`} conta={d ? <strong>{br(d.dressPrednisonaMg, 0)} mg/dia</strong> : 'informe o peso'} pagina={D.dressPrednisona.pagina} />
      </Bloco>

      <Bloco titulo="Outras doses do capítulo (p. 1279–1292)">
        {DOSES_FIXAS_DERMATOSES.map((x) => <LinhaManual key={x.nome} nome={x.nome} texto={x.texto} pagina={x.pagina} />)}
      </Bloco>

      {/* A errata do aciclovir EV fala de dose: o bloco fica na página e também em "Armadilhas". */}
      <Bloco titulo="Errata e notas">
        <Erratas itens={ERRATA_DERMATOSES} />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!d}
        armadilhas={[...ERRATA_DERMATOSES, ...(guia?.armadilhas ?? [])]}
        ficha={fichaDermatosesAdulto}
        guia={guia}
        comparacao={
          // Tabela de comparação com a diretriz latino-americana vai para "Evidências" (C6 = A); nenhuma dose do manual muda.
          <BlocoComparacao titulo="SSJ/NET: diretriz latino-americana 2025 — ao lado do manual" resumo="Diretriz latino-americana de 2025, lida no texto integral. As doses do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_SSJ_NET_2025.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={d ? `Adulto · ${numeroBr(peso)} kg` : 'Informe o peso'}
        detalhe={d ? `SSJ/NET: prednisona ${faixa(d.ssjNetPrednisonaMg, 0)} mg/dia · DRESS: ${br(d.dressPrednisonaMg, 0)} mg/dia; "Copiar" leva todas as doses` : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
