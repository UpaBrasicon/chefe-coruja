import { useState } from 'react'

import { DIFERENCAS_TT, DIRETRIZ_TT, DROGAS_CRISE_TIREOTOXICA, ERRATA_ORDEM_IODO, FORA_ENDOCRINO, esmololMgMin, fichaCriseTireotoxica, totaisTireotoxica } from '@/clinico/adulto/endocrino'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { Bloco } from './LoteAPecas'
import { faixaBr } from './loteAFormato'
import { CampoPeso, LinhaManual } from './PecasLoteC'
import { Errata, Fora } from './PecasLoteE6'

/** Crise tireotóxica — drogas (cap. 70 do manual do HCFMUSP). */
export function CriseTireotoxicaAdulto() {
  const [peso, setPeso] = useState(0)
  const t = totaisTireotoxica()
  const esm = esmololMgMin(peso)

  const conta: Record<string, string> = {
    Propiltiouracil: `${faixaBr(t.ptuManutencaoMgDia, 0)} mg/dia pela conta; ${faixaBr(t.ptuEscritoMgDia, 0)} escrito`,
    Metimazol: `${faixaBr(t.metimazolMgDia, 0)} mg/dia`,
    'Ácido iopanoico': `${t.iopanoicoD1G} g no 1º dia`,
    'Propranolol VO': `${faixaBr(t.propranololVoMgDia, 0)} mg/dia (dose habitual)`,
    Esmolol: esm ? `${faixaBr(esm.mgMin, 1)} mg/min (${faixaBr(esm.mgH, 0)} mg/h)` : 'informe o peso',
    Hidrocortisona: `${t.hidrocortisonaMgDia} mg/dia`,
    Dexametasona: `${faixaBr(t.dexametasonaMgDia, 0)} mg/dia`,
  }

  return (
    <ToolLayout
      title="Crise tireotóxica — adulto"
      description="Tionamidas, iodo, lítio, betabloqueadores e corticoide com doses e totais diários, como o manual do HCFMUSP traz. Burch-Wartofsky em ferramenta própria. Adulto (14 anos ou mais)."
      ficha={fichaCriseTireotoxica}
    >
      <CampoPeso id="ct-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Drogas da crise tireotóxica" descricao="Cap. 70, p. 953–954. O capítulo não traz diluição (sem mL/h).">
        {DROGAS_CRISE_TIREOTOXICA.map((d) => (
          <LinhaManual key={d.droga} nome={d.droga} texto={d.texto} pagina={d.pagina} errata={d.errata} conta={conta[d.droga] && <strong>{conta[d.droga]}</strong>} />
        ))}
        <Errata texto={ERRATA_ORDEM_IODO} />
        <p className="text-tinta-sussurro">Suporte: antitérmico (paracetamol; a Figura 1, p. 956, diz evitar AAS), hidratação, nutrição, oxigênio, tratamento de ICC e do fator desencadeante (Tabela 6, p. 955). O peso só entra na conta do esmolol.</p>
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_ENDOCRINO} />
      </Bloco>
      <Bloco titulo="ETA/BTA/SfE 2026 — ao lado do manual" descricao="Consenso europeu de 2026 sobre tempestade tireoidiana (sem graduação), lido no texto integral. As doses e contas do manual acima continuam valendo.">
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
            <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Consenso</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
            <TableBody>{DIRETRIZ_TT.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
        <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_TT.map((d) => <li key={d}>{d}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
