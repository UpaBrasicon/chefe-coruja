import { useState } from 'react'

import {
  DOSES_CRISE, ETAPAS_CRISE, PIRIDOXINA, fichaCriseEpilepticaPediatrica, tempoMinimoFenitoina, tempoValproato, type EtapaCrise,
} from '@/clinico/pediatria/criseEpileptica'
import { calcularDose } from '@/clinico/pediatria/fonteP2'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { faixaTxt, num, pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'

/** Crise epiléptica e estado de mal na criança (livro do ICr, cap. 9). */
export function CriseEpilepticaPediatrica() {
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)

  const extra = (id: string) => {
    if (id === 'fenitoina' || id === 'fenitoina-cronico') {
      const d = calcularDose(DOSES_CRISE.find((x) => x.id === id)!, peso)
      if (!d) return undefined
      return <p>Tempo mínimo a 50 mg/min: <strong className="tabular-nums">{faixaTxt([tempoMinimoFenitoina(d.dose[0])!, tempoMinimoFenitoina(d.dose[1])!], 1)} min</strong></p>
    }
    if (id === 'valproato') {
      const a = tempoValproato(20)!
      const b = tempoValproato(40)!
      return <p>Tempo de infusão a 1,5–3 mg/kg/min: <strong className="tabular-nums">{num(a[0], 1)}–{num(a[1], 1)} min</strong> (20 mg/kg) · <strong className="tabular-nums">{num(b[0], 1)}–{num(b[1], 1)} min</strong> (40 mg/kg)</p>
    }
    return undefined
  }

  return (
    <ToolLayout
      title="Crise epiléptica — criança"
      description="Benzodiazepínicos, dose de ataque, fenobarbital e EME refratário por peso, com tempo de infusão — livro do ICr-HCFMUSP."
      ficha={fichaCriseEpilepticaPediatrica}
    >
      <LinhaReferencia texto="Crises com mais de 3 a 5 minutos são medicadas; chegando em crise, sem saber a duração, considera-se crise prolongada ou EME. Glicemia de ponta de dedo imediatamente." pagina="cap. 9, p. 126" />
      <CampoPesoRn id="crise-peso" peso={peso} setPeso={setPeso} rn={rn} setRn={setRn} />
      {rn ? (
        <>
          <AvisoRn />
          <LinhaReferencia rotulo="Crise neonatal — o que o livro traz" texto="Fenobarbital é a primeira escolha; levetiracetam e topiramato são alternativas (sem dose neonatal no capítulo). Corrigir hipoglicemia abaixo de 40 mg/dL. Piridoxina 50 a 100 mg/dose IV ou IM está indicada em recém-nascidos." pagina="cap. 9, p. 126–127" />
        </>
      ) : !pesoValido(peso) ? <PesoInvalido /> : (
        (Object.keys(ETAPAS_CRISE) as EtapaCrise[]).map((e) => (
          <Bloco key={e} titulo={ETAPAS_CRISE[e]}>
            {DOSES_CRISE.filter((d) => d.etapa === e).map((d) => <LinhaDose key={d.id} d={d} peso={peso} extra={extra(d.id)} />)}
            {e === 'suporte' && <LinhaReferencia rotulo="Piridoxina" texto={`${PIRIDOXINA.dose} — ${PIRIDOXINA.indicacao}.`} pagina={`cap. 9, ${PIRIDOXINA.pagina}`} />}
          </Bloco>
        ))
      )}
    </ToolLayout>
  )
}
