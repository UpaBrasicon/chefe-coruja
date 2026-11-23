import { useState } from 'react'

import {
  BMS_CRITERIOS, DOSES_MENINGITE, DOSES_PROFILAXIA, DURACAO, ERRATA_BMS, ERRATA_LIQUOR, LIQUOR, REFERENCIAS_MENINGITE, bms, fichaMeningitePed, leucocitosLiquorAjustados,
  leucocitosLiquorEstimativa, proteinaLiquorAjustada,
} from '@/clinico/pediatria/meningitePed'
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

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Nota } from './PecasIcr'
import { Aviso, LinhaDoseLivro, Marcadores, TabelaLivro } from './PecasP4'

const casasDose = (u: DoseLivro['unidade'], x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/** Linha do "Copiar" com a mesma conta da LinhaDoseLivro (PecasP4); no RN, só as linhas com valor neonatal. */
function linhaDoseLivro(d: DoseLivro, peso: number, rn = false): string[] {
  if (rn && !d.neonatal) return []
  const r = calcularDoseLivro(d, peso)
  if (!r) return []
  const fmt = (f: [number, number]) => faixaBr(f, casasDose(d.unidade, f[1]))
  const conta = [r.porDose && `${fmt(r.porDose)} ${d.unidade}/dose`, r.dia && `${fmt(r.dia)} ${d.unidade}/dia`].filter(Boolean).join(' · ')
  return [`- ${d.nome}: ${conta}${r.noMaximo ? ` (limitado ao máximo${d.fonteMaximo ? `, ${d.fonteMaximo}` : ' do livro'})` : ''} · o livro traz ${textoDoseLivro(d)} · ${d.via} (Livro ICr, ${d.pagina})`]
}

/** Meningite na criança — cap. 40 do livro do ICr. */
export function MeningitePed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [lcr, setLcr] = useState({ leucLiquor: 0, hemLiquor: 0, leucSangue: 0, hemSangue: 0, proteina: 0 })
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const calc = p.peso > 0 && pediatrico
  const ajust = leucocitosLiquorAjustados(lcr)
  const estim = lcr.leucLiquor > 0 || lcr.hemLiquor > 0 ? leucocitosLiquorEstimativa(lcr.leucLiquor, lcr.hemLiquor) : null
  const prot = lcr.proteina > 0 ? proteinaLiquorAjustada(lcr.proteina, lcr.hemLiquor) : null
  const escore = bms(marcados)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaMeningitePed.id)
  const textoBms = `${escore.pontos} critério(s) presente(s): ${escore.muitoBaixoRisco ? 'muito baixo risco pelo BMS' : 'não é muito baixo risco pelo BMS'}`

  // Texto do "Copiar" (C3 e C4 = A): dados, liquor ajustado, BMS e as listas de doses da tela, com a página.
  const copia = calc
    ? textoCopia({
        ferramenta: 'Meningite — criança',
        dados: [
          ['Peso', `${numeroBr(p.peso)} kg`],
          ['Idade', `${p.anos} anos e ${p.meses} meses`],
          ['Recém-nascido', p.rn ? 'sim' : ''],
          ['Leucócitos no liquor', lcr.leucLiquor > 0 ? `${numeroBr(lcr.leucLiquor)}/mm³` : ''],
          ['Hemácias no liquor', lcr.hemLiquor > 0 ? `${numeroBr(lcr.hemLiquor)}/mm³` : ''],
          ['Proteína no liquor', lcr.proteina > 0 ? `${numeroBr(lcr.proteina)} mg/dL` : ''],
          ['Leucócitos no sangue', lcr.leucSangue > 0 ? `${numeroBr(lcr.leucSangue)}/mm³` : ''],
          ['Hemácias no sangue', lcr.hemSangue > 0 ? `${numeroBr(lcr.hemSangue)}/mm³` : ''],
        ],
        resultado: [
          ...(ajust !== null ? [`Leucócitos ajustados (fórmula): ${br(ajust, 1)}/mm³ (p. 409)`] : []),
          ...(estim ? [`Estimativa rápida (1 leucócito a cada 500 a 1.500 hemácias): ${br(estim[0], 0)} a ${br(estim[1], 0)}/mm³ (p. 409)`] : []),
          ...(prot !== null ? [`Proteína ajustada (−1 mg/dL a cada 1.000 hemácias): ${br(prot, 1)} mg/dL (p. 409)`] : []),
          `Bacterial Meningitis Score (p. 410): ${textoBms}`,
          `Tratamento (p. 410–411)${p.rn ? ' — recém-nascido: só as linhas com valor neonatal do livro' : ''}:`,
          ...DOSES_MENINGITE.flatMap((d) => linhaDoseLivro(d, p.peso, p.rn)),
          'Quimioprofilaxia de contatos (p. 412–413):',
          ...DOSES_PROFILAXIA.flatMap((d) => linhaDoseLivro(d, p.peso, p.rn)),
        ],
        fonte: textoFontes(fichaMeningitePed),
        versao: fichaMeningitePed.versao,
        quando: new Date(),
      })
    : undefined
  const campo = (k: keyof typeof lcr, label: string, unit: string) => (
    <NumberField id={`men-${k}`} label={label} unit={unit} value={lcr[k]} onChange={(x) => setLcr({ ...lcr, [k]: x })} min={0} />
  )

  return (
    <ToolLayout
      title="Meningite — criança"
      description="Liquor no acidente de punção, Bacterial Meningitis Score, antibióticos empíricos (neonatal e pós-neonatal), aciclovir, dexametasona e quimioprofilaxia — livro do ICr-HCFMUSP."
      ficha={fichaMeningitePed}
    >
      <CampoPaciente id="men" p={p} onChange={setP} />

      <Bloco titulo="Acidente de punção (p. 409)">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {campo('leucLiquor', 'Leucócitos no liquor', '/mm³')}
          {campo('hemLiquor', 'Hemácias no liquor', '/mm³')}
          {campo('proteina', 'Proteína no liquor', 'mg/dL')}
          {campo('leucSangue', 'Leucócitos no sangue', '/mm³')}
          {campo('hemSangue', 'Hemácias no sangue', '/mm³')}
        </div>
        {ajust !== null && <p>Leucócitos ajustados (fórmula): <strong className="tabular-nums">{br(ajust, 1)}/mm³</strong></p>}
        {estim && <p className="text-tinta-sussurro">Estimativa rápida (1 leucócito a cada 500 a 1.500 hemácias): {br(estim[0], 0)} a {br(estim[1], 0)}/mm³.</p>}
        {prot !== null && <p>Proteína ajustada (−1 mg/dL a cada 1.000 hemácias): <strong className="tabular-nums">{br(prot, 1)} mg/dL</strong></p>}
      </Bloco>

      <Bloco titulo="Bacterial Meningitis Score (p. 410)" descricao="Criança com pleocitose. Muito baixo risco (0,1%) só se todos ausentes; qualquer critério presente: tratar como bacteriana até as culturas.">
        <Marcadores itens={BMS_CRITERIOS} marcados={marcados} onChange={setMarcados} />
        <p>
          {escore.pontos} critério(s) presente(s): <strong>{escore.muitoBaixoRisco ? 'muito baixo risco pelo BMS' : 'não é muito baixo risco pelo BMS'}</strong>.
        </p>
      </Bloco>

      {!calc ? (
        <Aviso>Informe o peso para calcular as doses.</Aviso>
      ) : (
        <>
          <Bloco titulo="Tratamento (p. 410–411)" descricao={p.rn ? 'Recém-nascido: só as linhas com valor neonatal do livro calculam.' : undefined}>
            {DOSES_MENINGITE.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} ampola={`meningite:${d.id}`} />)}
          </Bloco>
          <Bloco titulo="Quimioprofilaxia de contatos (p. 412–413)">
            {DOSES_PROFILAXIA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} ampola={`meningite:${d.id}`} />)}
          </Bloco>
        </>
      )}

      <Bloco titulo="Duração por agente (Tabela 5, p. 410)" descricao="Empírico: 14 dias no neonato e 10 dias nas demais idades.">
        <TabelaLivro cabecalho={['Microrganismo', 'Duração']} linhas={DURACAO.map(([a, b]) => [a, b])} largura={320} />
      </Bloco>
      <Bloco titulo="Liquor por etiologia (Tabela 4, p. 409) — referência">
        <TabelaLivro cabecalho={['', 'Normal', 'Vírus', 'Bactéria', 'Fungo', 'Tuberculose']} linhas={LIQUOR.map((l) => [l.lab, l.normal, l.virus, l.bacteria, l.fungo, l.tb])} largura={680} />
      </Bloco>
      <Bloco titulo="Do capítulo">
        {REFERENCIAS_MENINGITE.map((r) => (
          <Nota key={r.texto}>
            {r.texto} ({r.pagina})
          </Nota>
        ))}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc}
        armadilhas={[
          `Errata do livro (BMS, p. 410): ${ERRATA_BMS}`,
          `Errata do livro (Tabela 4, p. 409): ${ERRATA_LIQUOR}`,
          ...[...DOSES_MENINGITE, ...DOSES_PROFILAXIA].filter((d) => d.errata).map((d) => `${d.nome} — errata do livro (${d.pagina}): ${d.errata}`),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaMeningitePed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `${p.rn ? 'Recém-nascido' : 'Criança'} · ${numeroBr(p.peso)} kg${p.anos > 0 || p.meses > 0 ? ` · ${p.anos} a ${p.meses} m` : ''}` : pediatrico ? 'Informe o peso' : 'A partir de 14 anos é adulto: ferramenta pediátrica'}
        detalhe={`BMS: ${textoBms}`}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
