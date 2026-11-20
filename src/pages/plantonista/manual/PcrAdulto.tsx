import { useState, type ReactNode } from 'react'

import { AHA_2025_PCR, CHOQUE_PCR, COSTR_2026_PCR, DIRETRIZ_ALS_2025, DROGAS_PCR, KCL_ATAQUE_MEQ, calcularPcr, fichaPcrAdulto, lidocainaSegundaDoseMg, type Faixa } from '@/clinico/adulto/pcr'
import { AMPOLAS_PCR_ADULTO, DOSES_FIXAS_PCR_ADULTO } from '@/clinico/adulto/ampolasAdulto'
import { textoFontes } from '@/clinico/ficha'
import { EscolhaDaAmpola } from '@/components/plantonista/calc/EscolhaDaAmpola'
import { CampoPesoAdulto } from '@/components/plantonista/calc/CampoNumero'
import { usePesoAdulto } from '@/components/plantonista/calc/pacienteNaFerramenta'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Bloco, LinhaManual } from './PecasLoteC'
import { numero } from '@/lib/formato'

const br = (x: number, casas = 1) => numero(Math.round(x * 10 ** casas) / 10 ** casas)
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

/** Drogas e cargas de choque na PCR do adulto (cap. 2 do manual do HCFMUSP). Piloto das calculadoras. */
export function PcrAdulto() {
  // Peso da Central (C5 = A) e trava da unidade de 30 a 250 kg (RT, 16/11/2026).
  const pesoAdulto = usePesoAdulto()
  const { peso, leitura, pesoConta } = pesoAdulto
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaPcrAdulto.id)
  const r = calcularPcr(pesoConta)
  const lido2 = lidocainaSegundaDoseMg(pesoConta)
  const semPeso = leitura === 'fora' ? 'confira o peso' : 'informe o peso'

  const conta: Record<string, ReactNode> = {
    lidocaina: r ? <strong>{faixa(r.lidocainaMg, 0)} mg</strong> : semPeso,
    bicarbonato: r ? <><strong>{faixa(r.bicarbonatoMEq, 0)} mEq</strong> · adicional {faixa(r.bicarbonatoAdicionalMEq, 0)} mEq</> : semPeso,
    emulsao: r ? <><strong>{br(r.emulsaoBolusMl, 0)} mL</strong> em 1 min · {br(r.emulsaoMlMin)} mL/min ({br(r.emulsaoMlH, 0)} mL/h) · {faixa(r.emulsaoInfusaoMl, 0)} mL em 30–60 min · máximo {br(r.emulsaoMaximoMl, 0)} mL (ERC 2021)</> : semPeso,
    kcl: <><strong>{KCL_ATAQUE_MEQ} mEq</strong> em 10 min</>,
  }

  // Dose em mL (pedido do RT de 19/11/2026): a ampola é escolhida na tela, nenhuma vem marcada.
  const fixa = (x: number): Faixa => [x, x]
  const ampola: Record<string, ReactNode> = {
    adrenalina: <EscolhaDaAmpola ampolas={AMPOLAS_PCR_ADULTO.adrenalina} dose={fixa(DOSES_FIXAS_PCR_ADULTO.adrenalinaMg)} unidade="mg" />,
    amiodarona: <EscolhaDaAmpola ampolas={AMPOLAS_PCR_ADULTO.amiodarona} unidade="mg" doses={[
      { rotulo: '1ª dose', dose: fixa(DOSES_FIXAS_PCR_ADULTO.amiodaronaMg.primeira) },
      { rotulo: '2ª dose', dose: fixa(DOSES_FIXAS_PCR_ADULTO.amiodaronaMg.segunda) },
    ]} />,
    lidocaina: r ? <EscolhaDaAmpola ampolas={AMPOLAS_PCR_ADULTO.lidocaina} dose={r.lidocainaMg} unidade="mg" /> : null,
    magnesio: <EscolhaDaAmpola ampolas={AMPOLAS_PCR_ADULTO.magnesio} dose={DOSES_FIXAS_PCR_ADULTO.magnesioG} unidade="g" />,
    bicarbonato: r ? <EscolhaDaAmpola ampolas={AMPOLAS_PCR_ADULTO.bicarbonato} unidade="mEq" doses={[
      { rotulo: 'Dose', dose: r.bicarbonatoMEq },
      { rotulo: 'Adicional', dose: r.bicarbonatoAdicionalMEq },
    ]} /> : null,
  }

  // Texto do "Copiar" (C4 = A): carga, drogas com a conta do peso e a página do manual.
  const contaTexto: Record<string, string | null> = {
    lidocaina: r ? `${faixa(r.lidocainaMg, 0)} mg` : null,
    bicarbonato: r ? `${faixa(r.bicarbonatoMEq, 0)} mEq · adicional ${faixa(r.bicarbonatoAdicionalMEq, 0)} mEq` : null,
    emulsao: r ? `${br(r.emulsaoBolusMl, 0)} mL em 1 min · ${br(r.emulsaoMlMin)} mL/min (${br(r.emulsaoMlH, 0)} mL/h) · ${faixa(r.emulsaoInfusaoMl, 0)} mL em 30–60 min · máximo ${br(r.emulsaoMaximoMl, 0)} mL (ERC 2021)` : null,
    kcl: `${KCL_ATAQUE_MEQ} mEq em 10 min`,
  }
  const copia = r
    ? textoCopia({
        ferramenta: 'PCR — drogas e desfibrilação (adulto)',
        dados: [['Peso', `${numeroBr(peso)} kg`]],
        resultado: [
          `Choque: ${CHOQUE_PCR.monofasicoJ} J monofásico; ${CHOQUE_PCR.bifasicoJ} J bifásico (${CHOQUE_PCR.pagina})`,
          ...DROGAS_PCR.map((d) => `- ${d.nome}: ${contaTexto[d.id] ?? d.dose} (${d.pagina})`),
          ...(lido2 ? [`- Lidocaína, segunda dose (AHA 2025): ${faixa(lido2)} mg (${AHA_2025_PCR.pagina})`] : []),
        ],
        fonte: textoFontes(fichaPcrAdulto),
        versao: fichaPcrAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="PCR — drogas e desfibrilação (adulto)"
      description="Tabela 2 do manual do HC com as doses por peso calculadas, a carga do choque e a AHA 2025 ao lado. Adulto (14 anos ou mais)."
      ficha={fichaPcrAdulto}
    >
      <Card>
        <CardContent className="pt-6">
          <CampoPesoAdulto id="pcr-peso" estado={pesoAdulto} className="max-w-xs" />
        </CardContent>
      </Card>

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
          <LinhaManual key={d.id} nome={d.nome} texto={`${d.dose} — ${d.quando}`} conta={conta[d.id]} pagina={d.pagina} extra={ampola[d.id]} />
        ))}
        <LinhaManual
          origem="A AHA 2025 traz"
          nome="Lidocaína — segunda dose"
          texto={`${faixa(AHA_2025_PCR.lidocainaMgKg.segunda, 2)} mg/kg IV/IO, depois da primeira de ${faixa(AHA_2025_PCR.lidocainaMgKg.primeira)} mg/kg; o manual traz só a primeira`}
          conta={lido2 ? <strong>{faixa(lido2)} mg</strong> : semPeso}
          pagina={AHA_2025_PCR.pagina}
        />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={leitura !== 'ok'}
        armadilhas={[
          ...DROGAS_PCR.flatMap((d) => [
            ...(d.errata ? [`${d.nome} — errata do livro: ${d.errata}`] : []),
            ...(d.nota ? [`${d.nome}: ${d.nota}`] : []),
          ]),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaPcrAdulto}
        guia={guia}
        comparacao={<>
      <BlocoComparacao titulo="AHA 2025 × manual do HC" resumo="Part 9 da AHA 2025, lido no texto integral publicado pela AHA; entre parênteses, a classe da recomendação.">
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full min-w-[560px] text-left align-top text-apoio">
            <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">AHA 2025</TableHead><TableHead className="pr-3 pb-2">Onde</TableHead><TableHead className="pb-2">Manual do HC</TableHead></TableRow></TableHeader>
            <TableBody>
              {DIRETRIZ_ALS_2025.map((d) => (
                <TableRow key={d.tema} className="border-t">
                  <TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell>
                  <TableCell className="pr-3 py-2">
                    {d.aha}
                    {d.nota && <p role="note" className="mt-2 rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{d.nota}</p>}
                  </TableCell>
                  <TableCell className="pr-3 py-2 whitespace-nowrap text-tinta-sussurro">{d.onde}</TableCell>
                  <TableCell className="py-2 text-tinta-sussurro">{d.livro}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </BlocoComparacao>

      <BlocoComparacao titulo="CoSTR 2026 do ILCOR — o que veio depois da AHA 2025" resumo="Revisão anual do ILCOR (Resuscitation 2026), lida na pré-publicação aberta; só o adulto. Nenhuma dose muda; entre parênteses, a força da recomendação e a certeza da evidência.">
        <ul className="flex flex-col gap-2">
          {COSTR_2026_PCR.map((c) => (
            <li key={c.tema}>
              <strong>{c.tema}:</strong> {c.recomendacao} <span className="text-tinta-sussurro">({c.forca}; {c.codigo}; {c.muda})</span>
            </li>
          ))}
        </ul>
      </BlocoComparacao>
        </>}
      />

      <ResumoFlutuante
        principal={leitura === 'ok' ? `Adulto · ${numeroBr(peso)} kg` : leitura === 'fora' ? 'Peso fora de 30 a 250 kg' : 'Informe o peso'}
        detalhe={`Choque: ${CHOQUE_PCR.monofasicoJ} J mono · ${CHOQUE_PCR.bifasicoJ} J bi${leitura === 'ok' ? ' · "Copiar" leva todas as doses' : ''}`}
        tom={leitura === 'fora' ? 'critico' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
