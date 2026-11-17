import { useState } from 'react'

import {
  ADJUVANTES_TEXTO, DIRETRIZ_DOR_2022, DOR_NEUROPATICA, ESCADA_ANALGESICA, ESCADA_PAGINA, OCTREOTIDE, OPIOIDES, QUETAMINA_ANALGESICA,
  esquemasOpioide, fichaDorAnalgesiaAdulto, intensidadeNumerica, meperidinaMaximos, morfinaEvMl, opioidePorPeso,
  quetaminaAnalgesica, type Faixa, type Opioide,
} from '@/clinico/adulto/dorAnalgesia'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { numero } from '@/lib/formato'

const br = (x: number, casas = 1) => numero(Math.round(x * 10 ** casas) / 10 ** casas)
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

function contaOpioide(o: Opioide, peso: number) {
  const esquemas = esquemasOpioide(o)
  const porPeso = opioidePorPeso(o, peso)
  const partes = []
  if (o.porKg) {
    partes.push(porPeso
      ? <span key="kg">{o.porKg.rotulo} <strong>{faixa(porPeso)} {o.porKg.unidade}</strong>{o.id === 'morfina' && ` = ${faixa(morfinaEvMl(peso)!)} mL a 1 mg/mL`}</span>
      : <span key="kg">informe o peso</span>)
  }
  if (o.id === 'meperidina') {
    const m = meperidinaMaximos(peso)
    if (m) partes.push(<span key="max"> · máximo diário 1.000 mg ou {br(m.porPesoMg, 0)} mg (20 mg/kg)</span>)
  }
  if (esquemas.length) {
    partes.push(<span key="dia">{esquemas.map((e) => `${br(e.doseMg, 0)} mg ${e.intervaloH}/${e.intervaloH} h = ${br(e.diaMg, 0)} mg/dia${e.acimaDoMaximo ? ' (acima do máximo)' : ''}`).join(' · ')}</span>)
  }
  return partes.length ? <>{partes}</> : undefined
}

/** A mesma conta de `contaOpioide`, em texto, para o "Copiar". */
function contaOpioideTexto(o: Opioide, peso: number): string | null {
  const esquemas = esquemasOpioide(o)
  const porPeso = opioidePorPeso(o, peso)
  const partes: string[] = []
  if (o.porKg && porPeso) partes.push(`${o.porKg.rotulo} ${faixa(porPeso)} ${o.porKg.unidade}${o.id === 'morfina' ? ` = ${faixa(morfinaEvMl(peso)!)} mL a 1 mg/mL` : ''}`)
  if (o.id === 'meperidina') {
    const m = meperidinaMaximos(peso)
    if (m) partes.push(`máximo diário 1.000 mg ou ${br(m.porPesoMg, 0)} mg (20 mg/kg)`)
  }
  if (esquemas.length) partes.push(esquemas.map((e) => `${br(e.doseMg, 0)} mg ${e.intervaloH}/${e.intervaloH} h = ${br(e.diaMg, 0)} mg/dia${e.acimaDoMaximo ? ' (acima do máximo)' : ''}`).join(' · '))
  return partes.length ? partes.join(' · ') : null
}

