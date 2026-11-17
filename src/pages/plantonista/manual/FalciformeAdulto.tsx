import { useState } from 'react'

import {
  ANALGESIA_POR_INTENSIDADE, DIFERENCAS_FALCIFORME, DIRETRIZ_FALCIFORME, HIDRATACAO_FALCIFORME, METAS_FALCIFORME, MORFINA_FALCIFORME, NOTA_QUETAMINA_FALCIFORME, NOTA_TASC_STA, QUETAMINA_FALCIFORME, STA_ANTIBIOTICOS, fichaFalciformeAdulto, hidratacaoFalciforme, morfinaFalciforme, quetaminaFalciforme,
} from '@/clinico/adulto/falciforme'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { ListaLivro } from './PecasLoteE7'
import { br, faixa } from './loteE7Formato'

/** Anemia falciforme do adulto: crise álgica e síndrome torácica aguda (cap. 80 do manual do HCFMUSP). */
export function FalciformeAdulto() {
  const [peso, setPeso] = useState(0)
  const h = hidratacaoFalciforme(peso)
  const m = morfinaFalciforme(peso)
  const q = quetaminaFalciforme(peso)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaFalciformeAdulto.id)

  // Texto do "Copiar" (C3/C4 = A): peso e a lista inteira de hidratação, analgesia e antibiótico da STA, com as contas.
  const copia = h && m && q
    ? textoCopia({
        ferramenta: 'Anemia falciforme — crise álgica e STA (adulto)',
        dados: [['Peso', `${numeroBr(peso)} kg`]],
        resultado: [
          `Hidratação: ${HIDRATACAO_FALCIFORME.mlKg24h} mL/kg em 24 h (SF 0,9% + SG 5%; SF 0,9% se hipovolêmico) = ${br(h.ml24h, 0)} mL/24 h = ${br(h.mlH, 0)} mL/h (${HIDRATACAO_FALCIFORME.pagina})`,
          ...ANALGESIA_POR_INTENSIDADE.map((a) => `- ${a.faixa} —${a.texto} (${a.pagina})`),
          `- Morfina na dor grave: ${br(MORFINA_FALCIFORME.ataqueMgKg, 2)} mg/kg EV = ${br(m.ataqueMg)} mg; repetir ${br(MORFINA_FALCIFORME.repeticaoMgKg, 2)} mg/kg = ${br(m.repeticaoMg)} mg a cada ${MORFINA_FALCIFORME.intervaloMin} min até o controle (${MORFINA_FALCIFORME.pagina})`,
          `- Quetamina intranasal: ${br(QUETAMINA_FALCIFORME.inMgKg, 2)} mg/kg = ${br(q.inMg)} mg (${QUETAMINA_FALCIFORME.pagina})`,
          `- Quetamina infusão EV: ${faixa(QUETAMINA_FALCIFORME.infusaoUgKgMin, 0)} µg/kg/min = ${faixa(q.infusaoMgH)} mg/h; pelo parêntese do livro ${faixa(q.infusaoLivroMgH)} mg/h. Errata: ${NOTA_QUETAMINA_FALCIFORME}`,
          `- Quetamina bolus EV: ${faixa(QUETAMINA_FALCIFORME.bolusMgKg)} mg/kg = ${faixa(q.bolusMg)} mg (${QUETAMINA_FALCIFORME.pagina})`,
          `- Quetamina, dose máxima: ${QUETAMINA_FALCIFORME.maxMgKgH} mg/kg/hora = ${br(q.maxMgH)} mg/h (${QUETAMINA_FALCIFORME.pagina})`,
          ...STA_ANTIBIOTICOS.map((s) => `STA, antibiótico empírico: ${s.texto} (${s.pagina})`),
        ],
        fonte: textoFontes(fichaFalciformeAdulto),
        versao: fichaFalciformeAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Anemia falciforme — crise álgica e STA (adulto)"
      description="Hidratação por peso, analgesia por intensidade (Tabela 5) com morfina e quetamina por peso, antibiótico e metas da síndrome torácica aguda, pelo manual do HC. Adulto (14 anos ou mais); o capítulo não traz dose pediátrica."
      ficha={fichaFalciformeAdulto}
    >
      <CampoPeso id="fal-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Hidratação na crise álgica (p. 1056)">
        <LinhaManual
          nome="Volume em 24 h"
          texto={`${HIDRATACAO_FALCIFORME.mlKg24h} mL/kg em 24 horas com solução discretamente hipotônica (SF 0,9% + SG 5%); SF 0,9% se hipovolêmico`}
          conta={h ? <><strong>{br(h.ml24h, 0)} mL/24 h</strong> = {br(h.mlH, 0)} mL/h</> : 'informe o peso'}
          pagina={HIDRATACAO_FALCIFORME.pagina}
        />
      </Bloco>

      <Bloco titulo="Analgesia — Tabela 5 (p. 1057–1058)" descricao="Escala de 1 a 10; dor ≥ 8: opioide parenteral com tempo porta-opioide ≤ 30 min (p. 1056).">
        {ANALGESIA_POR_INTENSIDADE.map((a) => <LinhaManual key={a.faixa} nome={a.faixa} texto={a.texto} pagina={a.pagina} />)}
        <LinhaManual
          nome="Morfina na dor grave"
          texto={`${br(MORFINA_FALCIFORME.ataqueMgKg, 2)} mg/kg EV; repetir ${br(MORFINA_FALCIFORME.repeticaoMgKg, 2)} mg/kg a cada ${MORFINA_FALCIFORME.intervaloMin} min até o controle`}
          conta={m ? <><strong>{br(m.ataqueMg)} mg</strong> · repetição {br(m.repeticaoMg)} mg</> : 'informe o peso'}
          pagina={MORFINA_FALCIFORME.pagina}
        />
      </Bloco>

      <Bloco titulo="Quetamina na dor refratária a opioide (p. 1056)">
        <LinhaManual nome="Intranasal" texto={`${br(QUETAMINA_FALCIFORME.inMgKg, 2)} mg/kg`} conta={q ? <strong>{br(q.inMg)} mg</strong> : 'informe o peso'} pagina={QUETAMINA_FALCIFORME.pagina} />
        <LinhaManual
          nome="Infusão EV"
          texto={`${faixa(QUETAMINA_FALCIFORME.infusaoUgKgMin, 0)} µg/kg/min (o livro escreve "0,1 a 0,3 mg/kg/hora")`}
          conta={q ? <><strong>{faixa(q.infusaoMgH)} mg/h</strong> pelos µg/kg/min · {faixa(q.infusaoLivroMgH)} mg/h pelo parêntese</> : 'informe o peso'}
          pagina={QUETAMINA_FALCIFORME.pagina}
          errata={NOTA_QUETAMINA_FALCIFORME}
        />
        <LinhaManual nome="Bolus EV" texto={`${faixa(QUETAMINA_FALCIFORME.bolusMgKg)} mg/kg`} conta={q ? <strong>{faixa(q.bolusMg)} mg</strong> : 'informe o peso'} pagina={QUETAMINA_FALCIFORME.pagina} />
        <LinhaManual nome="Dose máxima" texto={`${QUETAMINA_FALCIFORME.maxMgKgH} mg/kg/hora`} conta={q ? <strong>{br(q.maxMgH)} mg/h</strong> : 'informe o peso'} pagina={QUETAMINA_FALCIFORME.pagina} />
      </Bloco>

      <Bloco titulo="Síndrome torácica aguda: antibiótico empírico (p. 1057–1058)" descricao="Os critérios diagnósticos (Tabela 3) estão em ferramenta própria.">
        <ListaLivro itens={STA_ANTIBIOTICOS} />
        <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_TASC_STA}</p>
      </Bloco>

      <Bloco titulo="Metas, transfusão e alta (p. 1055–1061)">
        <ListaLivro itens={METAS_FALCIFORME} />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!h}
        armadilhas={[`Quetamina em infusão — errata do livro: ${NOTA_QUETAMINA_FALCIFORME}`, ...(guia?.armadilhas ?? [])]}
        ficha={fichaFalciformeAdulto}
        guia={guia}
        comparacao={
          // Tabela de comparação com a diretriz francesa vai para "Evidências" (C6 = A); nenhuma dose do manual muda.
          <BlocoComparacao titulo="SRLF/SFMU 2025 — ao lado do manual" resumo="Crise vaso-oclusiva e síndrome torácica aguda do adulto pela diretriz francesa de 2025 (GRADE e opinião de especialistas), lida no texto integral. As doses e contas do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_FALCIFORME.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_FALCIFORME.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={h ? `Adulto · ${numeroBr(peso)} kg` : 'Informe o peso'}
        detalhe={h && m ? `Hidratação ${br(h.mlH, 0)} mL/h · morfina ${br(m.ataqueMg)} mg EV; "Copiar" leva todas as doses` : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
