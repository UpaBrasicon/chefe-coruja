import { useState } from 'react'

import {
  AVISO_AAP_2026, DOSES_ITU_ORAL, DOSES_ITU_PARENTERAL, ERRATA_ITU, FAIXAS_ITU, FATORES_FIGURA2, FIGURA2_ENTRADA, LEUCOCITURIA, NOTA_CONTAGEM_AAP, NOTA_ESCOLHA_AAP, NOTA_FIGURA1,
  NOTA_FIGURA2, NOTA_LIMIARES_AAP, NOTA_NITRITO, NOTA_VIA_AAP, OPCOES_ESTERASE, OPCOES_LEUCOCITOS, QUADRO3, REFERENCIAS_ITU, REFERENCIA_AAP, REFERENCIA_LIVRO, SEM_URINALISE,
  faixaCompativel, fichaItuPed, lerUrinaliseAap, lerUrocultura, usaAap, type Coleta, type FaixaItu, type Urinalise,
} from '@/clinico/pediatria/ituPed'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { calcularDoseLivro, textoDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaDoseLivro } from './PecasP4'

const casasDose = (u: DoseLivro['unidade'], x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/** Linha do "Copiar" com a mesma conta da LinhaDoseLivro (PecasP4). */
function linhaDoseLivro(d: DoseLivro, peso: number): string[] {
  const r = calcularDoseLivro(d, peso)
  if (!r) return []
  const fmt = (f: [number, number]) => faixaBr(f, casasDose(d.unidade, f[1]))
  const conta = [r.porDose && `${fmt(r.porDose)} ${d.unidade}/dose`, r.dia && `${fmt(r.dia)} ${d.unidade}/dia`].filter(Boolean).join(' · ')
  return [`- ${d.nome}: ${conta}${r.noMaximo ? ` (limitado ao máximo${d.fonteMaximo ? `, ${d.fonteMaximo}` : ' do livro'})` : ''} · o livro traz ${textoDoseLivro(d)} · ${d.via} (Livro ICr, ${d.pagina})`]
}

const COLETAS: [Coleta, string][] = [['sondagem', 'Sondagem vesical'], ['psp', 'Punção suprapúbica'], ['jato', 'Jato médio'], ['saco', 'Saco coletor']]

/** Infecção urinária na criança — cap. 57 do livro do ICr; AAP 2026 de 8 dias a 5 anos. */
export function InfeccaoUrinariaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [faixa, setFaixa] = useState<FaixaItu | ''>('')
  const [ua, setUa] = useState<Urinalise>(SEM_URINALISE)
  const [coleta, setColeta] = useState<Coleta>('sondagem')
  const [ufc, setUfc] = useState(0)
  const [umGerme, setUmGerme] = useState(true)
  const aap = faixa !== '' && usaAap(faixa)
  const leituraUa = faixa !== '' ? lerUrinaliseAap(faixa, ua) : null
  const uro = faixa !== '' && (ufc > 0 || coleta === 'saco') ? lerUrocultura(faixa, coleta, ufc, umGerme, ua) : null
  const incompativel = faixa !== '' && !faixaCompativel(faixa, p.anos, p.meses, p.rn)
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaItuPed.id)
  const rotulo = <T,>(ops: [T, string][], v: T) => ops.find(([x]) => x === v)?.[1] ?? ''
  const temResultado = calc || leituraUa !== null || uro !== null

  // Texto do "Copiar" (C3 e C4 = A): dados, leitura da urinálise e da urocultura e as listas de antibióticos da tela, com a página.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'Infecção urinária — criança',
        dados: [
          ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
          ['Idade', `${p.anos} anos e ${p.meses} meses`],
          ['Recém-nascido', p.rn ? 'sim' : ''],
          ['Faixa de idade', faixa !== '' ? rotulo(FAIXAS_ITU, faixa) : ''],
          ['Leucócitos por campo', aap ? rotulo(OPCOES_LEUCOCITOS, ua.leucocitos) : ''],
          ['Esterase leucocitária', aap ? rotulo(OPCOES_ESTERASE, ua.esterase) : ''],
          ['Coleta da urocultura', uro ? rotulo(COLETAS, coleta) : ''],
          ['Contagem', uro && ufc > 0 ? `${numeroBr(ufc)} UFC/mL` : ''],
          ['Crescimento', uro ? (umGerme ? 'um uropatógeno' : 'mais de um germe') : ''],
        ],
        resultado: [
          ...(faixa !== '' ? [`Referência aplicada: ${aap ? REFERENCIA_AAP : REFERENCIA_LIVRO}`] : []),
          ...(leituraUa ? [leituraUa] : []),
          ...(uro ? uro.linhas : []),
          ...(calc
            ? [
                'Via oral (Tabela 3, p. 597):',
                ...DOSES_ITU_ORAL.flatMap((d) => linhaDoseLivro(d, p.peso)),
                'Via parenteral (Tabela 4, p. 597–598):',
                ...DOSES_ITU_PARENTERAL.flatMap((d) => linhaDoseLivro(d, p.peso)),
              ]
            : []),
        ],
        fonte: textoFontes(fichaItuPed),
        versao: fichaItuPed.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Infecção urinária — criança"
      description="Quem testar e leitura da urinálise e da urocultura pela AAP 2026 de 8 dias a 5 anos (pelo livro fora dessa faixa), e antibióticos orais e parenterais por peso (Tabelas 3 e 4) — livro do ICr-HCFMUSP."
      ficha={fichaItuPed}
    >
      <CampoPaciente id="itu" p={p} onChange={setP} />

      <div role="note" className="flex flex-col gap-1 rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">
        <p className="font-medium">Diretriz nova da AAP (Pediatrics, out/2026), posterior ao livro</p>
        <ul className="list-disc pl-5">
          {AVISO_AAP_2026.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>

      <Bloco titulo="Testar a urina? Figura 2 da AAP 2026 (CPG p. 28)" descricao={FIGURA2_ENTRADA}>
        <p>Fatores de risco (sem número mínimo):</p>
        <ul className="list-disc pl-5">
          {FATORES_FIGURA2.map((f) => <li key={f}>{f}</li>)}
        </ul>
        <Nota>{NOTA_FIGURA2}</Nota>
        <Nota>{NOTA_FIGURA1}</Nota>
      </Bloco>

      <Bloco
        titulo="Urinálise e urocultura"
        descricao="A faixa de idade decide a referência: de 8 dias a 5 anos, AAP 2026 (Tabela 1, CPG p. 5); até 7 dias e acima de 5 anos, livro do ICr (p. 593–595)."
      >
        <Opcoes label="Faixa de idade" valor={faixa} opcoes={FAIXAS_ITU} onChange={setFaixa} />
        {incompativel && <p className="text-atencao">A faixa marcada não bate com a idade digitada acima. Confira.</p>}
        {faixa === '' && <p className="text-tinta-sussurro">Escolha a faixa de idade para ler a urinálise e a urocultura.</p>}
        {faixa !== '' && (
          <p>
            Referência aplicada: <strong>{aap ? REFERENCIA_AAP : REFERENCIA_LIVRO}</strong>
          </p>
        )}

        {aap && (
          <>
            <Opcoes label="Leucócitos por campo de grande aumento (urina não centrifugada)" valor={ua.leucocitos} opcoes={OPCOES_LEUCOCITOS} onChange={(leucocitos) => setUa({ ...ua, leucocitos })} />
            <Opcoes label="Esterase leucocitária" valor={ua.esterase} opcoes={OPCOES_ESTERASE} onChange={(esterase) => setUa({ ...ua, esterase })} />
            <Nota>{NOTA_CONTAGEM_AAP}</Nota>
            {leituraUa && <p>{leituraUa}</p>}
            <Nota>{NOTA_LIMIARES_AAP}</Nota>
            <Nota>{NOTA_NITRITO}</Nota>
          </>
        )}
        {faixa !== '' && !aap && (
          <Nota>
            Leucocitúria pelo livro: ≥ {LEUCOCITURIA.centrifugadaCampo}/campo (centrifugada) ou ≥ {LEUCOCITURIA.naoCentrifugadaMm3}/mm³ = 10.000/mL (não centrifugada) (p. 593).
          </Nota>
        )}

        {faixa !== '' && (
          <>
            <Opcoes label="Coleta da urocultura" valor={coleta} opcoes={COLETAS} onChange={setColeta} />
            <NumberField id="itu-ufc" label="Contagem" unit="UFC/mL" value={ufc} onChange={setUfc} min={0} step={1000} />
            <Opcoes label="Crescimento" valor={umGerme} opcoes={[[true, 'Um uropatógeno'], [false, 'Mais de um germe']]} onChange={setUmGerme} />
            {uro && uro.linhas.map((l) => <p key={l}>{l}</p>)}
          </>
        )}
      </Bloco>

      <Pendencia p={p} />
      <Nota>{NOTA_ESCOLHA_AAP}</Nota>
      {calc && (
        <>
          <Bloco titulo="Via oral (Tabela 3, p. 597)">
            {DOSES_ITU_ORAL.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} ampola={`itu:${d.id}`} />)}
          </Bloco>
          <Bloco titulo="Via parenteral (Tabela 4, p. 597–598)">
            {DOSES_ITU_PARENTERAL.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} ampola={`itu:${d.id}`} />)}
          </Bloco>
        </>
      )}
      {p.rn && <Nota>No recém-nascido o livro associa ampicilina à cefalosporina de 3ª geração ou aminoglicosídeo, sem dose neonatal (p. 596).</Nota>}

      <Bloco titulo="Tratamento parenteral e internação na pielonefrite (Quadro 3, p. 596–597)">
        <Nota>{NOTA_VIA_AAP}</Nota>
        <ul className="list-disc pl-5 text-tinta-sussurro">
          {QUADRO3.map((q) => <li key={q}>{q}</li>)}
        </ul>
      </Bloco>
      <Bloco titulo="Do capítulo">
        {REFERENCIAS_ITU.map((r) => (
          <div key={r.texto} className="flex flex-col gap-1">
            <Nota>
              {r.texto} ({r.pagina})
            </Nota>
            {r.notaAap && <Nota>{r.notaAap}</Nota>}
          </div>
        ))}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={[
          `Errata do livro: ${ERRATA_ITU}`,
          ...[...DOSES_ITU_ORAL, ...DOSES_ITU_PARENTERAL].filter((d) => d.errata).map((d) => `${d.nome} — errata do livro (${d.pagina}): ${d.errata}`),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaItuPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(p.peso)} kg${p.anos > 0 || p.meses > 0 ? ` · ${p.anos} a ${p.meses} m` : ''}` : p.rn ? 'Recém-nascido: sem dose neonatal no capítulo' : idadePediatrica(p.anos, p.meses) ? 'Informe o peso' : 'A partir de 14 anos é adulto: ferramenta pediátrica'}
        detalhe={leituraUa ?? uro?.linhas[0] ?? (faixa !== '' ? `Referência: ${aap ? REFERENCIA_AAP : REFERENCIA_LIVRO}` : undefined)}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
