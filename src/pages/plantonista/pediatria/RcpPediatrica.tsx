import { useState } from 'react'

import {
  DIRETRIZ_PALS_2025, DROGAS_RCP, FAIXAS_RCP, GRUPOS_RCP, NOTAS_CHOQUE, OUTROS_PARAMETROS,
  cargasPorPeso, fichaRcpPediatrica, metaPadRcp2025, parametrosRcp, type FaixaRcp, type GrupoRcp,
} from '@/clinico/pediatria/rcp'
import { calcularDose, type DosePeso } from '@/clinico/pediatria/fonteP2'
import { textoFontes } from '@/clinico/ficha'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { faixaTxt, num, pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Linha do "Copiar": a mesma conta da LinhaDose (PecasP2). */
function doseP2Txt(d: DosePeso, peso: number): string[] {
  const r = calcularDose(d, peso)
  if (!r) return []
  return [`- ${d.nome}: ${faixaTxt(r.dose)} ${d.unidade}${r.volumeMl && d.unidade !== 'mL' ? ` · ${faixaTxt(r.volumeMl)} mL` : ''}${r.noMaximo ? ' (limitado ao máximo do livro)' : ''} · ${d.via} (${d.pagina})`]
}

const botao = (ativo: boolean) =>
  cn('rounded-controle px-3 py-2 text-apoio', ativo && 'border-acao bg-acao/5 ring-1 ring-acao')

/** RCP pediátrica: parâmetros, cargas de choque e drogas (livro do ICr, caps. 1 e 2). */
export function RcpPediatrica() {
  const [faixa, setFaixa] = useState<FaixaRcp>('crianca')
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)
  const p = parametrosRcp(faixa)
  const c = pesoValido(peso) ? cargasPorPeso(peso) : null
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaRcpPediatrica.id)
  const temConta = !rn && c !== null
  const faixaCurta = FAIXAS_RCP[faixa].split(' (')[0]

  // Texto do "Copiar" (C3 e C4 = A): parâmetros da faixa, cargas e drogas que estão na tela, com a página do livro.
  const copia = () =>
    textoCopia({
      ferramenta: 'RCP pediátrica (PS Pediatria ICr-HCFMUSP)',
      dados: [
        ['Faixa', FAIXAS_RCP[faixa]],
        ['Peso', `${numeroBr(peso)} kg`],
      ],
      resultado: [
        `Compressão e ventilação (${p.pagina}): frequência ${p.frequencia}; profundidade ${p.profundidade}; relação ${p.relacao}; com via aérea avançada ${p.viaAereaAvancada}`,
        ...(c
          ? [
              'Cargas pelo peso:',
              `- FV/TV sem pulso — 1º choque (2 J/kg): ${num(c.primeiro, 1)} J`,
              `- 2º choque (4 J/kg): ${num(c.segundo, 1)} J`,
              `- Seguintes (4 a 10 J/kg): ${faixaTxt(c.subsequentes, 1)} J`,
              `- Cardioversão TSV — inicial (0,5 a 1 J/kg): ${faixaTxt(c.cardioversaoInicial, 1)} J`,
              `- Cardioversão TSV — se persistir (1 a 2 J/kg): ${faixaTxt(c.cardioversaoSeguinte, 1)} J`,
              ...(Object.keys(GRUPOS_RCP) as GrupoRcp[]).flatMap((g) => [`${GRUPOS_RCP[g]}:`, ...DROGAS_RCP.filter((d) => d.grupo === g).flatMap((d) => doseP2Txt(d, peso))]),
            ]
          : []),
      ],
      fonte: textoFontes(fichaRcpPediatrica),
      versao: fichaRcpPediatrica.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="RCP pediátrica"
      description="Compressão e ventilação por faixa, cargas de desfibrilação e cardioversão por peso e drogas da PCR — livro do ICr-HCFMUSP."
      ficha={fichaRcpPediatrica}
    >
      <Card>
        <CardContent className="flex flex-col gap-2 pt-6">
          <p className="text-apoio font-semibold">Faixa do suporte básico</p>
          <div role="radiogroup" aria-label="Faixa do suporte básico" className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(FAIXAS_RCP) as FaixaRcp[]).map((f) => (
              <BotaoLinha key={f} role="radio" aria-checked={faixa === f} onClick={() => setFaixa(f)} className={botao(faixa === f)}>{FAIXAS_RCP[f]}</BotaoLinha>
            ))}
          </div>
        </CardContent>
      </Card>

      <Bloco titulo="Compressão e ventilação">
        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
          {([['Frequência', p.frequencia], ['Profundidade', p.profundidade], ['Relação compressão:ventilação', p.relacao], ['Com via aérea avançada', p.viaAereaAvancada], ['Pulso', p.pulso], ['Técnica', p.tecnica]] as const).map(([k, v]) => (
            <div key={k} className="contents"><dt className="text-tinta-sussurro">{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        <p className="text-rotulo text-tinta-sussurro">Livro ICr, {p.pagina}.</p>
        {OUTROS_PARAMETROS.map((o) => <LinhaReferencia key={o.rotulo} rotulo={o.rotulo} texto={o.valor} pagina={o.pagina} />)}
      </Bloco>

      <CampoPesoRn id="rcp-peso" peso={peso} setPeso={setPeso} rn={rn} setRn={setRn} />
      {rn ? <AvisoRn /> : !c ? <PesoInvalido /> : (
        <>
          <Bloco titulo="Cargas pelo peso">
            <dl className="grid gap-x-4 gap-y-1 tabular-nums sm:grid-cols-[auto_1fr]">
              <dt className="text-tinta-sussurro">FV/TV sem pulso — 1º choque (2 J/kg)</dt><dd><strong>{num(c.primeiro, 1)} J</strong></dd>
              <dt className="text-tinta-sussurro">2º choque (4 J/kg)</dt><dd><strong>{num(c.segundo, 1)} J</strong></dd>
              <dt className="text-tinta-sussurro">Seguintes (4 a 10 J/kg)</dt><dd><strong>{faixaTxt(c.subsequentes, 1)} J</strong></dd>
              <dt className="text-tinta-sussurro">Cardioversão TSV — inicial (0,5 a 1 J/kg)</dt><dd><strong>{faixaTxt(c.cardioversaoInicial, 1)} J</strong></dd>
              <dt className="text-tinta-sussurro">Cardioversão TSV — se persistir (1 a 2 J/kg)</dt><dd><strong>{faixaTxt(c.cardioversaoSeguinte, 1)} J</strong></dd>
            </dl>
            {NOTAS_CHOQUE.map((n) => <LinhaReferencia key={n.texto} texto={n.texto} pagina={n.pagina} />)}
          </Bloco>
          {(Object.keys(GRUPOS_RCP) as GrupoRcp[]).map((g) => (
            <Bloco key={g} titulo={GRUPOS_RCP[g]}>
              {DROGAS_RCP.filter((d) => d.grupo === g).map((d) => <LinhaDose key={d.id} d={d} peso={peso} />)}
            </Bloco>
          ))}
        </>
      )}
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temConta}
        armadilhas={[...(guia?.armadilhas ?? [])]}
        ficha={fichaRcpPediatrica}
        guia={guia}
        comparacao={
          // Tabela AHA/AAP 2025 × livro do ICr vai para "Evidências" (C6 = A); cargas e doses do livro não mudam.
          <BlocoComparacao titulo="AHA/AAP 2025 × livro do ICr">
            <p className="text-apoio text-tinta-sussurro">Part 8 lido no texto integral publicado pela AHA (recomendações e quadro da Figura 2) e Destaques oficiais das diretrizes 2025 (p. 11–15). Com linha arterial na RCP, a diretriz mira PAD ≥ {metaPadRcp2025(faixa)} mmHg para a faixa escolhida.</p>
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">AHA/AAP 2025</TableHead><TableHead className="pr-3 pb-2">Estado · p.</TableHead><TableHead className="pb-2">Livro do ICr</TableHead></TableRow></TableHeader>
                <TableBody>
                  {DIRETRIZ_PALS_2025.map((d) => (
                    <TableRow key={d.tema} className="border-t">
                      <TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell>
                      <TableCell className="pr-3 py-2">{d.aha}</TableCell>
                      <TableCell className="pr-3 py-2 whitespace-nowrap text-tinta-sussurro">{d.estado} · {d.pagina}</TableCell>
                      <TableCell className="py-2 text-tinta-sussurro">{d.livro}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={temConta && c ? `1º choque ${num(c.primeiro, 1)} J · ${numeroBr(peso)} kg` : rn ? 'Recém-nascido: sem valor neonatal do livro' : `Faixa: ${faixaCurta}`}
        detalhe={temConta ? `${faixaCurta} · cargas e drogas acima; "Copiar" leva todas.` : 'Informe o peso para as cargas e as drogas.'}
        textoCopia={temConta ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
