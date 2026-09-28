import { DIRETRIZ_HSA_2023, METAS_HSA, NIMODIPINO, contaNimodipino, fichaHsaAdulto } from '@/clinico/adulto/hsa'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, LinhaManual } from './PecasLoteC'

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
          <table className="w-full min-w-[640px] text-left align-top text-sm">
            <thead className="text-muted-foreground"><tr><th className="pr-3 pb-2">Tema</th><th className="pr-3 pb-2">AHA/ASA 2023</th><th className="pr-3 pb-2">COR/LOE · p.</th><th className="pb-2">Manual do HC</th></tr></thead>
            <tbody>
              {DIRETRIZ_HSA_2023.map((d) => (
                <tr key={d.tema} className="border-t">
                  <td className="pr-3 py-2 font-medium">{d.tema}</td>
                  <td className="pr-3 py-2">{d.aha}</td>
                  <td className="pr-3 py-2 whitespace-nowrap text-muted-foreground">{d.classe} · {d.pagina}</td>
                  <td className="py-2 text-muted-foreground">{d.livro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
    </ToolLayout>
  )
}
