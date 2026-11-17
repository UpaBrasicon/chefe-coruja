import { useState } from 'react'

import {
  CHOQUE_SEPTICO_REFRATARIO, CRISE_ADRENAL, DIFERENCAS_IA, DIRETRIZ_IA, DIVERGENCIA_FIGURA_IA, FORA_ENDOCRINO, fichaInsuficienciaAdrenal, leituraCortisolActh, leituraCortisolBasal,
  totaisCriseAdrenal, volumeCriseAdrenal,
} from '@/clinico/adulto/endocrino'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Bloco, Resultado, Trecho } from './LoteAPecas'
import { faixaBr } from './loteAFormato'
import { CampoPeso, LinhaManual } from './PecasLoteC'
import { Errata, Fora } from './PecasLoteE6'

/** Insuficiência adrenal e crise adrenal (cap. 72 do manual do HCFMUSP). */
export function InsuficienciaAdrenalAdulto() {
  const [peso, setPeso] = useState(0)
  const [basal, setBasal] = useState(0)
  const [acth, setActh] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaInsuficienciaAdrenal.id)
  const lb = basal > 0 ? leituraCortisolBasal(basal) : null
  const la = acth > 0 ? leituraCortisolActh(acth) : null
  const t = totaisCriseAdrenal()
  const vol = volumeCriseAdrenal(peso)
  const C = CRISE_ADRENAL
  const temDado = basal > 0 || acth > 0 || peso > 0

  // Texto do "Copiar" (C3/C4 = A): leitura do cortisol e a lista inteira da crise adrenal e do choque refratário.
  const copia = temDado
    ? textoCopia({
        ferramenta: 'Insuficiência adrenal e crise adrenal — adulto',
        dados: [
          ['Peso', peso > 0 ? `${numeroBr(peso)} kg` : ''],
          ['Cortisol basal', basal > 0 ? `${numeroBr(basal)} µg/dL` : ''],
          ['Cortisol 30 min após ACTH', acth > 0 ? `${numeroBr(acth)} µg/dL` : ''],
        ],
        resultado: [
          ...(lb ? [`Cortisol basal: ${lb.texto} (${lb.pagina})`] : []),
          ...(la ? [`Após ACTH: ${la.texto} (${la.pagina})`] : []),
          `Crise adrenal — hidrocortisona: ${C.hidrocortisonaAtaqueMg} mg EV; depois 50–100 mg EV 6/6 h = ${faixaBr(t.hidrocortisonaMgDia, 0)} mg/dia; após 48–72 h, reduzir até a habitual (${C.habitual}) (cap. 72, p. 969)`,
          `Crise adrenal — fludrocortisona: ${C.fludrocortisona.ug} µg 8/8 h = ${t.fludrocortisonaUgDia} µg/dia (cap. 72, p. 969)`,
          `Volume: até ${C.volumeLH} L/h de cristaloide no início (texto, p. 969)${vol ? `; Figura 1 (20–30 mL/kg, p. 971): ${faixaBr(vol.figuraMl, 0)} mL` : ''}`,
          `Hipoglicemia: ${C.glicose.replace('hipoglicemia: ', '')} (p. 969)`,
          `Choque séptico refratário — hidrocortisona: ${CHOQUE_SEPTICO_REFRATARIO.hidrocortisonaMg} mg 6/6 h = ${t.hidrocortisonaChoqueMgDia} mg/dia (${CHOQUE_SEPTICO_REFRATARIO.pagina})`,
          `Choque séptico refratário — fludrocortisona: impresso "${CHOQUE_SEPTICO_REFRATARIO.fludrocortisonaImpresso}", sem conta. Errata: ${CHOQUE_SEPTICO_REFRATARIO.errata}`,
        ],
        fonte: textoFontes(fichaInsuficienciaAdrenal),
        versao: fichaInsuficienciaAdrenal.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Insuficiência adrenal e crise adrenal — adulto"
      description="Cortes do cortisol basal e após ACTH, hidrocortisona, fludrocortisona e volume, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaInsuficienciaAdrenal}
    >
      <CampoPeso id="ia-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Cortisol" descricao="Coleta às 8 h; teste com ACTH 250 µg EV ou IM e cortisol 30 min depois (p. 969).">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="ia-basal" label="Cortisol basal" unit="µg/dL" value={basal} onChange={setBasal} step={0.1} />
          <NumberField id="ia-acth" label="Cortisol 30 min após ACTH" unit="µg/dL" value={acth} onChange={setActh} step={0.1} />
        </div>
        {lb && <Trecho texto={lb.texto} pagina={lb.pagina} />}
        {la && <Trecho texto={la.texto} pagina={la.pagina} />}
        <p className="text-tinta-sussurro">{DIVERGENCIA_FIGURA_IA}</p>
      </Bloco>

      <Bloco titulo="Crise adrenal aguda" descricao={`${C.pagina}.`}>
        <LinhaManual nome="Hidrocortisona" texto={`dose inicial de ${C.hidrocortisonaAtaqueMg} mg EV, seguida de 50–100 mg EV a cada 6 horas; após 48–72 h, reduzir até a habitual (${C.habitual})`} pagina="cap. 72, p. 969"
          conta={<strong>{C.hidrocortisonaAtaqueMg} mg; depois {faixaBr(t.hidrocortisonaMgDia, 0)} mg/dia</strong>} />
        <LinhaManual nome="Fludrocortisona (flúor-hidrocortisona)" texto={C.fludrocortisona.texto} pagina="cap. 72, p. 969"
          conta={<strong>{C.fludrocortisona.ug} µg 8/8 h = {t.fludrocortisonaUgDia} µg/dia</strong>} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Resultado rotulo="Volume no texto (p. 969)" valor={`até ${C.volumeLH} L/h de cristaloide no início`} />
          <Resultado rotulo="Volume na Figura 1 (20–30 mL/kg, p. 971)" valor={vol ? `${faixaBr(vol.figuraMl, 0)} mL` : 'informe o peso'} />
        </div>
        <p>Hipoglicemia: {C.glicose.replace('hipoglicemia: ', '')} (p. 969).</p>
      </Bloco>

      <Bloco titulo="Choque séptico refratário a vasoativos" descricao={CHOQUE_SEPTICO_REFRATARIO.cruzamento}>
        <LinhaManual nome="Hidrocortisona" texto={`${CHOQUE_SEPTICO_REFRATARIO.hidrocortisonaMg} mg de 6/6 horas`} pagina={CHOQUE_SEPTICO_REFRATARIO.pagina}
          conta={<strong>{t.hidrocortisonaChoqueMgDia} mg/dia</strong>} />
        <LinhaManual nome="Fludrocortisona" texto={`impresso: "${CHOQUE_SEPTICO_REFRATARIO.fludrocortisonaImpresso}"`} pagina={CHOQUE_SEPTICO_REFRATARIO.pagina} conta="sem conta" />
        <Errata texto={CHOQUE_SEPTICO_REFRATARIO.errata} />
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_ENDOCRINO} />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temDado}
        armadilhas={[
          `Fludrocortisona no choque refratário — errata do livro: ${CHOQUE_SEPTICO_REFRATARIO.errata}`,
          DIVERGENCIA_FIGURA_IA,
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaInsuficienciaAdrenal}
        guia={guia}
        comparacao={
          // Tabela de comparação com as diretrizes vai para "Evidências" (C6 = A); nenhuma dose do manual muda.
          <BlocoComparacao titulo="Endocrine Society 2016, SfE 2016 e ESE/ES 2024 — ao lado do manual" resumo="Insuficiência adrenal primária (Endocrine Society 2016; GRADE), crise adrenal (Society for Endocrinology 2016) e insuficiência induzida por glicocorticoide (ESE/ES 2024), lidas no texto integral; só o adulto. As doses e contas do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_IA.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_IA.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={basal > 0 ? `Cortisol basal ${numeroBr(basal)} µg/dL` : acth > 0 ? `Cortisol após ACTH ${numeroBr(acth)} µg/dL` : peso > 0 ? `Adulto · ${numeroBr(peso)} kg` : 'Informe o cortisol ou o peso'}
        detalhe={la && basal > 0 ? `Após ACTH: ${la.texto}` : lb ? lb.texto : la ? la.texto : vol ? `Volume na Figura 1: ${faixaBr(vol.figuraMl, 0)} mL; "Copiar" leva a lista da crise adrenal` : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