/** Dor e analgesia do adulto (cap. 9 do manual do HCFMUSP). */
export function DorAnalgesiaAdulto() {
  const [peso, setPeso] = useState(0)
  const [nota, setNota] = useState(0)
  const intensidade = intensidadeNumerica(nota)
  const q = quetaminaAnalgesica(peso)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaDorAnalgesiaAdulto.id)
  const temPeso = Number.isFinite(peso) && peso > 0

  // Texto do "Copiar" (C3 e C4 = A): nota da dor, peso e a lista inteira de opioides e quetamina, com página.
  const copia = intensidade || temPeso
    ? textoCopia({
        ferramenta: 'Dor e analgesia — adulto',
        dados: [
          ['Escala numérica', intensidade ? `${nota} de 10` : ''],
          ['Peso', temPeso ? `${numeroBr(peso)} kg` : ''],
        ],
        resultado: [
          ...(intensidade ? [`Nota ${nota}: dor ${intensidade} (faixas da Figura 2, p. 147)`] : []),
          'Opioides (Tabela 3, p. 147–149):',
          ...OPIOIDES.map((o) => {
            const conta = contaOpioideTexto(o, peso)
            return `- ${o.nome} (${o.forca}; ${o.vias}): ${o.texto}${conta ? ` (${conta})` : ''} (${o.pagina})`
          }),
          'Quetamina em dose analgésica:',
          `- Cap. 9: ${QUETAMINA_ANALGESICA.cap9.texto}${q ? ` (${faixa(q.bolusCap9Mg)} mg)` : ''} (${QUETAMINA_ANALGESICA.cap9.pagina})`,
          `- Cap. 104 (paliativo): ${QUETAMINA_ANALGESICA.cap104.texto}${q ? ` (bolus ${faixa(q.bolusMg)} mg em 15–30 min · infusão ${faixa(q.infusaoMgH, 2)} mg/h = ${faixa(q.infusaoMlH)} mL/h, ${br(q.mgMl)} mg/mL, Anexo 1)` : ''} (${QUETAMINA_ANALGESICA.cap104.pagina})`,
        ],
        fonte: textoFontes(fichaDorAnalgesiaAdulto),
        versao: fichaDorAnalgesiaAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Dor e analgesia — adulto"
      description="Escala numérica e escada analgésica, opioides da Tabela 3 com a conta por peso e por dia, e quetamina em dose analgésica, pelo manual do HC. Adulto (14 anos ou mais)."
      ficha={fichaDorAnalgesiaAdulto}
    >
      <CampoPeso id="dor-peso" peso={peso} onChange={setPeso}>
        <NumberField id="dor-nota" label="Escala numérica (0–10)" value={nota} onChange={setNota} min={0} max={10} />
      </CampoPeso>
      {intensidade && (
        <p className="flex flex-wrap items-center gap-2 text-apoio">
          Nota {nota}: <Badge variant={intensidade === 'intensa' ? 'destructive' : intensidade === 'moderada' ? 'warning' : 'success'}>{intensidade}</Badge>
          <span className="text-tinta-sussurro">faixas da Figura 2 (p. 147). Para quem não se comunica: PAINAD e BPS (Tabelas 1 e 2).</span>
        </p>
      )}

      <Bloco titulo={`Escada analgésica (${ESCADA_PAGINA})`} descricao={ADJUVANTES_TEXTO}>
        <ul className="grid gap-1 text-apoio md:grid-cols-2">
          {ESCADA_ANALGESICA.map((e) => (
            <li key={e.degrau} className="rounded-controle border px-3 py-2"><span className="font-medium">{e.degrau}º — {e.dor}</span><br />{e.classe}</li>
          ))}
        </ul>
        <p className="text-apoio text-tinta-sussurro">Dor neuropática, sequência do livro ({DOR_NEUROPATICA.pagina}): {DOR_NEUROPATICA.sequencia.map((s, i) => `${i + 1}. ${s}`).join('; ')}.</p>
        <p className="text-apoio text-tinta-sussurro">Octreotide: {OCTREOTIDE.texto} ({OCTREOTIDE.pagina}).</p>
      </Bloco>

      <Bloco titulo="Opioides (Tabela 3, p. 147–149)" descricao="O livro não traz tabela de equianalgesia: não há conversão entre opioides nesta tela.">
        {OPIOIDES.map((o) => (
          <LinhaManual key={o.id} nome={`${o.nome} (${o.forca}; ${o.vias})`} texto={o.texto} conta={contaOpioide(o, peso)} pagina={o.pagina} errata={o.errata} nota={o.nota} />
        ))}
      </Bloco>

      <Bloco titulo="Quetamina em dose analgésica">
        <LinhaManual nome="Cap. 9" texto={QUETAMINA_ANALGESICA.cap9.texto} conta={q ? <strong>{faixa(q.bolusCap9Mg)} mg</strong> : 'informe o peso'} pagina={QUETAMINA_ANALGESICA.cap9.pagina} />
        <LinhaManual
          nome="Cap. 104 (paliativo)"
          texto={QUETAMINA_ANALGESICA.cap104.texto}
          conta={q ? <>bolus <strong>{faixa(q.bolusMg)} mg</strong> em 15–30 min · infusão <strong>{faixa(q.infusaoMgH, 2)} mg/h</strong> = {faixa(q.infusaoMlH)} mL/h ({br(q.mgMl)} mg/mL, Anexo 1)</> : 'informe o peso'}
          pagina={QUETAMINA_ANALGESICA.cap104.pagina}
          errata={QUETAMINA_ANALGESICA.errata}
        />
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!intensidade && !temPeso}
        armadilhas={[
          ...OPIOIDES.flatMap((o) => (o.errata ? [`${o.nome} — errata do livro: ${o.errata}`] : [])),
          `Quetamina analgésica — errata do livro: ${QUETAMINA_ANALGESICA.errata}`,
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaDorAnalgesiaAdulto}
        guia={guia}
        comparacao={
          // Tabela de comparação com o CDC 2022 vai para "Evidências" (C6 = A); nenhuma dose do manual muda.
          <BlocoComparacao titulo="CDC 2022 — ao lado do manual" resumo="Opioide na dor aguda do adulto que recebe alta, pelo guia do CDC de 2022 (categoria A ou B e tipo de evidência), lido no texto integral. Não vale para doença falciforme, câncer e cuidados paliativos.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_DOR_2022.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={intensidade ? `Dor ${nota} de 10 · ${intensidade}` : temPeso ? `Adulto · ${numeroBr(peso)} kg` : 'Informe a nota da dor ou o peso'}
        detalhe={temPeso ? `${intensidade ? `Adulto · ${numeroBr(peso)} kg · ` : ''}"Copiar" leva os opioides e a quetamina` : intensidade ? 'Informe o peso para as doses por peso' : undefined}
        tom={intensidade === 'intensa' ? 'critico' : intensidade === 'moderada' ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
