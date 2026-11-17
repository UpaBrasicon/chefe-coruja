import { useState } from 'react'

import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { calcularDose, type DosePeso } from '@/clinico/pediatria/fonteP2'
import { DOSES_TCE, METAS_TCE, fichaTcePediatrico } from '@/clinico/pediatria/tceDecisao'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { faixaTxt, pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'

/** Linha do "Copiar" com a mesma conta da LinhaDose (PecasP2). */
function linhaDose(d: DosePeso, peso: number): string[] {
  const r = calcularDose(d, peso)
  if (!r) return []
  return [`- ${d.nome}: ${faixaTxt(r.dose)} ${d.unidade}${r.volumeMl && d.unidade !== 'mL' ? ` · ${faixaTxt(r.volumeMl)} mL` : ''}${r.noMaximo ? ' (limitado ao máximo do livro)' : ''} · ${d.via} (Livro ICr, ${d.pagina})`]
}

/** TCE grave na criança: terapia hiperosmolar por peso e metas (livro do ICr, cap. 16). */
export function TcePediatrico() {
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaTcePediatrico.id)
  const calc = !rn && pesoValido(peso)

  // Texto do "Copiar" (C3 e C4 = A): o peso, a terapia hiperosmolar e as metas do capítulo, com a página.
  const copia = calc
    ? textoCopia({
        ferramenta: 'TCE grave — criança',
        dados: [['Peso', `${numeroBr(peso)} kg`]],
        resultado: [
          'Terapia hiperosmolar (p. 179):',
          ...DOSES_TCE.flatMap((d) => linhaDose(d, peso)),
          'Metas e critérios do capítulo:',
          ...METAS_TCE.map((m) => `- ${m.texto} (cap. 16, ${m.pagina})`),
        ],
        fonte: textoFontes(fichaTcePediatrico),
        versao: fichaTcePediatrico.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="TCE grave — criança"
      description="NaCl 3% e manitol por peso, e as metas do capítulo (PaCO₂, PIC, PPC, osmolaridade) — livro do ICr-HCFMUSP."
      ficha={fichaTcePediatrico}
    >
      <CampoPesoRn id="tce-peso" peso={peso} setPeso={setPeso} rn={rn} setRn={setRn} />
      {rn ? <AvisoRn /> : !pesoValido(peso) ? <PesoInvalido /> : (
        <Bloco titulo="Terapia hiperosmolar (p. 179)">
          {DOSES_TCE.map((d) => <LinhaDose key={d.id} d={d} peso={peso} />)}
        </Bloco>
      )}
      <Bloco titulo="Metas e critérios do capítulo">
        {METAS_TCE.map((m) => <LinhaReferencia key={m.texto} texto={m.texto} pagina={`cap. 16, ${m.pagina}`} />)}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc}
        armadilhas={[...DOSES_TCE.filter((d) => d.errata).map((d) => `${d.nome} — errata do livro (${d.pagina}): ${d.errata}`), ...(guia?.armadilhas ?? [])]}
        ficha={fichaTcePediatrico}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(peso)} kg` : rn ? 'Recém-nascido: sem valor neonatal no capítulo' : 'Informe o peso'}
        detalhe={calc ? 'NaCl 3% e manitol do peso na lista acima; "Copiar" leva doses e metas.' : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
