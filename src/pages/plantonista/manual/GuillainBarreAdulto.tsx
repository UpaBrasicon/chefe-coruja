import { useState } from 'react'

import { AAN_SGB, DIRETRIZ_SGB_2023, IGIV_SGB, PLASMAFERESE_SGB, RED_FLAGS_SGB, contaImunoterapiaSgb, fichaSgbAdulto, lerLcrSgb } from '@/clinico/adulto/guillainBarre'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { br } from './loteE7Formato'

/** Síndrome de Guillain-Barré: imunoterapia por peso, LCR e AAN (cap. 44 do manual do HCFMUSP). */
export function GuillainBarreAdulto() {
  const [peso, setPeso] = useState(0)
  const [proteina, setProteina] = useState(0)
  const [celulas, setCelulas] = useState(0)
  const [lcrInformado, setLcrInformado] = useState(false)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaSgbAdulto.id)
  const c = contaImunoterapiaSgb(peso)
  const lcr = lcrInformado ? lerLcrSgb(proteina, celulas) : null

  // Texto do "Copiar" (C3/C4 = A): peso, imunoterapia com as contas e a leitura do liquor.
  const copia = c || lcr
    ? textoCopia({
        ferramenta: 'Síndrome de Guillain-Barré — imunoterapia e LCR (adulto)',
        dados: [
          ['Peso', c ? `${numeroBr(peso)} kg` : ''],
          ['Proteína no liquor', lcr ? `${numeroBr(proteina)} mg/dL` : ''],
          ['Células no liquor', lcr ? `${numeroBr(celulas)} /mm³` : ''],
        ],
        resultado: [
          ...(c
            ? [
                `Imunoglobulina intravenosa: ${br(IGIV_SGB.gKgDia)} g/kg/dia durante ${IGIV_SGB.dias} dias = ${br(c.igivGDia)} g/dia · total ${br(c.igivGTotal)} g (${IGIV_SGB.pagina})`,
                `Plasmaférese: ${PLASMAFERESE_SGB.mlKgTotal} mL/kg em ${PLASMAFERESE_SGB.sessoes} sessões em ${PLASMAFERESE_SGB.intervalo} = ${br(c.plasmaMlSessao, 0)} mL/sessão · total ${br(c.plasmaMlTotal, 0)} mL (${PLASMAFERESE_SGB.pagina})`,
              ]
            : []),
          ...(lcr ? lcr.achados.map((a) => `Liquor: ${a}`) : []),
        ],
        fonte: textoFontes(fichaSgbAdulto),
        versao: fichaSgbAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Síndrome de Guillain-Barré — imunoterapia e LCR (adulto)"
      description="Imunoglobulina e plasmaférese por peso, leitura do liquor e recomendações da AAN, pelo manual do HC. Critérios de ventilação, escore de incapacidade e EGOS estão em ferramentas próprias. Adulto (14 anos ou mais)."
      ficha={fichaSgbAdulto}
    >
      <CampoPeso id="sgb-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Imunoterapia (p. 604)" descricao="Resultados equivalentes; benefício demonstrado até 4 semanas do início dos sintomas; sem evidência do uso concomitante.">
        <LinhaManual
          nome="Imunoglobulina intravenosa"
          texto={`${br(IGIV_SGB.gKgDia)} g/kg/dia durante ${IGIV_SGB.dias} dias consecutivos`}
          conta={c ? <><strong>{br(c.igivGDia)} g/dia</strong> · total {br(c.igivGTotal)} g</> : 'informe o peso'}
          pagina={IGIV_SGB.pagina}
        />
        <LinhaManual
          nome="Plasmaférese"
          texto={`${PLASMAFERESE_SGB.mlKgTotal} mL/kg divididos em ${PLASMAFERESE_SGB.sessoes} sessões em ${PLASMAFERESE_SGB.intervalo}`}
          conta={c ? <><strong>{br(c.plasmaMlSessao, 0)} mL/sessão</strong> · total {br(c.plasmaMlTotal, 0)} mL</> : 'informe o peso'}
          pagina={PLASMAFERESE_SGB.pagina}
        />
      </Bloco>

      <Bloco titulo="Recomendações da AAN (2003) — Tabela 6 (p. 605–606)">
        {AAN_SGB.map((a) => <LinhaManual key={a.terapia + a.texto} nome={`${a.terapia} (${a.nivel})`} texto={a.texto} pagina="p. 605–606" />)}
      </Bloco>

      <Bloco titulo="Liquor (p. 603–604)">
        <div className="grid gap-3 md:grid-cols-2">
          <NumberField id="sgb-prot" label="Proteína" unit="mg/dL" value={proteina} onChange={(v) => { setProteina(v); setLcrInformado(true) }} min={0} />
          <NumberField id="sgb-cel" label="Células" unit="/mm³" value={celulas} onChange={(v) => { setCelulas(v); setLcrInformado(true) }} min={0} />
        </div>
        {lcr ? <ul className="list-disc pl-5 text-apoio">{lcr.achados.map((a) => <li key={a}>{a}</li>)}</ul> : <p className="text-apoio text-tinta-sussurro">Informe proteína e células.</p>}
        <p className="text-apoio font-medium">Red flags para diagnóstico alternativo (p. 603–604)</p>
        <ul className="list-disc pl-5 text-apoio">{RED_FLAGS_SGB.map((r) => <li key={r}>{r}</li>)}</ul>
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!c && !lcr}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaSgbAdulto}
        guia={guia}
        comparacao={
          // Tabela de comparação com a EAN/PNS 2023 vai para "Evidências" (C6 = A); nenhuma dose do manual muda.
          <BlocoComparacao titulo="EAN/PNS 2023 — ao lado do manual" resumo="Diretriz europeia de 2023 (GRADE), lida no resumo. As doses e contas do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_SGB_2023.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={c ? `Adulto · ${numeroBr(peso)} kg` : 'Informe o peso'}
        detalhe={
          c
            ? `IGIV ${br(c.igivGDia)} g/dia · plasmaférese ${br(c.plasmaMlSessao, 0)} mL/sessão`
            : lcr?.achados[0]
        }
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
