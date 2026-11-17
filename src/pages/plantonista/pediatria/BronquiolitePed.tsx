import { useState } from 'react'

import {
  AUSTRALASIA_ITENS, COMORBIDADES_NIRSEVIMABE, FATORES_RISCO, FR_HIDRATACAO, INDICACOES_INTERNACAO, NIRSEVIMABE, REFERENCIAS_BRONQUIOLITE, criteriosNirsevimabe,
  criteriosPalivizumabe, fichaBronquiolite, fluxoCnafLMin, indicacoesPresentes,
} from '@/clinico/pediatria/bronquiolite'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaReferencia } from './PecasP2'
import { Marcadores } from './PecasP4'

/** Bronquiolite — cap. 29 do livro do ICr. */
export function BronquiolitePed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [fr, setFr] = useState(0)
  const [achados, setAchados] = useState<Set<string>>(new Set())
  const [riscos, setRiscos] = useState<Set<string>>(new Set())
  const [ig, setIg] = useState(0)
  const [dpc, setDpc] = useState(false)
  const [cardio, setCardio] = useState(false)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaBronquiolite.id)
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const cnaf = !p.rn && pediatrico ? fluxoCnafLMin(p.peso) : null
  const presentes = indicacoesPresentes(achados, fr > 0 ? fr : null)
  const pali = criteriosPalivizumabe({ idadeMeses: p.anos * 12 + p.meses, igSemanas: ig > 0 ? ig : null, dpc, cardiopatia: cardio })
  const [comorb, setComorb] = useState<Set<string>>(new Set())
  const [sazonal, setSazonal] = useState<'?' | 'sim' | 'nao'>('?')
  const nirse = criteriosNirsevimabe({ idadeMeses: p.anos * 12 + p.meses, igSemanas: ig > 0 ? ig : null, comorbidades: comorb, periodoSazonal: sazonal === '?' ? null : sazonal === 'sim' })
  const temResultado = presentes.length > 0 || cnaf !== null || nirse.elegivel || pali.length > 0

  // Texto do "Copiar" (C4 = A): o que a tela leu dos dados informados, com a página ou o documento.
  const copia = () =>
    textoCopia({
      ferramenta: 'Bronquiolite — internação, CNAF e nirsevimabe',
      dados: [
        ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
        ['Idade', p.anos > 0 || p.meses > 0 ? `${p.anos} anos e ${p.meses} meses` : ''],
        ['Recém-nascido', p.rn ? 'sim' : ''],
        ['FR', fr > 0 ? `${numeroBr(fr)} irpm` : ''],
        ['IG ao nascer', ig > 0 ? `${numeroBr(ig)} semanas` : ''],
        ['Período sazonal', sazonal === '?' ? '' : sazonal === 'sim' ? 'sim' : 'não'],
      ],
      resultado: [
        presentes.length > 0 ? `Indicações de internação do livro presentes (p. 302–303): ${presentes.join('; ')}` : 'Nenhum achado da lista de internação do livro marcado (p. 302–303)',
        ...(riscos.size > 0 ? [`Pesam na decisão (p. 303): ${FATORES_RISCO.filter((f) => riscos.has(f.id)).map((f) => f.texto).join('; ')}`] : []),
        ...(cnaf ? [`CNAF: ${faixaBr(cnaf, 1)} L/min (1 a 2 L/kg/min, Livro ICr, p. 303)`] : []),
        nirse.elegivel ? `Nirsevimabe: elegível pelo MS — ${nirse.motivos.join('; ')} (${NIRSEVIMABE.pagina})` : `Nirsevimabe: nenhum critério do MS preenchido com os dados informados (${NIRSEVIMABE.pagina})`,
        pali.length > 0 ? `Palivizumabe: critério(s) do livro presentes — ${pali.join('; ')} (p. 304)` : 'Palivizumabe: nenhum critério do livro preenchido com os dados informados (p. 304)',
      ],
      fonte: textoFontes(fichaBronquiolite),
      versao: fichaBronquiolite.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Bronquiolite — internação, CNAF e nirsevimabe"
      description="Indicações de internação, fatores de risco, fluxo da cânula nasal de alto fluxo por peso (livro do ICr-HCFMUSP), elegibilidade ao nirsevimabe pelo MS (2025/2026) e o que a diretriz australasiana 2025 escreve. O capítulo não traz escore nem dose de medicamento."
      ficha={fichaBronquiolite}
    >
      <CampoPaciente id="bq" p={p} onChange={setP} />

      <Bloco titulo="Indicações de internação (p. 302–303)" descricao="Marque o que está presente. A decisão é do médico.">
        <NumberField id="bq-fr" label="Frequência respiratória" unit="irpm" value={fr} onChange={setFr} min={0} />
        <Marcadores itens={INDICACOES_INTERNACAO} marcados={achados} onChange={setAchados} />
        {presentes.length > 0 ? (
          <p>
            <strong>{presentes.length}</strong> achado(s) que o livro lista como indicação de internação: {presentes.join('; ')}.
          </p>
        ) : (
          <p className="text-tinta-sussurro">Nenhum achado da lista do livro marcado.</p>
        )}
        {fr > FR_HIDRATACAO && <Nota>FR acima de {FR_HIDRATACAO}: o livro cita diminuição da ingesta e possível necessidade de hidratação EV (isotônicos) ou por sonda (p. 303).</Nota>}
        <p className="font-medium">Pesam na decisão (p. 303):</p>
        <Marcadores itens={FATORES_RISCO} marcados={riscos} onChange={setRiscos} />
      </Bloco>

      <Pendencia p={p} />
      {cnaf && (
        <Bloco titulo="Cânula nasal de alto fluxo (p. 303)">
          <LinhaLivro nome="Fluxo" conta={<strong>{faixaBr(cnaf, 1)} L/min</strong>} texto="1 a 2 L/kg/min" pagina="p. 303" nota="CPAP e CNAF são intercambiáveis; o CNAF inicial teve mais falha que o CPAP em estudo multicêntrico (p. 303)." />
        </Bloco>
      )}

      <Bloco titulo="Nirsevimabe — Ministério da Saúde (NT 109/2025; Guia VSR 2026)" descricao={`${NIRSEVIMABE.prematuro}. ${NIRSEVIMABE.comorbidade}. ${NIRSEVIMABE.segundaSazonalidade}. (${NIRSEVIMABE.pagina})`}>
        <NumberField id="bq-ig" label="Idade gestacional ao nascer" unit="semanas" value={ig} onChange={setIg} min={0} max={42} />
        <Marcadores itens={COMORBIDADES_NIRSEVIMABE} marcados={comorb} onChange={setComorb} />
        <Opcoes label="Estamos no período sazonal (fevereiro a agosto)?" valor={sazonal} opcoes={[['?', 'Não sei'], ['sim', 'Sim'], ['nao', 'Não']]} onChange={setSazonal} />
        {nirse.elegivel ? <p>Elegível pelo MS: <strong>{nirse.motivos.join('; ')}</strong>.</p> : <p className="text-tinta-sussurro">Nenhum critério do MS preenchido com os dados informados.</p>}
        {nirse.avisos.map((a) => <Nota key={a}>{a}</Nota>)}
        <p className="text-tinta-sussurro">{NIRSEVIMABE.apresentacao}. {NIRSEVIMABE.onde}. {NIRSEVIMABE.transicao}.</p>
      </Bloco>

      <Bloco titulo="Palivizumabe — critério do livro (p. 304), válido na transição de 2026" descricao="Portaria SAS-SCTIE/MS n. 23/2018 citada no livro. &quot;Até 2 anos&quot; lido como até 24 meses completos. Em 2026 vale para quem já iniciou o esquema ou enquanto houver estoque.">
        <Opcoes label="Doença pulmonar crônica da prematuridade" valor={dpc} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setDpc} />
        <Opcoes label="Cardiopatia congênita com repercussão hemodinâmica" valor={cardio} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setCardio} />
        {pali.length > 0 ? <p>Critério(s) do livro presentes: <strong>{pali.join('; ')}</strong>.</p> : <p className="text-tinta-sussurro">Nenhum critério do livro preenchido com os dados informados.</p>}
      </Bloco>

      <Bloco titulo="Diretriz australasiana de bronquiolite — atualização 2025">
        {AUSTRALASIA_ITENS.map((r) => <LinhaReferencia key={r.rotulo} rotulo={r.rotulo} texto={r.texto} pagina={r.pagina} />)}
      </Bloco>

      <Bloco titulo="Do capítulo">
        {REFERENCIAS_BRONQUIOLITE.map((r) => <LinhaReferencia key={r.rotulo} rotulo={r.rotulo} texto={r.texto} pagina={`cap. 29, ${r.pagina}`} />)}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaBronquiolite}
        guia={guia}
      />
      <ResumoFlutuante
        principal={presentes.length > 0 ? `${presentes.length} indicação(ões) de internação do livro` : temResultado ? 'Nenhuma indicação de internação marcada' : 'Marque os achados ou informe o peso'}
        detalhe={[cnaf && `CNAF ${faixaBr(cnaf, 1)} L/min`, nirse.elegivel && 'nirsevimabe: elegível pelo MS', pali.length > 0 && 'palivizumabe: critério do livro presente'].filter(Boolean).join(' · ') || undefined}
        textoCopia={temResultado ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
