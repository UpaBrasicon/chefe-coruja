import { useState } from 'react'

import {
  ALTO_RISCO_NF, DIFERENCAS_NF_2023, DOSES_COMPRESSIVAS, DOSES_HEMATO_ONCO, DOSES_NEUTROPENIA, DOSES_SLT, ERRATA_HIDRATACAO, ERRATA_PIC_ONCO, INDICACOES_TSR_SLT, IPFNG_ITENS,
  LIMIARES_PLAQUETAS, NOTA_MASCC_PED, NOTA_NF_SUSPENSAO_PRECOCE, REFERENCIAS_ONCO, TABELA7_HB, alopurinolM2, caspofungina, chOncoMl, classificarSlt, crioOncoU, criteriosLabSlt, diureseAlvoSlt,
  fichaOncologiaPed, hidratacaoSltMlDia, indicaCitorreducao, leituraNeutrofilos, oseltamivirMg, pfcOncoMl, plaquetasOncoMl, produtoCaP,
} from '@/clinico/pediatria/oncologiaPed'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { calcularDoseLivro, textoDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaDoseLivro, Marcadores, TabelaLivro } from './PecasP4'
import { CampoSC, LinhaFaixa, ListaLivro, ListaQuadro } from './PecasP5'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const VARIACAO_25 = [
  { id: 'acidoUrico', texto: 'Ácido úrico: aumento de 25% do basal' },
  { id: 'potassio', texto: 'Potássio: aumento de 25% do basal' },
  { id: 'fosforo', texto: 'Fósforo: aumento de 25% do basal' },
  { id: 'calcio', texto: 'Cálcio: diminuição de 25% do basal' },
]

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

