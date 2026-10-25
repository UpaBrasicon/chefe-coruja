import { useState, type ReactNode } from 'react'

import { AHA_2025_PCR, CHOQUE_PCR, DIRETRIZ_ALS_2025, DROGAS_PCR, KCL_ATAQUE_MEQ, calcularPcr, fichaPcrAdulto, lidocainaSegundaDoseMg, type Faixa } from '@/clinico/adulto/pcr'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { numero } from '@/lib/formato'

const br = (x: number, casas = 1) => numero(Math.round(x * 10 ** casas) / 10 ** casas)
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

/** Drogas e cargas de choque na PCR do adulto (cap. 2 do manual do HCFMUSP). */
export function PcrAdulto() {
  const [peso, setPeso] = useState(0)
  const r = calcularPcr(peso)
  const lido2 = lidocainaSegundaDoseMg(peso)
  const semPeso = 'informe o peso'

  const conta: Record<string, ReactNode> = {
    lidocaina: r ? <strong>{faixa(r.lidocainaMg, 0)} mg</strong> : semPeso,
    bicarbonato: r ? <><strong>{faixa(r.bicarbonatoMEq, 0)} mEq</strong> · adicional {faixa(r.bicarbonatoAdicionalMEq, 0)} mEq</> : semPeso,
    emulsao: r ? <><strong>{br(r.emulsaoBolusMl, 0)} mL</strong> em 1 min · {br(r.emulsaoMlMin)} mL/min ({br(r.emulsaoMlH, 0)} mL/h) · {faixa(r.emulsaoInfusaoMl, 0)} mL em 30–60 min</> : semPeso,
    kcl: <><strong>{KCL_ATAQUE_MEQ} mEq</strong> em 10 min</>,
  }

  return (
    <ToolLayout
      title="PCR — drogas e desfibrilação (adulto)"
      description="Tabela 2 do manual do HC com as doses por peso calculadas, a carga do choque e a AHA 2025 ao lado. Adulto (14 anos ou mais)."
      ficha={fichaPcrAdulto}
    >
      <CampoPeso id="pcr-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Desfibrilação" descricao="FV e TV sem pulso.">
        <LinhaManual
          nome="Carga do choque"
          texto={`${CHOQUE_PCR.monofasicoJ} J se monofásico; ${CHOQUE_PCR.bifasicoJ} J ou a carga indicada pelo fabricante se bifásico; choque único e retorno imediato à RCP`}
          conta={<><strong>{CHOQUE_PCR.monofasicoJ} J</strong> mono · <strong>{CHOQUE_PCR.bifasicoJ} J</strong> bi</>}
          pagina={CHOQUE_PCR.pagina}
        />
      </Bloco>

      <Bloco titulo="Medicações (Tabela 2)">
        {DROGAS_PCR.map((d) => (
          <LinhaManual key={d.id} nome={d.nome} texto={`${d.dose} — ${d.quando}`} conta={conta[d.id]} pagina={d.pagina} errata={d.errata} nota={d.nota} />
        ))}
      </Bloco>

      <Bloco titulo="AHA 2025 × manual do HC" descricao="Part 9 da AHA 2025, lido no texto integral publicado pela AHA; entre parênteses, a classe da recomendação.">
        <LinhaManual
          origem="A AHA traz"
          nome="Lidocaína — segunda dose"
          texto={`${faixa(AHA_2025_PCR.lidocainaMgKg.segunda, 2)} mg/kg IV/IO, depois da primeira de ${faixa(AHA_2025_PCR.lidocainaMgKg.primeira)} mg/kg; o manual traz só a primeira`}
          conta={lido2 ? <strong>{faixa(lido2)} mg</strong> : semPeso}
          pagina={AHA_2025_PCR.pagina}
        />
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
            <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">AHA 2025</TableHead><TableHead className="pr-3 pb-2">Onde</TableHead><TableHead className="pb-2">Manual do HC</TableHead></TableRow></TableHeader>
            <TableBody>
              {DIRETRIZ_ALS_2025.map((d) => (
                <TableRow key={d.tema} className="border-t">
                  <TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell>
                  <TableCell className="pr-3 py-2">{d.aha}</TableCell>
                  <TableCell className="pr-3 py-2 whitespace-nowrap text-tinta-sussurro">{d.onde}</TableCell>
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
