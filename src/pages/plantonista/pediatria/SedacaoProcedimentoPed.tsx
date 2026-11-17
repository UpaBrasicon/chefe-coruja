import { useState } from 'react'

import {
  ASA, JEJUM_H, REFERENCIAS_SEDACAO, REVERSORES_APENDICE, SEDATIVOS_APENDICE, SUGESTOES_PROCEDIMENTO, cetaminaContraindicadaIdade, cetaminaTerapeuticaMg, dexmedetomidina,
  fichaSedacaoProcedimento, jejumFaltaH, type Ingesta,
} from '@/clinico/pediatria/sedacaoProcedimento'
import { calcularBolus, type Bolus } from '@/clinico/pediatria/bolus'
import { textoFontes } from '@/clinico/ficha'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Opcoes, Pendencia } from './PecasIcr'
import { LinhaReferencia } from './PecasP2'
import { LinhaBolusApendice, TabelaLivro } from './PecasP4'

/** Linha do "Copiar": a mesma conta da LinhaBolusApendice (PecasP4). */
function bolusTxt(b: Bolus, peso: number, idadeMeses?: number): string[] {
  const r = calcularBolus(b, peso, idadeMeses)
  if (!r || r.aplica === 'nao') return []
  return [`- ${b.nome}: ${faixaBr(r.faixa, r.faixa[1] >= 10 ? 1 : 2)} ${b.unidade}${r.volumeMl ? ` · ${faixaBr(r.volumeMl, 2)} mL` : ''}${r.noMaximo ? ' (limitado ao máximo do livro)' : ''}${r.aplica === 'indefinido' ? ' (depende da idade)' : ''} · ${b.via} (Apêndice, ${b.pagina})`]
}

