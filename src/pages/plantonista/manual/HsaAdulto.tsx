import { useState } from 'react'

import { DIRETRIZ_HSA_2023, METAS_HSA, NIMODIPINO, contaNimodipino, fichaHsaAdulto } from '@/clinico/adulto/hsa'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, LinhaManual } from './PecasLoteC'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** HSA não traumática: nimodipino e metas numéricas (cap. 40 do manual do HCFMUSP). */
export function HsaAdulto() {
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaHsaAdulto.id)
  const n = contaNimodipino()
  return (
    <ToolLayout
      title="Hemorragia subaracnóidea — nimodipino e metas (adulto)"
      description="Nimodipino por 21 dias e as metas numéricas do capítulo (Hb, PAS, PIC, PPC, pCO2, vasoespasmo). As escalas (Ottawa, Hunt-Hess, WFNS, Fisher) estão em ferramentas próprias. Adulto (14 anos ou mais)."
      ficha={fichaHsaAdulto}
    >
      <Bloco titulo="Nimodipino (p. 560)" descricao="Em todos os pacientes; não reduz comprovadamente o vasoespasmo, mas se relaciona a melhor prognóstico neurológico.">
        <LinhaManual
          nome="Nimodipino"
          texto={`${NIMODIPINO.mg} mg ${NIMODIPINO.via} a cada ${NIMODIPINO.intervaloH} horas por ${NIMODIPINO.dias} dias`}
          conta={<><strong>{n.dosesDia} doses/dia = {n.mgDia} mg/dia</strong> · {n.dosesTotais} doses em {NIMODIPINO.dias} dias</>}
          pagina={NIMODIPINO.pagina}
        />
      </Bloco>
      <Bloco titulo="Metas e números do capítulo (p. 558–561)">
        {METAS_HSA.map((m) => <LinhaManual key={m.alvo} nome={m.alvo} texto={m.valor} pagina={m.pagina} />)}
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaHsaAdulto}
        guia={guia}
        comparacao={
          // Tabela de comparação com a AHA/ASA 2023 vai para "Evidências" (C6 = A), como na PCR do lote 1; nenhuma dose do manual muda.
          <BlocoComparacao titulo="AHA/ASA 2023 × manual do HC" resumo="Diretriz da HSA aneurismática (Stroke 2023;54:e314–e370), lida no texto; classe e nível como impressos. O que muda: antifibrinolítico sem benefício, PA sem alvo numérico, fenitoína danosa, hipervolemia danosa.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">AHA/ASA 2023</TableHead><TableHead className="pr-3 pb-2">COR/LOE · p.</TableHead><TableHead className="pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>
                  {DIRETRIZ_HSA_2023.map((d) => (
                    <TableRow key={d.tema} className="border-t">
                      <TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell>
                      <TableCell className="pr-3 py-2">
                        {d.aha}
                        {d.nota && <p role="note" className="mt-2 rounded-controle border border-atencao/40 bg-alerta-atencao px-2 py-1 text-rotulo text-atencao">{d.nota}</p>}
                      </TableCell>
                      <TableCell className="pr-3 py-2 whitespace-nowrap text-tinta-sussurro">{d.classe} · {d.pagina}</TableCell>
                      <TableCell className="py-2 text-tinta-sussurro">{d.livro}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </BlocoComparacao>
        }
      />
      {/* Tela de referência sem dado para informar: o resumo nomeia o estado da tela, sem "Copiar". */}
      <ResumoFlutuante
        principal="Adulto · nimodipino e metas do manual"
        detalhe={`Nimodipino ${NIMODIPINO.mg} mg a cada ${NIMODIPINO.intervaloH} h por ${NIMODIPINO.dias} dias = ${n.mgDia} mg/dia`}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
