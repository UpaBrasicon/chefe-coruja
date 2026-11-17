import { useState } from 'react'

import { ANALGESIA, DIRETRIZ_COLICA_2025, EXAMES_E_INFECCAO, INTERNACAO, condutaPorTamanho, fichaColicaRenalAdulto, quetaminaMg } from '@/clinico/adulto/colicaRenal'
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
import { numero } from '@/lib/formato'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number) => numero(Math.round(x * 10) / 10)

/** Cólica nefrética do adulto (cap. 62 do manual do HCFMUSP). */
export function ColicaRenalAdulto() {
  const [peso, setPeso] = useState(0)
  const [mm, setMm] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaColicaRenalAdulto.id)
  const q = quetaminaMg(peso)
  const calculo = condutaPorTamanho(mm)
  const dadosUsados = [q ? `${numeroBr(peso)} kg` : '', calculo ? `cálculo de ${numeroBr(mm)} mm` : ''].filter(Boolean)

  // Texto do "Copiar" (C3 e C4 = A): a analgesia inteira com a conta do peso, a conduta pelo tamanho e a Tabela 5.
  const copia = q || calculo
    ? textoCopia({
        ferramenta: 'Cólica nefrética (adulto)',
        dados: [
          ['Peso', q ? `${numeroBr(peso)} kg` : ''],
          ['Tamanho do cálculo ureteral', calculo ? `${numeroBr(mm)} mm` : ''],
        ],
        resultado: [
          'Analgesia (p. 848):',
          ...ANALGESIA.map((a) => `- ${a.linha} — ${a.droga}: ${a.dose}${a.droga === 'Quetamina' && q ? ` (${br(q[0])} a ${br(q[1])} mg)` : ''} (${a.pagina})`),
          ...(calculo ? [`Cálculo ureteral pelo tamanho: ${calculo.texto} (${calculo.pagina})`] : []),
          'Internar (Tabela 5, p. 849–850):',
          ...INTERNACAO.map((i) => `- ${i}`),
        ],
        fonte: textoFontes(fichaColicaRenalAdulto),
        versao: fichaColicaRenalAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Cólica nefrética"
      description="Analgesia em degraus com as doses do manual do HC, conduta pelo tamanho do cálculo, tansulosina com a divergência do ensaio de 2018 e indicações de internação. Adulto (14 anos ou mais)."
      ficha={fichaColicaRenalAdulto}
    >
      <CampoPeso id="col-peso" peso={peso} onChange={setPeso}>
        <NumberField id="col-mm" label="Tamanho do cálculo ureteral" unit="mm" value={mm} onChange={setMm} min={0} step={0.5} />
      </CampoPeso>

      <Bloco titulo="Analgesia (p. 848)" descricao="O manejo inicial é o controle da dor.">
        {ANALGESIA.map((a) => (
          <LinhaManual
            key={a.droga}
            nome={`${a.linha} — ${a.droga}`}
            texto={a.dose}
            pagina={a.pagina}
            nota={a.nota}
            conta={a.droga === 'Quetamina' ? (q ? <strong>{br(q[0])} a {br(q[1])} mg</strong> : 'informe o peso') : undefined}
          />
        ))}
      </Bloco>

      <Bloco titulo="Cálculo ureteral pelo tamanho (p. 849)">
        {calculo ? <p className="text-apoio text-tinta">{calculo.texto} ({calculo.pagina})</p> : <p className="text-apoio text-tinta-sussurro">Informe o tamanho do cálculo na imagem.</p>}
        {(!calculo || calculo.tansulosina) && (
          <p className="text-apoio text-tinta-apoio">
            Divergência: no ensaio de Meltzer 2018 (cálculo menor que 9 mm), a tansulosina 0,4 mg não aumentou a eliminação em 28 dias (50% × 47% com placebo). O próprio manual diz que é provável que as diretrizes deixem de indicá-la abaixo de 9 mm.
          </p>
        )}
      </Bloco>

      <Bloco titulo="Exames e infecção">
        {EXAMES_E_INFECCAO.map((e) => <p key={e.texto} className="text-apoio text-tinta-apoio">{e.texto} ({e.pagina})</p>)}
      </Bloco>

      <Bloco titulo="Internar (Tabela 5, p. 849–850)">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-apoio text-tinta-apoio">{INTERNACAO.map((i) => <li key={i}>{i}</li>)}</ul>
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!q && !calculo}
        armadilhas={[...(guia?.armadilhas ?? [])]}
        ficha={fichaColicaRenalAdulto}
        guia={guia}
        comparacao={
          // Tabela de comparação com a EAU 2025 vai para "Evidências" (C6 = A); nenhuma dose do manual muda.
          <BlocoComparacao titulo="EAU 2025 — ao lado do manual" resumo="Urolitíase pela diretriz da Associação Europeia de Urologia de 2025, lida no resumo. As doses do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_COLICA_2025.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={dadosUsados.length ? `Adulto · ${dadosUsados.join(' · ')}` : 'Informe o peso ou o tamanho do cálculo'}
        detalhe={q || calculo ? `${q ? `Quetamina ${br(q[0])} a ${br(q[1])} mg · ` : ''}"Copiar" leva a analgesia inteira` : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
