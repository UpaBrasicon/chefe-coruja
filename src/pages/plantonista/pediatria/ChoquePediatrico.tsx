import { useState } from 'react'

import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { calcularDose, type DosePeso } from '@/clinico/pediatria/fonteP2'
import {
  DIRETRIZ_SSC_PED_2026, ERRATA_CHOQUE, METAS_CHOQUE, VASOATIVAS, diureseAlvo, fichaChoquePediatrico, volumesChoque,
} from '@/clinico/pediatria/choque'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { faixaTxt, num, pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'
import { PhoenixCalculo } from './PhoenixPed'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Linha do "Copiar" com a mesma conta da LinhaDose (PecasP2). */
function linhaDose(d: DosePeso, peso: number): string[] {
  const r = calcularDose(d, peso)
  if (!r) return []
  return [`- ${d.nome}: ${faixaTxt(r.dose)} ${d.unidade}${r.volumeMl && d.unidade !== 'mL' ? ` · ${faixaTxt(r.volumeMl)} mL` : ''}${r.noMaximo ? ' (limitado ao máximo do livro)' : ''} · ${d.via} (Livro ICr, ${d.pagina})`]
}

/** Choque séptico na criança: volume em mL/kg e vasoativas (livro do ICr, cap. 5), critérios de Phoenix 2024 e SSC pediátrica 2026. */
export function ChoquePediatrico() {
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)
  const v = pesoValido(peso) ? volumesChoque(peso) : null
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaChoquePediatrico.id)
  const calc = !rn && v !== null

  // Texto do "Copiar" (C3 e C4 = A): o peso, os volumes, as vasoativas e as metas, com a página.
  // O cálculo de Phoenix fica de fora: o estado dele mora na peça compartilhada (PhoenixPed).
  const copia = calc
    ? textoCopia({
        ferramenta: 'Choque séptico — criança',
        dados: [['Peso', `${numeroBr(peso)} kg`]],
        resultado: [
          'Volume (Livro ICr, cap. 5, p. 82–85):',
          `- Bolus de solução isotônica (10 a 20 mL/kg): ${faixaTxt(v.bolus, 0)} mL`,
          `- Primeira hora, classicamente (40 a 60 mL/kg): ${faixaTxt(v.primeiraHora, 0)} mL`,
          `- Sem suporte ventilatório/vasoativo: só no hipotenso, até 40 mL/kg: ${num(v.semSuporte, 0)} mL`,
          `- Diurese-alvo (> 1 mL/kg/h): > ${num(diureseAlvo(peso)!, 1)} mL/h`,
          '- Reavaliar sinais de congestão (crepitações, hepatomegalia) a cada bolus; normotensos sem esses recursos recebem só manutenção.',
          'Drogas vasoativas (Tabela 2, p. 87):',
          ...VASOATIVAS.flatMap((d) => linhaDose(d, peso)),
          'Metas e tempos:',
          ...METAS_CHOQUE.map((m) => `- ${m.texto} (cap. 5, ${m.pagina})`),
        ],
        fonte: textoFontes(fichaChoquePediatrico),
        versao: fichaChoquePediatrico.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Choque séptico — criança"
      description="Expansão volêmica em mL/kg e vasoativas (livro do ICr-HCFMUSP), critérios de Phoenix 2024 para sepse e choque séptico e o que a Surviving Sepsis Campaign pediátrica 2026 escreve, fonte a fonte."
      ficha={fichaChoquePediatrico}
    >
      <CampoPesoRn id="choque-peso" peso={peso} setPeso={setPeso} rn={rn} setRn={setRn} />
      {rn ? <AvisoRn /> : !v ? <PesoInvalido /> : (
        <>
          <Bloco titulo="Volume (p. 85)">
            <dl className="grid gap-x-4 gap-y-1 tabular-nums sm:grid-cols-[auto_1fr]">
              <dt className="text-tinta-sussurro">Bolus de solução isotônica (10 a 20 mL/kg)</dt><dd><strong>{faixaTxt(v.bolus, 0)} mL</strong></dd>
              <dt className="text-tinta-sussurro">Primeira hora, classicamente (40 a 60 mL/kg)</dt><dd><strong>{faixaTxt(v.primeiraHora, 0)} mL</strong></dd>
              <dt className="text-tinta-sussurro">Sem suporte ventilatório/vasoativo: só no hipotenso, até 40 mL/kg</dt><dd><strong>{num(v.semSuporte, 0)} mL</strong></dd>
              <dt className="text-tinta-sussurro">Diurese-alvo (&gt; 1 mL/kg/h)</dt><dd><strong>&gt; {num(diureseAlvo(peso)!, 1)} mL/h</strong></dd>
            </dl>
            <p className="text-tinta-sussurro">Reavaliar sinais de congestão (crepitações, hepatomegalia) a cada bolus; normotensos sem esses recursos recebem só manutenção.</p>
            <p className="text-rotulo text-tinta-sussurro">Livro ICr, cap. 5, p. 82–85.</p>
          </Bloco>
          <Bloco titulo="Drogas vasoativas (Tabela 2, p. 87)">
            {VASOATIVAS.map((d) => <LinhaDose key={d.id} d={d} peso={peso} />)}
          </Bloco>
        </>
      )}
      <Bloco titulo="Metas e tempos">
        {METAS_CHOQUE.map((m) => <LinhaReferencia key={m.texto} texto={m.texto} pagina={`cap. 5, ${m.pagina}`} />)}
      </Bloco>

      <PhoenixCalculo />

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc}
        armadilhas={[
          ...ERRATA_CHOQUE.map((e) => `Errata do livro: ${e}`),
          ...VASOATIVAS.filter((d) => d.errata).map((d) => `${d.nome} — errata do livro (${d.pagina}): ${d.errata}`),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaChoquePediatrico}
        guia={guia}
        comparacao={
          // Tabela SSC pediátrica 2026 × livro vai para "Evidências" (C6 = A); nenhum volume ou dose muda.
          <BlocoComparacao titulo="SSC pediátrica 2026 × livro do ICr">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">SSC pediátrica 2026</TableHead><TableHead className="pb-2">Livro do ICr</TableHead></TableRow></TableHeader>
                <TableBody>
                  {DIRETRIZ_SSC_PED_2026.map((d) => (
                    <TableRow key={d.tema} className="border-t">
                      <TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell>
                      <TableCell className="pr-3 py-2">
                        {d.ssc.texto} <span className="text-tinta-sussurro">({d.ssc.pagina})</span>
                        {d.nota && <p role="note" className="mt-2 rounded-controle border border-atencao/40 bg-alerta-atencao px-2 py-1 text-rotulo text-atencao">{d.nota}</p>}
                      </TableCell>
                      <TableCell className="py-2 text-tinta-sussurro">{d.livro ? `${d.livro.texto} (${d.livro.pagina})` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(peso)} kg` : rn ? 'Recém-nascido: sem valor neonatal no capítulo' : 'Informe o peso'}
        detalhe={calc ? `Bolus ${faixaTxt(v.bolus, 0)} mL · 1ª hora ${faixaTxt(v.primeiraHora, 0)} mL; "Copiar" leva volumes, vasoativas e metas.` : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