/** Emergências oncológicas — cap. 66 do livro do ICr. */
export function EmergenciasOncologicasPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [scInformada, setSc] = useState(0)
  const [lab, setLab] = useState({ acidoUrico: 0, potassio: 0, fosforo: 0, calcio: 0 })
  const [var25, setVar25] = useState<Set<string>>(new Set())
  const [clinico, setClinico] = useState(false)
  const [leuco, setLeuco] = useState({ leucocitos: 0, neutrofilos: 0 })
  const [tipo, setTipo] = useState<'LMA' | 'LLA'>('LLA')
  const [sintomas, setSintomas] = useState(false)
  const [queda, setQueda] = useState(false)
  const [risco, setRisco] = useState<Set<string>>(new Set())
  const sc = idadePediatrica(p.anos, p.meses) ? scInformada : 0
  const calc = podeCalcular(p)
  const crit = criteriosLabSlt(lab, var25)
  const slt = classificarSlt(crit.length, clinico)
  const cap = produtoCaP(lab.calcio, lab.fosforo)
  const diurese = !p.rn ? diureseAlvoSlt(calc ? p.peso : 0, sc) : null
  const alo = !p.rn ? alopurinolM2(sc) : null
  const cito = indicaCitorreducao(leuco.leucocitos, tipo, sintomas)
  const neut = leuco.neutrofilos > 0 ? leituraNeutrofilos(leuco.neutrofilos, queda) : null
  const caspo = !p.rn ? caspofungina(sc) : null
  const osel = calc ? oseltamivirMg(p.peso) : null
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaOncologiaPed.id)
  const hidra = !p.rn ? hidratacaoSltMlDia(sc) : null
  const textoSlt = `Critérios laboratoriais: ${crit.length ? crit.join(', ') : 'nenhum'} — ${slt === 'sem critério' ? 'não preenche SLT laboratorial' : slt}`
  const textoNf = risco.size > 0 ? 'Neutropenia febril de alto risco (NFAR) pelo livro.' : 'Sem critério de alto risco marcado: baixo risco (NFBR) pelo livro.'
  const crio = calc ? crioOncoU(p.peso) : null
  const temResultado = calc || sc > 0

  // Texto do "Copiar" (C3 e C4 = A): dados, leituras da tela e as listas de volumes e doses, com a página.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'Emergências oncológicas — criança',
        dados: [
          ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
          ['Idade', `${p.anos} anos e ${p.meses} meses`],
          ['Superfície corpórea (informada)', sc > 0 ? `${numeroBr(sc)} m²` : ''],
          ['Ácido úrico', lab.acidoUrico > 0 ? `${numeroBr(lab.acidoUrico)} mg/dL` : ''],
          ['Potássio', lab.potassio > 0 ? `${numeroBr(lab.potassio)} mEq/L` : ''],
          ['Fósforo', lab.fosforo > 0 ? `${numeroBr(lab.fosforo)} mg/dL` : ''],
          ['Cálcio', lab.calcio > 0 ? `${numeroBr(lab.calcio)} mg/dL` : ''],
          ['Alteração clínica', clinico ? 'sim' : ''],
          ['Leucócitos', leuco.leucocitos > 0 ? `${numeroBr(leuco.leucocitos)}/mL (${tipo})` : ''],
          ['Neutrófilos', leuco.neutrofilos > 0 ? `${numeroBr(leuco.neutrofilos)}/mm³` : ''],
        ],
        resultado: [
          `Síndrome de lise tumoral — Cairo e Bishop (Tabela 2, p. 695): ${textoSlt}`,
          ...(cap !== null ? [`Produto Ca × P: ${br(cap, 0)}${cap >= 70 ? ' — ≥ 70: indicação de TSR na SLT (p. 700)' : ''}`] : []),
          ...(!p.rn
            ? [
                'Lise tumoral — hidratação e hipouricemiantes (p. 699–702):',
                ...(hidra ? [`- Hidratação: ${faixaBr(hidra, 0)} mL/dia — 2.000 a 3.000 mL/m²/dia EV, sem potássio, fosfato ou cálcio (p. 699)`] : []),
                ...(diurese?.mlKgH ? [`- Diurese-alvo (≤ 10 kg): ${faixaBr(diurese.mlKgH, 0)} mL/h — 4 a 6 mL/kg/h; densidade urinária < 1.010 (p. 699)`] : []),
                ...(diurese?.mlM2H ? [`- Diurese-alvo (por m²): ${faixaBr(diurese.mlM2H, 0)} mL/h — 80 a 100 mL/m²/h; densidade urinária < 1.010 (p. 699)`] : []),
                ...(alo ? [`- Alopurinol por m²: ${faixaBr(alo.porDose, 0)} mg/dose · ${faixaBr(alo.dia, 0)} mg/dia (teto ${br(alo.maxDia, 0)}) — 50 a 100 mg/m²/dose VO de 8/8 h, máximo 300 mg/m²/dia (p. 700; Tabela 6, p. 702)`] : []),
                ...(calc ? DOSES_SLT.flatMap((d) => linhaDoseLivro(d, p.peso, p.rn)) : []),
              ]
            : []),
          ...(calc
            ? [
                'Hemocomponentes (p. 705–706; Tabela 8, p. 708–709):',
                `- Concentrado de hemácias (irradiado): ${faixaBr(chOncoMl(p.peso), 0)} mL — 10 a 20 mL/kg em até 3 a 4 h (p. 705)`,
                `- Concentrado de plaquetas (irradiado): ${faixaBr(plaquetasOncoMl(p.peso), 0)} mL — 10 mL/kg em 30 a 60 min (p. 706)`,
                `- Plasma fresco congelado: ${faixaBr(pfcOncoMl(p.peso), 0)} mL — 10 a 15 mL/kg (p. 706)`,
                ...(crio !== null ? [`- Crioprecipitado: ${br(crio, 1)} U — 2 U/10 kg (p. 706)`] : []),
                ...DOSES_HEMATO_ONCO.flatMap((d) => linhaDoseLivro(d, p.peso, p.rn)),
              ]
            : []),
          ...(cito !== null ? [cito ? 'Acima do limiar de tratamento da hiperviscosidade do livro (LMA > 100.000; LLA > 200.000 ou > 100.000 com sintomas) (p. 707–708)' : 'Abaixo do limiar de tratamento da hiperviscosidade do livro (p. 707–708)'] : []),
          ...(neut ? [neut === 'profunda' ? 'Neutropenia profunda (< 100/mm³) (p. 707–708)' : neut === 'neutropenia' ? 'Neutropenia pela definição do livro (p. 707–708)' : 'Fora da definição de neutropenia do livro (p. 707–708)'] : []),
          `Neutropenia febril — risco (p. 709–711): ${textoNf}`,
          ...(calc
            ? [
                'Neutropenia febril — antimicrobianos do ICr (Tabela 11, p. 714–715):',
                ...DOSES_NEUTROPENIA.flatMap((d) => linhaDoseLivro(d, p.peso, p.rn)),
                ...(caspo ? [`- Caspofungina: ${br(caspo.ataque, 1)} mg (ataque) · manutenção ${br(caspo.manutencao, 1)} mg/dia — ataque 70 mg/m² IV 1 dose; manutenção 50 mg/m² a cada 24 h; máximo 70 mg/dia (p. 715)`] : []),
                ...(osel ? [`- Oseltamivir: ${faixaBr([osel[0], osel[osel.length - 1]], 0)} mg 12/12 h — < 15 kg 30 mg; 15–23 kg 45 mg; 23–40 kg 60 mg; > 40 kg 75 mg VO de 12/12 h (p. 715)${osel.length > 1 ? '. Com 23 kg exatos o peso cai em duas faixas da tabela.' : ''}`] : []),
                'Síndromes compressivas (p. 717–720; Tabela 12):',
                ...DOSES_COMPRESSIVAS.flatMap((d) => linhaDoseLivro(d, p.peso, p.rn)),
              ]
            : []),
        ],
        fonte: textoFontes(fichaOncologiaPed),
        versao: fichaOncologiaPed.versao,
        quando: new Date(),
      })
    : undefined
  const campo = <T extends Record<string, number>>(obj: T, set: (o: T) => void, k: keyof T & string, label: string, unit: string, step = 0.1) => (
    <NumberField id={`onc-${k}`} label={label} unit={unit} value={obj[k]} onChange={(x) => set({ ...obj, [k]: x })} min={0} step={step} />
  )

  return (
    <ToolLayout
      title="Emergências oncológicas — criança"
      description="Lise tumoral (Cairo-Bishop, hidratação por m², alopurinol, rasburicase, hipercalemia), hemocomponentes, hiperviscosidade, neutropenia febril (alto risco, Tabela 11 do ICr) e síndromes compressivas — livro do ICr-HCFMUSP. A decisão é do médico e do oncologista."
      ficha={fichaOncologiaPed}
    >
      <CampoPaciente id="onc" p={p} onChange={setP} />
      <CampoSC id="onc-sc" valor={scInformada} onChange={setSc} />

      <Bloco titulo="Síndrome de lise tumoral — Cairo e Bishop (Tabela 2, p. 695)" descricao="SLTL: 2 ou mais alterações laboratoriais (3 dias antes a 7 dias depois da QT). SLTC: SLTL + IRA (creatinina ≥ 1,5× o normal), arritmia/morte súbita ou convulsão.">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {campo(lab, setLab, 'acidoUrico', 'Ácido úrico', 'mg/dL')}
          {campo(lab, setLab, 'potassio', 'Potássio', 'mEq/L')}
          {campo(lab, setLab, 'fosforo', 'Fósforo', 'mg/dL')}
          {campo(lab, setLab, 'calcio', 'Cálcio', 'mg/dL')}
        </div>
        <Marcadores itens={VARIACAO_25} marcados={var25} onChange={setVar25} />
        <Opcoes label="Alteração clínica (IRA, arritmia/morte súbita, convulsão)?" valor={clinico} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setClinico} />
        <p>
          Critérios laboratoriais: {crit.length ? crit.join(', ') : 'nenhum'} — <strong>{slt === 'sem critério' ? 'não preenche SLT laboratorial' : slt}</strong>
        </p>
        {cap !== null && <p>Produto Ca × P: <strong className="tabular-nums">{br(cap, 0)}</strong>{cap >= 70 ? ' — ≥ 70: indicação de TSR na SLT (p. 700).' : '.'}</p>}
      </Bloco>

      <Bloco titulo="Lise tumoral — hidratação e hipouricemiantes (p. 699–702)">
        {p.rn ? (
          <Pendencia p={p} />
        ) : (
          <>
            <LinhaFaixa nome="Hidratação" faixa={hidratacaoSltMlDia(sc)} unidade="mL/dia" casas={0} texto="2.000 a 3.000 mL/m²/dia EV, sem potássio, fosfato ou cálcio" pagina="p. 699" errata={ERRATA_HIDRATACAO} />
            {diurese?.mlKgH && <LinhaFaixa nome="Diurese-alvo (≤ 10 kg)" faixa={diurese.mlKgH} unidade="mL/h" casas={0} texto="4 a 6 mL/kg/h; densidade urinária < 1.010" pagina="p. 699" />}
            {diurese?.mlM2H && <LinhaFaixa nome="Diurese-alvo (por m²)" faixa={diurese.mlM2H} unidade="mL/h" casas={0} texto="80 a 100 mL/m²/h; densidade urinária < 1.010" pagina="p. 699" />}
            {alo && <LinhaFaixa nome="Alopurinol por m²" faixa={alo.porDose} unidade="mg/dose" casas={0} texto="50 a 100 mg/m²/dose VO de 8/8 h, máximo 300 mg/m²/dia" pagina="p. 700; Tabela 6, p. 702" extra={<span className="text-tinta-sussurro"> · {faixaBr(alo.dia, 0)} mg/dia (teto {br(alo.maxDia, 0)})</span>} />}
            {calc && DOSES_SLT.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
            {!calc && <Nota>Informe o peso para as doses por kg.</Nota>}
          </>
        )}
        <p className="font-medium">Terapia de substituição renal na SLT (p. 699–700)</p>
        <ListaQuadro itens={INDICACOES_TSR_SLT} pagina="p. 699–700" />
      </Bloco>

      <Bloco titulo="Hemocomponentes (p. 705–706; Tabela 8, p. 708–709)">
        {calc ? (
          <>
            <LinhaFaixa nome="Concentrado de hemácias (irradiado)" faixa={chOncoMl(p.peso)} unidade="mL" casas={0} texto="10 a 20 mL/kg em até 3 a 4 h; cada 10 mL/kg eleva a Hb em 2 a 3 g/dL" pagina="p. 705" />
            <LinhaFaixa nome="Concentrado de plaquetas (irradiado)" faixa={plaquetasOncoMl(p.peso)} unidade="mL" casas={0} texto="10 mL/kg em 30 a 60 min" pagina="p. 706" />
            <LinhaFaixa nome="Plasma fresco congelado" faixa={pfcOncoMl(p.peso)} unidade="mL" casas={0} texto="10 a 15 mL/kg (sangramento significativo com coagulopatia)" pagina="p. 706" />
            <LinhaFaixa nome="Crioprecipitado" faixa={crioOncoU(p.peso) !== null ? [crioOncoU(p.peso)!, crioOncoU(p.peso)!] : null} unidade="U" casas={1} texto="2 U/10 kg, para fibrinogênio > 150 mg/dL; vitamina K 5 mg" pagina="p. 706" />
            {DOSES_HEMATO_ONCO.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          </>
        ) : (
          <Pendencia p={p} />
        )}
        <TabelaLivro cabecalho={['Tabela 7 (p. 705)', 'Descrição', 'Hb para CH (g/dL)']} linhas={TABELA7_HB} largura={520} />
        <ListaQuadro itens={LIMIARES_PLAQUETAS} pagina="p. 706" />
      </Bloco>

      <Bloco titulo="Hemograma — hiperviscosidade e neutropenia (p. 707–708)">
        <div className="grid gap-3 sm:grid-cols-2">
          {campo(leuco, setLeuco, 'leucocitos', 'Leucócitos', '/mL', 1)}
          {campo(leuco, setLeuco, 'neutrofilos', 'Neutrófilos', '/mm³', 1)}
        </div>
        <div className="flex flex-wrap gap-4">
          <Opcoes label="Leucemia" valor={tipo} opcoes={[['LLA', 'LLA'], ['LMA', 'LMA']]} onChange={setTipo} />
          <Opcoes label="Sintomas de leucostase?" valor={sintomas} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setSintomas} />
          <Opcoes label="Queda prevista a ≤ 500 em 24–48 h?" valor={queda} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setQueda} />
        </div>
        {cito !== null && <p>{cito ? <strong>Acima do limiar de tratamento da hiperviscosidade do livro (LMA &gt; 100.000; LLA &gt; 200.000 ou &gt; 100.000 com sintomas).</strong> : 'Abaixo do limiar de tratamento da hiperviscosidade do livro.'}</p>}
        {neut && <p>{neut === 'profunda' ? <strong>Neutropenia profunda (&lt; 100/mm³).</strong> : neut === 'neutropenia' ? <strong>Neutropenia pela definição do livro.</strong> : 'Fora da definição de neutropenia do livro.'}</p>}
      </Bloco>

      <Bloco titulo="Neutropenia febril — risco (p. 709–711)">
        <p className="font-medium">Alto risco se qualquer um</p>
        <Marcadores itens={ALTO_RISCO_NF} marcados={risco} onChange={setRisco} />
        <p>{risco.size > 0 ? <strong>Neutropenia febril de alto risco (NFAR) pelo livro.</strong> : 'Sem critério de alto risco marcado: baixo risco (NFBR) pelo livro.'}</p>
        <Nota>{NOTA_MASCC_PED}</Nota>
      </Bloco>

      {calc && (
        <Bloco titulo="Neutropenia febril — antimicrobianos do ICr (Tabela 11, p. 714–715)">
          {DOSES_NEUTROPENIA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          {caspo && <LinhaFaixa nome="Caspofungina" faixa={[caspo.ataque, caspo.ataque]} unidade="mg (ataque)" casas={1} texto="ataque 70 mg/m² IV 1 dose; manutenção 50 mg/m² a cada 24 h; máximo 70 mg/dia" pagina="p. 715" extra={<span className="text-tinta-sussurro"> · manutenção {br(caspo.manutencao, 1)} mg/dia</span>} />}
          {osel && <LinhaFaixa nome="Oseltamivir" faixa={[osel[0], osel[osel.length - 1]]} unidade="mg 12/12 h" casas={0} texto="< 15 kg 30 mg; 15–23 kg 45 mg; 23–40 kg 60 mg; > 40 kg 75 mg VO de 12/12 h (3 mg/kg/dose também listado)" pagina="p. 715" nota={osel.length > 1 ? 'Com 23 kg exatos o peso cai em duas faixas da tabela.' : undefined} />}
        </Bloco>
      )}

      {calc && (
        <Bloco titulo="Síndromes compressivas (p. 717–720; Tabela 12)">
          {DOSES_COMPRESSIVAS.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
        </Bloco>
      )}

      <Bloco titulo="Do capítulo">
        <ListaLivro itens={REFERENCIAS_ONCO} />
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={[
          `Errata do livro: ${ERRATA_HIDRATACAO}`,
          `Errata do livro: ${ERRATA_PIC_ONCO}`,
          ...[...DOSES_SLT, ...DOSES_HEMATO_ONCO, ...DOSES_NEUTROPENIA, ...DOSES_COMPRESSIVAS].filter((d) => d.errata).map((d) => `${d.nome} — errata do livro (${d.pagina}): ${d.errata}`),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaOncologiaPed}
        guia={guia}
        comparacao={
          <BlocoComparacao titulo="Neutropenia febril — IPFNG 2023 (J Clin Oncol 2023;41:1774–1785)" resumo="Diretriz internacional pediátrica lida no texto, ao lado do cap. 66. Forte/condicional conforme GRADE.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[560px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Rec.</TableHead><TableHead className="pr-3 pb-2">IPFNG 2023</TableHead><TableHead className="pb-2">Força</TableHead></TableRow></TableHeader>
                <TableBody>
                  {IPFNG_ITENS.map((i) => (
                    <TableRow key={i.codigo} className="border-t"><TableCell className="pr-3 py-2 font-medium whitespace-nowrap">{i.codigo}</TableCell><TableCell className="pr-3 py-2">{i.texto}</TableCell><TableCell className="py-2 text-tinta-sussurro">{i.forca}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-tinta-sussurro">{DIFERENCAS_NF_2023.map((d) => <li key={d}>{d}</li>)}</ul>
            <p role="note" className="mt-2 rounded-controle border border-atencao/40 bg-alerta-atencao px-2 py-1 text-rotulo text-atencao">{NOTA_NF_SUSPENSAO_PRECOCE}</p>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(p.peso)} kg${sc > 0 ? ` · ${numeroBr(sc)} m²` : ''}` : sc > 0 && !p.rn ? `Criança · ${numeroBr(sc)} m²` : p.rn ? 'Recém-nascido: sem valor neonatal no capítulo' : idadePediatrica(p.anos, p.meses) ? 'Informe peso e superfície corpórea' : 'A partir de 14 anos é adulto: ferramenta pediátrica'}
        detalhe={`${slt === 'sem critério' ? 'Sem SLT laboratorial' : slt} · ${risco.size > 0 ? 'NF de alto risco' : 'NF sem critério de alto risco'}`}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
