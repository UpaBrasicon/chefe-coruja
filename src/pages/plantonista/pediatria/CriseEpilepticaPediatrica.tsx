import { useState } from 'react'

import {
  DOSES_CRISE, ETAPAS_CRISE, PIRIDOXINA, fichaCriseEpilepticaPediatrica, tempoMinimoFenitoina, tempoValproato, type EtapaCrise,
} from '@/clinico/pediatria/criseEpileptica'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { calcularDose, type DosePeso } from '@/clinico/pediatria/fonteP2'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { faixaTxt, num, pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'

/** Linha do "Copiar" com a mesma conta da LinhaDose (dose, volume, máximo, via e página). */
function linhaCopia(d: DosePeso, peso: number, extra?: string): string[] {
  const r = calcularDose(d, peso)
  if (!r) return []
  return [`- ${d.nome}: ${faixaTxt(r.dose)} ${d.unidade}${r.volumeMl && d.unidade !== 'mL' ? ` · ${faixaTxt(r.volumeMl)} mL` : ''}${r.noMaximo ? ' (limitado ao máximo do livro)' : ''} · ${d.via}${extra ? ` · ${extra}` : ''} (Livro ICr, ${d.pagina})`]
}

/** Crise epiléptica e estado de mal na criança (livro do ICr, cap. 9). */
export function CriseEpilepticaPediatrica() {
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaCriseEpilepticaPediatrica.id)
  const calc = !rn && pesoValido(peso)

  const tempoFenitoina = (id: string) => {
    const d = calcularDose(DOSES_CRISE.find((x) => x.id === id)!, peso)
    return d ? [tempoMinimoFenitoina(d.dose[0])!, tempoMinimoFenitoina(d.dose[1])!] as [number, number] : null
  }

  const extra = (id: string) => {
    if (id === 'fenitoina' || id === 'fenitoina-cronico') {
      const t = tempoFenitoina(id)
      if (!t) return undefined
      return <p>Tempo mínimo a 50 mg/min: <strong className="tabular-nums">{faixaTxt(t, 1)} min</strong></p>
    }
    if (id === 'valproato') {
      const a = tempoValproato(20)!
      const b = tempoValproato(40)!
      return <p>Tempo de infusão a 1,5–3 mg/kg/min: <strong className="tabular-nums">{num(a[0], 1)}–{num(a[1], 1)} min</strong> (20 mg/kg) · <strong className="tabular-nums">{num(b[0], 1)}–{num(b[1], 1)} min</strong> (40 mg/kg)</p>
    }
    return undefined
  }

  const extraCopia = (id: string) => {
    if (id === 'fenitoina' || id === 'fenitoina-cronico') {
      const t = tempoFenitoina(id)
      return t ? `tempo mínimo a 50 mg/min: ${faixaTxt(t, 1)} min` : undefined
    }
    if (id === 'valproato') {
      const a = tempoValproato(20)!
      const b = tempoValproato(40)!
      return `infusão a 1,5–3 mg/kg/min: ${num(a[0], 1)}–${num(a[1], 1)} min (20 mg/kg) · ${num(b[0], 1)}–${num(b[1], 1)} min (40 mg/kg)`
    }
    return undefined
  }

  // Texto do "Copiar" (C3 e C4 = A): a lista inteira de doses do peso, por etapa, com a página do livro.
  const copia = () =>
    textoCopia({
      ferramenta: 'Crise epiléptica — criança',
      dados: [['Peso', `${numeroBr(peso)} kg`]],
      resultado: (Object.keys(ETAPAS_CRISE) as EtapaCrise[]).flatMap((e) => [
        `${ETAPAS_CRISE[e]}:`,
        ...DOSES_CRISE.filter((d) => d.etapa === e).flatMap((d) => linhaCopia(d, peso, extraCopia(d.id))),
        ...(e === 'suporte' ? [`- Piridoxina: ${PIRIDOXINA.dose} — ${PIRIDOXINA.indicacao} (Livro ICr, cap. 9, ${PIRIDOXINA.pagina})`] : []),
      ]),
      fonte: textoFontes(fichaCriseEpilepticaPediatrica),
      versao: fichaCriseEpilepticaPediatrica.versao,
      quando: new Date(),
    })

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
            {DOSES_CRISE.filter((d) => d.etapa === e).map((d) => <LinhaDose key={d.id} d={d} peso={peso} extra={extra(d.id)} ampola={`crise:${d.id}`} />)}
            {e === 'suporte' && <LinhaReferencia rotulo="Piridoxina" texto={`${PIRIDOXINA.dose} — ${PIRIDOXINA.indicacao}.`} pagina={`cap. 9, ${PIRIDOXINA.pagina}`} />}
          </Bloco>
        ))
      )}
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc}
        armadilhas={[...DOSES_CRISE.filter((d) => d.errata).map((d) => `${d.nome} — errata do livro (${d.pagina}): ${d.errata}`), ...(guia?.armadilhas ?? [])]}
        ficha={fichaCriseEpilepticaPediatrica}
        guia={guia}
      />
      <ResumoFlutuante
        principal={rn ? 'Recém-nascido: a ferramenta não calcula dose' : calc ? `Criança · ${numeroBr(peso)} kg` : 'Informe o peso'}
        detalhe={calc ? 'Doses do peso nas listas acima; "Copiar" leva todas.' : undefined}
        textoCopia={calc ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
