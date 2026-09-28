import { METAS_HSA, NIMODIPINO, contaNimodipino, fichaHsaAdulto } from '@/clinico/adulto/hsa'
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
    </ToolLayout>
  )
}
