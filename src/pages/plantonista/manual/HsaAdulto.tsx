import { DIRETRIZ_HSA_2023, METAS_HSA, NIMODIPINO, contaNimodipino, fichaHsaAdulto } from '@/clinico/adulto/hsa'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, LinhaManual } from './PecasLoteC'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** HSA não traumática: nimodipino e metas numéricas (cap. 40 do manual do HCFMUSP). */
export function HsaAdulto() {
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
      <Bloco titulo="AHA/ASA 2023 × manual do HC" descricao="Diretriz da HSA aneurismática (Stroke 2023;54:e314–e370), lida no texto; classe e nível como impressos. O que muda: antifibrinolítico sem benefício, PA sem alvo numérico, fenitoína danosa, hipervolemia danosa.">
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
            <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">AHA/ASA 2023</TableHead><TableHead className="pr-3 pb-2">COR/LOE · p.</TableHead><TableHead className="pb-2">Manual do HC</TableHead></TableRow></TableHeader>
            <TableBody>
              {DIRETRIZ_HSA_2023.map((d) => (
                <TableRow key={d.tema} className="border-t">
                  <TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell>
                  <TableCell className="pr-3 py-2">{d.aha}</TableCell>
                  <TableCell className="pr-3 py-2 whitespace-nowrap text-tinta-sussurro">{d.classe} · {d.pagina}</TableCell>
                  <TableCell className="py-2 text-tinta-sussurro">{d.livro}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Bloco>
    </ToolLayout>
  )
}
