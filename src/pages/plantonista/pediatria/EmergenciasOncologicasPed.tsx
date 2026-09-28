import { useState } from 'react'

import {
  ALTO_RISCO_NF, DIFERENCAS_NF_2023, DOSES_COMPRESSIVAS, DOSES_HEMATO_ONCO, DOSES_NEUTROPENIA, DOSES_SLT, ERRATA_HIDRATACAO, ERRATA_PIC_ONCO, INDICACOES_TSR_SLT, IPFNG_ITENS,
  LIMIARES_PLAQUETAS, MASCC_GRAVIDADE, MASCC_ITENS, REFERENCIAS_ONCO, TABELA7_HB, alopurinolM2, caspofungina, chOncoMl, classificarSlt, crioOncoU, criteriosLabSlt, diureseAlvoSlt,
  fichaOncologiaPed, hidratacaoSltMlDia, indicaCitorreducao, leituraNeutrofilos, mascc, oseltamivirMg, pfcOncoMl, plaquetasOncoMl, produtoCaP,
} from '@/clinico/pediatria/oncologiaPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaDoseLivro, Marcadores, TabelaLivro } from './PecasP4'
import { CampoSC, LinhaFaixa, ListaLivro, ListaQuadro } from './PecasP5'

const VARIACAO_25 = [
  { id: 'acidoUrico', texto: 'Ácido úrico: aumento de 25% do basal' },
  { id: 'potassio', texto: 'Potássio: aumento de 25% do basal' },
  { id: 'fosforo', texto: 'Fósforo: aumento de 25% do basal' },
  { id: 'calcio', texto: 'Cálcio: diminuição de 25% do basal' },
]

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
  const [grav, setGrav] = useState(5)
  const [mItens, setMItens] = useState<Set<string>>(new Set())
  const sc = idadePediatrica(p.anos, p.meses) ? scInformada : 0
  const calc = podeCalcular(p)
  const crit = criteriosLabSlt(lab, var25)
  const slt = classificarSlt(crit.length, clinico)
  const cap = produtoCaP(lab.calcio, lab.fosforo)
  const diurese = !p.rn ? diureseAlvoSlt(calc ? p.peso : 0, sc) : null
  const alo = !p.rn ? alopurinolM2(sc) : null
  const cito = indicaCitorreducao(leuco.leucocitos, tipo, sintomas)
  const neut = leuco.neutrofilos > 0 ? leituraNeutrofilos(leuco.neutrofilos, queda) : null
  const escore = mascc(grav, mItens)
  const caspo = !p.rn ? caspofungina(sc) : null
  const osel = calc ? oseltamivirMg(p.peso) : null
  const campo = <T extends Record<string, number>>(obj: T, set: (o: T) => void, k: keyof T & string, label: string, unit: string, step = 0.1) => (
    <NumberField id={`onc-${k}`} label={label} unit={unit} value={obj[k]} onChange={(x) => set({ ...obj, [k]: x })} min={0} step={step} />
  )

  return (
    <ToolLayout
      title="Emergências oncológicas — criança"
      description="Lise tumoral (Cairo-Bishop, hidratação por m², alopurinol, rasburicase, hipercalemia), hemocomponentes, hiperviscosidade, neutropenia febril (alto risco, MASCC, Tabela 11 do ICr) e síndromes compressivas — livro do ICr-HCFMUSP. A decisão é do médico e do oncologista."
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
            {alo && <LinhaFaixa nome="Alopurinol por m²" faixa={alo.porDose} unidade="mg/dose" casas={0} texto="50 a 100 mg/m²/dose VO de 8/8 h, máximo 300 mg/m²/dia" pagina="p. 700; Tabela 6, p. 702" extra={<span className="text-muted-foreground"> · {faixaBr(alo.dia, 0)} mg/dia (teto {br(alo.maxDia, 0)})</span>} />}
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
        <p className="font-medium">MASCC (Tabela 9)</p>
        <Opcoes<number> label="Gravidade da doença" valor={grav} opcoes={MASCC_GRAVIDADE} onChange={setGrav} />
        <Marcadores itens={MASCC_ITENS.map((i) => ({ id: i.id, texto: `${i.texto} (${i.pontos})` }))} marcados={mItens} onChange={setMItens} />
        <p>
          MASCC: <strong className="tabular-nums">{escore.pontos}</strong> — {escore.baixoRisco ? '≥ 21, baixo risco de complicação' : '< 21'}
        </p>
        <Nota>O MASCC está no capítulo como a Associação Multinacional o publicou (inclui "idade &lt; 60 anos" e DPOC).</Nota>
      </Bloco>

      {calc && (
        <Bloco titulo="Neutropenia febril — antimicrobianos do ICr (Tabela 11, p. 714–715)">
          {DOSES_NEUTROPENIA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          {caspo && <LinhaFaixa nome="Caspofungina" faixa={[caspo.ataque, caspo.ataque]} unidade="mg (ataque)" casas={1} texto="ataque 70 mg/m² IV 1 dose; manutenção 50 mg/m² a cada 24 h; máximo 70 mg/dia" pagina="p. 715" extra={<span className="text-muted-foreground"> · manutenção {br(caspo.manutencao, 1)} mg/dia</span>} />}
          {osel && <LinhaFaixa nome="Oseltamivir" faixa={[osel[0], osel[osel.length - 1]]} unidade="mg 12/12 h" casas={0} texto="< 15 kg 30 mg; 15–23 kg 45 mg; 23–40 kg 60 mg; > 40 kg 75 mg VO de 12/12 h (3 mg/kg/dose também listado)" pagina="p. 715" nota={osel.length > 1 ? 'Com 23 kg exatos o peso cai em duas faixas da tabela.' : undefined} />}
        </Bloco>
      )}

      {calc && (
        <Bloco titulo="Síndromes compressivas (p. 717–720; Tabela 12)">
          {DOSES_COMPRESSIVAS.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          <Errata texto={ERRATA_PIC_ONCO} />
        </Bloco>
      )}

      <Bloco titulo="Neutropenia febril — IPFNG 2023 (J Clin Oncol 2023;41:1774–1785)" descricao="Diretriz internacional pediátrica lida no texto, ao lado do cap. 66. Forte/condicional conforme GRADE.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left align-top text-sm">
            <thead className="text-muted-foreground"><tr><th className="pr-3 pb-2">Rec.</th><th className="pr-3 pb-2">IPFNG 2023</th><th className="pb-2">Força</th></tr></thead>
            <tbody>
              {IPFNG_ITENS.map((i) => (
                <tr key={i.codigo} className="border-t"><td className="pr-3 py-2 font-medium whitespace-nowrap">{i.codigo}</td><td className="pr-3 py-2">{i.texto}</td><td className="py-2 text-muted-foreground">{i.forca}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="list-disc pl-5 text-muted-foreground">{DIFERENCAS_NF_2023.map((d) => <li key={d}>{d}</li>)}</ul>
      </Bloco>

      <Bloco titulo="Do capítulo">
        <ListaLivro itens={REFERENCIAS_ONCO} />
      </Bloco>
    </ToolLayout>
  )
}