/** Sedação e analgesia para procedimentos — cap. 78 do livro do ICr. */
export function SedacaoProcedimentoPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [ingesta, setIngesta] = useState<Ingesta>('claros')
  const [horas, setHoras] = useState(0)
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const idadeMeses = p.anos * 12 + p.meses
  const falta = jejumFaltaH(ingesta, horas)
  const ceta = calc ? cetaminaTerapeuticaMg(p.peso) : null
  const cetaProibida = cetaminaContraindicadaIdade(idadeMeses)
  const dex = calc ? dexmedetomidina(p.peso) : null
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaSedacaoProcedimento.id)
  const temConta = calc || falta !== null
  const jejumTxt = falta === null ? '' : falta === 0 ? 'Jejum: tempo já cumprido' : `Jejum: faltam ${br(falta, 1)} h`

  // Texto do "Copiar" (C3 e C4 = A): jejum e doses que estão na tela, com a página do livro.
  const copia = () =>
    textoCopia({
      ferramenta: 'Sedação para procedimento — criança (PS Pediatria ICr-HCFMUSP)',
      dados: [
        ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
        ['Idade', p.anos > 0 || p.meses > 0 ? `${p.anos} anos e ${p.meses} meses` : ''],
        ['Última ingesta', falta !== null ? `${JEJUM_H[ingesta].rotulo} há ${numeroBr(horas)} h` : ''],
      ],
      resultado: [
        ...(falta !== null ? [`${jejumTxt} (recomendação do livro: ${JEJUM_H[ingesta].horas} h; Tabela 4, p. 847)`] : []),
        ...(calc
          ? [
              'Do capítulo:',
              ...(ceta ? [`- Cetamina — dose terapêutica: ${cetaProibida ? 'contraindicada < 3 meses' : `${faixaBr(ceta, 1)} mg`} (p. 848)`] : []),
              ...(dex ? [`- Dexmedetomidina: ataque ${br(dex.ataqueMcg, 1)} µg em 30 min · manutenção ${faixaBr(dex.manutencaoMcgH, 1)} µg/h (p. 849)`] : []),
              'Sedativos e analgésicos do Apêndice:',
              ...SEDATIVOS_APENDICE.flatMap((b) => bolusTxt(b, p.peso, idadeMeses)),
              'Reversores:',
              ...REVERSORES_APENDICE.flatMap((b) => bolusTxt(b, p.peso, idadeMeses)),
            ]
          : []),
      ],
      fonte: textoFontes(fichaSedacaoProcedimento),
      versao: fichaSedacaoProcedimento.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Sedação para procedimento — criança"
      description="Jejum, ASA, sugestões por tipo de procedimento, sedativos e reversores por peso — cap. 78 e Apêndice do livro do ICr-HCFMUSP."
      ficha={fichaSedacaoProcedimento}
    >
      <CampoPaciente id="sed" p={p} onChange={setP} />

      <Bloco titulo="Jejum (Tabela 4, p. 847)" descricao="Antes de sedação moderada ou profunda.">
        <Opcoes label="Última ingesta" valor={ingesta} opcoes={(Object.keys(JEJUM_H) as Ingesta[]).map((k) => [k, `${JEJUM_H[k].horas} h — ${JEJUM_H[k].rotulo.split(' (')[0]}`])} onChange={setIngesta} />
        <NumberField id="sed-horas" label="Horas desde a ingesta" unit="h" value={horas} onChange={setHoras} min={0} step={0.5} />
        {falta !== null && (
          <p>
            O livro recomenda {JEJUM_H[ingesta].horas} h para {JEJUM_H[ingesta].rotulo.toLowerCase()}:{' '}
            <strong>{falta === 0 ? 'tempo já cumprido' : `faltam ${br(falta, 1)} h`}</strong>.
          </p>
        )}
      </Bloco>

      <Pendencia p={p} />
      {calc && (
        <>
          <Bloco titulo="Do capítulo (p. 848–849)">
            {ceta && (
              <LinhaLivro
                nome="Cetamina — dose terapêutica"
                conta={cetaProibida ? <span className="text-atencao">contraindicada &lt; 3 meses</span> : <strong>{faixaBr(ceta, 1)} mg</strong>}
                texto="1 a 1,5 mg/kg; acima disso aumenta o efeito dissociativo sem benefício; contraindicada em menores de 3 meses"
                pagina="p. 848"
              />
            )}
            {dex && (
              <LinhaLivro
                nome="Dexmedetomidina"
                conta={
                  <span>
                    <strong>{br(dex.ataqueMcg, 1)} µg</strong> em 30 min · {faixaBr(dex.manutencaoMcgH, 1)} µg/h
                  </span>
                }
                texto="ataque de 1 mcg/kg lentamente (até 30 min); manutenção de 0,5 a 1 mcg/kg/hora (a criança pode precisar de mais)"
                pagina="p. 849"
              />
            )}
          </Bloco>
          <Bloco titulo="Sedativos e analgésicos do Apêndice (p. 894–897)">
            {SEDATIVOS_APENDICE.map((b) => <LinhaBolusApendice key={b.id} b={b} peso={p.peso} idadeMeses={idadeMeses} />)}
          </Bloco>
          <Bloco titulo="Reversores (Apêndice, p. 895–896)">
            {REVERSORES_APENDICE.map((b) => <LinhaBolusApendice key={b.id} b={b} peso={p.peso} idadeMeses={idadeMeses} />)}
          </Bloco>
        </>
      )}

      <Bloco titulo="Sugestões por procedimento (Tabela 5, p. 849)">
        <TabelaLivro cabecalho={['Tipo', 'Exemplos', 'Necessidade', 'Sugestão']} linhas={SUGESTOES_PROCEDIMENTO.map((s) => [s.tipo, s.exemplos, s.necessidade, s.sugestao])} largura={640} />
      </Bloco>

      <Bloco titulo="Risco anestésico (Tabela 1, p. 845)" descricao="ASA III ou mais: maior risco de eventos adversos; eletivos devem ser postergados.">
        <TabelaLivro cabecalho={['Classe', 'Descrição']} linhas={ASA.map(([a, b]) => [a, b])} largura={320} />
      </Bloco>

      <Bloco titulo="Cuidados do capítulo">
        {REFERENCIAS_SEDACAO.map((r) => <LinhaReferencia key={r.rotulo} rotulo={r.rotulo} texto={r.texto} pagina={`cap. 78, ${r.pagina}`} />)}
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temConta}
        armadilhas={[...(guia?.armadilhas ?? [])]}
        ficha={fichaSedacaoProcedimento}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(p.peso)} kg${p.anos > 0 || p.meses > 0 ? ` · ${p.anos} a ${p.meses} m` : ''}` : falta !== null ? jejumTxt : 'Informe peso e idade'}
        detalhe={calc ? [jejumTxt, 'doses nas listas acima; "Copiar" leva todas.'].filter(Boolean).join(' · ') : undefined}
        textoCopia={temConta ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
