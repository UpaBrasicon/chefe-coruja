import { useState } from 'react'

import {
  CRITERIOS_ANAFILAXIA, DOSES_ANAFILAXIA, FIXOS_ANAFILAXIA, LINHAS_ANAFILAXIA,
  epinefrinaDoseFixa, fenoterolGotas, fichaAnafilaxiaPediatrica, type LinhaAnafilaxia,
} from '@/clinico/pediatria/anafilaxia'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { calcularDose, idadeEmDias, type DosePeso } from '@/clinico/pediatria/fonteP2'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { faixaTxt, num, pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'

/** Linha do "Copiar" com a mesma conta da LinhaDose (PecasP2). */
function linhaDose(d: DosePeso, peso: number): string[] {
  const r = calcularDose(d, peso)
  if (!r) return []
  return [`- ${d.nome}: ${faixaTxt(r.dose)} ${d.unidade}${r.volumeMl && d.unidade !== 'mL' ? ` · ${faixaTxt(r.volumeMl)} mL` : ''}${r.noMaximo ? ' (limitado ao máximo do livro)' : ''} · ${d.via} (Livro ICr, ${d.pagina})`]
}

/** Anafilaxia na criança (livro do ICr, cap. 6). */
export function AnafilaxiaPediatrica() {
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)
  const [anos, setAnos] = useState(0)
  const [meses, setMeses] = useState(0)
  const temIdade = anos > 0 || meses > 0
  const fixa = temIdade ? epinefrinaDoseFixa(idadeEmDias(anos, meses) ?? 0) : null
  const fen = fenoterolGotas(peso)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaAnafilaxiaPediatrica.id)
  const calc = !rn && pesoValido(peso)
  const epiIm = DOSES_ANAFILAXIA.find((d) => d.id === 'epinefrina-im')
  const epi = calc && epiIm ? calcularDose(epiIm, peso) : null
  const idadeTxt = temIdade ? `${Math.floor(anos)} a ${Math.floor(meses)} m` : ''

  // Texto do "Copiar" (C3 e C4 = A): peso, idade, a lista por linha, a dose fixa por idade e o que não se calcula, com a página.
  const copia = calc || fixa
    ? textoCopia({
        ferramenta: 'Anafilaxia — criança',
        dados: [
          ['Peso', calc ? `${numeroBr(peso)} kg` : ''],
          ['Idade', temIdade ? `${Math.floor(anos)} anos e ${Math.floor(meses)} meses` : ''],
        ],
        resultado: [
          ...(calc
            ? (Object.keys(LINHAS_ANAFILAXIA) as LinhaAnafilaxia[]).flatMap((l) => [
                `${LINHAS_ANAFILAXIA[l]}:`,
                ...DOSES_ANAFILAXIA.filter((d) => d.linha === l).flatMap((d) => linhaDose(d, peso)),
                ...(l === 'segunda' && fen
                  ? [`- Fenoterol em nebulização (broncoespasmo): ${num(fen.gotas, 1)} gotas · ${num(fen.mg)} mg${fen.noMaximo ? ' (limitado ao máximo do livro)' : ''} · 1 gota (0,25 mg) a cada 3 kg, máximo 10 gotas, em 3 a 5 mL de SF (Livro ICr, p. 101, Tabela 3)`]
                  : []),
              ])
            : []),
          ...(fixa ? [`Epinefrina IM — dose fixa por idade (alternativa do livro): ${fixa.doses.join(' ou ')} (Livro ICr, cap. 6, p. 98 e 101, Tabela 3)`] : []),
          'Sem cálculo por peso:',
          ...FIXOS_ANAFILAXIA.map((f) => `- ${f.nome}: ${f.dose} (cap. 6, ${f.pagina})`),
        ],
        fonte: textoFontes(fichaAnafilaxiaPediatrica),
        versao: fichaAnafilaxiaPediatrica.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Anafilaxia — criança"
      description="Epinefrina IM por peso ou dose fixa por idade, segunda e terceira linha e refratária — livro do ICr-HCFMUSP."
      ficha={fichaAnafilaxiaPediatrica}
    >
      <Bloco titulo="Critérios clínicos (Quadro 3, p. 97–98)">
        {CRITERIOS_ANAFILAXIA.map((c) => <p key={c}>{c}</p>)}
        <p className="text-tinta-sussurro">PA sistólica baixa: &lt; 70 mmHg de 1 mês a 1 ano; &lt; 70 + (2 × idade) de 1 a 10 anos; &lt; 90 mmHg de 11 a 17 anos.</p>
        <p className="text-rotulo text-tinta-sussurro">Livro ICr, cap. 6, p. 97–98.</p>
      </Bloco>

      <CampoPesoRn id="anaf-peso" peso={peso} setPeso={setPeso} rn={rn} setRn={setRn} />
      {rn ? <AvisoRn /> : !pesoValido(peso) ? <PesoInvalido /> : (
        (Object.keys(LINHAS_ANAFILAXIA) as LinhaAnafilaxia[]).map((l) => (
          <Bloco key={l} titulo={LINHAS_ANAFILAXIA[l]}>
            {DOSES_ANAFILAXIA.filter((d) => d.linha === l).map((d) => <LinhaDose key={d.id} d={d} peso={peso} />)}
            {l === 'segunda' && fen && (
              <div className="rounded-controle border px-3 py-2 text-apoio">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">Fenoterol em nebulização (broncoespasmo)</span>
                  <strong className="tabular-nums">{num(fen.gotas, 1)} gotas · {num(fen.mg)} mg</strong>
                </div>
                <p className="text-tinta-sussurro">1 gota (0,25 mg) a cada 3 kg, máximo 10 gotas, em 3 a 5 mL de SF.</p>
                {fen.noMaximo && <p className="text-atencao">Limitado ao máximo do livro.</p>}
                <p className="text-rotulo text-tinta-sussurro">Livro ICr, p. 101 (Tabela 3).</p>
              </div>
            )}
          </Bloco>
        ))
      )}

      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <NumberField id="anaf-anos" label="Idade — anos completos (dose fixa)" unit="anos" value={anos} onChange={setAnos} min={0} max={13} step={1} />
          <NumberField id="anaf-meses" label="e meses" unit="meses" value={meses} onChange={setMeses} min={0} max={11} step={1} />
        </CardContent>
      </Card>
      {fixa && (
        <Bloco titulo="Epinefrina IM — dose fixa por idade (alternativa do livro)">
          <p><strong>{fixa.doses.join(' ou ')}</strong></p>
          {fixa.ambigua && <p className="text-atencao">Com 6 ou 12 anos completos o livro põe a idade nas duas faixas (“dos 6 meses aos 6 anos”, “dos 6 aos 12”); as duas doses aparecem.</p>}
          <p className="text-tinta-sussurro">&lt; 6 meses 0,1 a 0,15 mg; 6 meses a 6 anos 0,15 mg; 6 a 12 anos 0,3 mg; a partir de 12 anos 0,5 mg.</p>
          <p className="text-rotulo text-tinta-sussurro">Livro ICr, cap. 6, p. 98 e 101 (Tabela 3).</p>
        </Bloco>
      )}

      <Bloco titulo="Sem cálculo por peso">
        {FIXOS_ANAFILAXIA.map((f) => <LinhaReferencia key={f.nome} rotulo={f.nome} texto={f.dose} pagina={`cap. 6, ${f.pagina}`} />)}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc && !fixa}
        armadilhas={[...DOSES_ANAFILAXIA.filter((d) => d.errata).map((d) => `${d.nome} — errata do livro (${d.pagina}): ${d.errata}`), ...(guia?.armadilhas ?? [])]}
        ficha={fichaAnafilaxiaPediatrica}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(peso)} kg${idadeTxt ? ` · ${idadeTxt}` : ''}` : rn ? 'Recém-nascido: sem valor neonatal no capítulo' : fixa ? `Criança · ${idadeTxt}` : 'Informe o peso'}
        detalhe={epi ? `Epinefrina IM ${faixaTxt(epi.dose)} mg${epi.volumeMl ? ` (${faixaTxt(epi.volumeMl)} mL de 1:1.000)` : ''}${epi.noMaximo ? ', no máximo do livro' : ''}; "Copiar" leva a lista.` : fixa ? `Epinefrina IM por idade: ${fixa.doses.join(' ou ')}` : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
