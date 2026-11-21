import { useState } from 'react'

import {
  DERRAME_IDSA_2026, DIFERENCAS_PAC_2024, DOMICILIAR, DOSES_SBP_2024, DRENAGEM_SBP_2024, DURACAO_DERRAME, ERRATA_PAC, ESPECIAIS, ESQUEMAS_SBP_2024, GRAVIDADE_PAC, HOSPITALAR,
  INTERNACAO_PAC, NOTA_ERITRO_RN, NOTA_MAIOR5, ROTULO_FAIXA, TEXTO_PLEURAL, faixaPac, fichaPneumoniaPed, lerLiquidoPleural, uroquinasePleural,
} from '@/clinico/pediatria/pneumoniaPed'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { calcularDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Opcoes } from './PecasIcr'
import { Aviso, LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { numero } from '@/lib/formato'

const casas = (u: DoseLivro['unidade'], x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/** Linha do "Copiar" com a mesma conta da LinhaDoseLivro; RN sem valor neonatal fica de fora. */
function linhaCopia(d: DoseLivro, peso: number, rn = false, fonte = 'Livro ICr'): string[] {
  if (rn && !d.neonatal) return []
  const r = calcularDoseLivro(d, peso)
  if (!r || (!r.porDose && !r.dia)) return []
  const fmt = (f: [number, number]) => faixaBr(f, casas(d.unidade, f[1]))
  const conta = [r.porDose && `${fmt(r.porDose)} ${d.unidade}/dose`, r.dia && `${fmt(r.dia)} ${d.unidade}/dia`].filter(Boolean).join(' · ')
  return [`- ${d.nome}: ${conta}${r.noMaximo ? ` — limitado ao máximo${d.fonteMaximo ? ` (${d.fonteMaximo})` : ' do livro'}` : ''} · ${d.via} (${fonte}, ${d.pagina})`]
}

/** Pneumonia adquirida na comunidade — cap. 30 do livro do ICr. */
export function PneumoniaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [regime, setRegime] = useState<'domiciliar' | 'hospitalar'>('domiciliar')
  const [pl, setPl] = useState({ ph: 0, glicose: 0, dhl: 0 })
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaPneumoniaPed.id)
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const faixa = p.rn ? 'menor2m' : faixaPac(p.anos * 12 + p.meses)
  const calc = p.peso > 0 && pediatrico && faixa !== null
  const pleural = lerLiquidoPleural(pl.ph, pl.glicose, pl.dhl)
  const tabela = faixa === null ? null : regime === 'hospitalar' ? HOSPITALAR[faixa] : faixa === 'menor2m' ? null : DOMICILIAR[faixa]
  const uro = p.rn ? uroquinasePleural(0) : uroquinasePleural(p.anos * 12 + p.meses)
  const temResultado = calc || pleural !== null

  // Texto do "Copiar" (C3 e C4 = A): as listas de doses que estão na tela para o peso, o líquido pleural e a página.
  const copia = () =>
    textoCopia({
      ferramenta: `Pneumonia adquirida na comunidade — criança (${regime === 'hospitalar' ? 'hospitalar, Tabela 4' : 'domiciliar, Tabela 3'})`,
      dados: [
        ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
        ['Idade', p.anos > 0 || p.meses > 0 ? `${p.anos} anos e ${p.meses} meses` : ''],
        ['Recém-nascido', p.rn ? 'sim' : ''],
        ['Faixa etária da tabela', faixa ? ROTULO_FAIXA[faixa] : ''],
        ['Líquido pleural', pleural ? `pH ${numeroBr(pl.ph)}, glicose ${numeroBr(pl.glicose)} mg/dL, DHL ${numeroBr(pl.dhl)} UI/L` : ''],
      ],
      resultado: [
        ...(calc && tabela
          ? [
              `Escolha inicial — ${ROTULO_FAIXA[faixa!]}:`,
              ...tabela.inicial.flatMap((d) => linhaCopia(d, p.peso, p.rn)),
              'Escolha opcional (falha terapêutica):',
              ...tabela.falha.flatMap((d) => linhaCopia(d, p.peso, p.rn)),
              ...(!p.rn ? ESPECIAIS.flatMap((s) => [`${s.titulo}:`, ...s.doses.flatMap((d) => linhaCopia(d, p.peso))]) : []),
            ]
          : []),
        ...(calc && !tabela ? ['A Tabela 3 (domiciliar) começa em 2 meses; menores de 2 meses estão entre os critérios de internação (p. 312).'] : []),
        ...(calc ? ['PAC complicada — SBP 2024 (Quadro 2, p. 9–10):', ...DOSES_SBP_2024.flatMap((d) => linhaCopia(d, p.peso, false, 'SBP 2024'))] : []),
        ...(uro && (p.rn || p.anos > 0 || p.meses > 0) ? [`Uroquinase intrapleural pela idade: ${numero(uro.ui)} UI em ${uro.mlSf} mL de SF 0,9% (SBP 2024, p. 12–13)`] : []),
        ...(pleural ? [`Líquido pleural: ${TEXTO_PLEURAL[pleural]}`] : []),
      ],
      fonte: textoFontes(fichaPneumoniaPed),
      versao: fichaPneumoniaPed.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Pneumonia adquirida na comunidade — criança"
      description="Antibiótico empírico domiciliar e hospitalar por faixa etária e peso (Tabelas 3 e 4), situações especiais, sinais de gravidade e líquido pleural — livro do ICr-HCFMUSP."
      ficha={fichaPneumoniaPed}
    >
      <CampoPaciente id="pac" p={p} onChange={setP} />
      <Bloco titulo="Regime">
        <Opcoes label="Tratamento" valor={regime} opcoes={[['domiciliar', 'Domiciliar (Tabela 3)'], ['hospitalar', 'Hospitalar (Tabela 4)']]} onChange={setRegime} />
        {faixa && <p className="text-tinta-sussurro">Faixa etária da tabela: {ROTULO_FAIXA[faixa]}{p.rn ? ' (RN)' : ''}.</p>}
        <Nota>{INTERNACAO_PAC}</Nota>
      </Bloco>

      {!calc ? (
        <Aviso>Informe o peso para calcular as doses.</Aviso>
      ) : !tabela ? (
        <Aviso>A Tabela 3 (domiciliar) começa em 2 meses; menores de 2 meses estão entre os critérios de internação (p. 312).</Aviso>
      ) : (
        <>
          <Bloco titulo={`Escolha inicial — ${ROTULO_FAIXA[faixa!]}`}>
            {tabela.inicial.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} ampola={`pneumonia:${d.id}`} />)}
          </Bloco>
          <Bloco titulo="Escolha opcional (falha terapêutica)">
            {tabela.falha.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} ampola={`pneumonia:${d.id}`} />)}
            {faixa === 'maior5a' && regime === 'domiciliar' && <Nota>{NOTA_MAIOR5}</Nota>}
          </Bloco>
          {!p.rn && (
            <Bloco titulo="Situações especiais (p. 312–313)">
              {ESPECIAIS.map((s) => (
                <div key={s.titulo} className="flex flex-col gap-2">
                  <p className="font-medium">{s.titulo}</p>
                  {s.doses.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} ampola={`pneumonia:${d.id}`} />)}
                </div>
              ))}
              <Nota>{NOTA_ERITRO_RN}</Nota>
            </Bloco>
          )}
        </>
      )}

      <Bloco titulo="Sinais de gravidade (p. 309)">
        <TabelaLivro cabecalho={['Idade', 'Sinais']} linhas={GRAVIDADE_PAC.map((g) => [g.faixa, g.sinais])} largura={360} />
      </Bloco>

      <Bloco titulo="Líquido pleural seroso (p. 314)">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField id="pac-ph" label="pH" value={pl.ph} onChange={(x) => setPl({ ...pl, ph: x })} min={0} step={0.01} />
          <NumberField id="pac-gli" label="Glicose" unit="mg/dL" value={pl.glicose} onChange={(x) => setPl({ ...pl, glicose: x })} min={0} />
          <NumberField id="pac-dhl" label="DHL" unit="UI/L" value={pl.dhl} onChange={(x) => setPl({ ...pl, dhl: x })} min={0} />
        </div>
        {pleural && <p>{TEXTO_PLEURAL[pleural]}</p>}
        <Nota>Líquido purulento é empiema: só análise microbiológica (p. 314). {DURACAO_DERRAME}</Nota>
      </Bloco>
      <Bloco titulo="PAC complicada — SBP 2024 (Quadro 2, p. 9–10) e derrame — IDSA/PIDS 2026" descricao="Documento científico da SBP lido no PDF; recomendações IDSA/PIDS 2026 pelo resumo (texto integral bloqueado). Doses IV da PAC complicada pelo peso informado.">
        {calc ? DOSES_SBP_2024.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} ampola={`pneumonia:${d.id}`} />) : <Nota>Informe peso e idade pediátrica para as doses por peso.</Nota>}
        {ESQUEMAS_SBP_2024.map((e) => <p key={e.situacao} className="text-tinta-sussurro"><span className="font-medium text-tinta">{e.situacao}:</span> {e.texto} (SBP 2024, {e.pagina})</p>)}
        <p><span className="font-medium">Drenagem pleural simples (SBP 2024, p. 13):</span> {DRENAGEM_SBP_2024.indicacoes.join('; ')}. Falha: {DRENAGEM_SBP_2024.falha.join('; ')}. Retirada do dreno: {DRENAGEM_SBP_2024.retirada}.</p>
        <p className="text-tinta-sussurro">Empiema (p. 7): {DRENAGEM_SBP_2024.empiema}. Fibrinolítico (p. 12–13): {DRENAGEM_SBP_2024.fibrinolitico}.</p>
        {uro && <p>Uroquinase intrapleural pela idade: <strong>{numero(uro.ui)} UI em {uro.mlSf} mL de SF 0,9%</strong> (SBP 2024, p. 12–13).</p>}
        {DERRAME_IDSA_2026.map((d) => <p key={d.tema} className="text-tinta-sussurro"><span className="font-medium text-tinta">{d.tema}:</span> {d.texto} (IDSA/PIDS 2026)</p>)}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={[`PCR — errata do livro: ${ERRATA_PAC}`, ...(guia?.armadilhas ?? [])]}
        ficha={fichaPneumoniaPed}
        guia={guia}
        comparacao={
          <BlocoComparacao titulo="Livro do ICr × SBP 2024 e IDSA/PIDS 2026" resumo="Diferenças entre o capítulo do livro e os documentos lidos ao lado dele. As doses da tela seguem cada fonte citada.">
            <ul className="list-disc pl-5 text-tinta-sussurro">{DIFERENCAS_PAC_2024.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={calc ? `${p.rn ? 'Recém-nascido' : 'Criança'} · ${numeroBr(p.peso)} kg · ${ROTULO_FAIXA[faixa!]} · ${regime}` : 'Informe o peso'}
        detalhe={calc && !tabela ? 'A Tabela 3 (domiciliar) começa em 2 meses: veja o aviso acima.' : calc ? 'Doses do peso nas listas acima; "Copiar" leva todas.' : pleural ? 'Leitura do líquido pleural no bloco acima; "Copiar" leva o texto.' : undefined}
        textoCopia={temResultado ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
