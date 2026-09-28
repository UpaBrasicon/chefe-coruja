import { useState } from 'react'

import {
  DOSES_IRA, DOSES_TABELA8, INDICACOES_TSR, K_ENZIMATICO, K_JAFFE, NOTA_KDIGO, NOTA_SOBRECARGA, REFERENCIAS_IRA, TABELA7, bicarbonatoIra, creatininaBasalEstimada, fena,
  fichaInjuriaRenalPed, hidratacaoContrasteMlH, kdigo, kdigoCreatinina, kdigoDiurese, leituraFena, relacaoUreiaCreatinina, schwartz, sobrecargaHidrica, sodioIra,
} from '@/clinico/pediatria/injuriaRenalPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { LinhaFaixa, ListaLivro, ListaQuadro } from './PecasP5'

type Metodo = 'enzimatico' | 'rnbp' | 'rnt' | 'crianca' | 'menino'

/** Injúria renal aguda — cap. 56 do livro do ICr. */
export function InjuriaRenalPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [cr, setCr] = useState({ basal: 0, atual: 0, diurese: 0, horas: 0, estatura: 0 })
  const [subiu, setSubiu] = useState(false)
  const [tsr, setTsr] = useState(false)
  const [metodo, setMetodo] = useState<Metodo>('enzimatico')
  const [urina, setUrina] = useState({ naU: 0, crU: 0, naS: 0, ureia: 0 })
  const [bh, setBh] = useState({ ganhos: 0, perdas: 0, pesoAdm: 0 })
  const [eletro, setEletro] = useState({ na: 0, hco3: 0 })
  const k = metodo === 'enzimatico' ? K_ENZIMATICO : K_JAFFE.find((x) => x.id === metodo)!.k
  const tfg = schwartz(cr.estatura, cr.atual, k)
  const basalEst = creatininaBasalEstimada(cr.estatura, k)
  const basal = cr.basal > 0 ? cr.basal : basalEst ?? 0
  const estCr = kdigoCreatinina({ basal, atual: cr.atual, subiu03em48h: subiu, tfg: tfg ?? undefined, tsr })
  const estDiu = kdigoDiurese(cr.diurese, cr.horas)
  const estagio = kdigo(estCr, estDiu)
  const fe = fena({ naU: urina.naU, crS: cr.atual, naS: urina.naS, crU: urina.crU })
  const uc = relacaoUreiaCreatinina(urina.ureia, cr.atual)
  const so = sobrecargaHidrica(bh.ganhos, bh.perdas, bh.pesoAdm)
  const calc = podeCalcular(p)
  const na = calc ? sodioIra(p.peso, eletro.na) : null
  const bic = calc ? bicarbonatoIra(p.peso, eletro.hco3) : null
  const n = (obj: Record<string, number>, set: (o: never) => void, key: string, label: string, unit: string, step = 1, idp = 'ira') => (
    <NumberField id={`${idp}-${key}`} label={label} unit={unit} value={obj[key]} onChange={(x) => set({ ...obj, [key]: x } as never)} min={0} step={step} />
  )

  return (
    <ToolLayout
      title="Injúria renal aguda — criança"
      description="KDIGO pediátrico (creatinina e diurese), Schwartz, FeNa, ureia/creatinina, sobrecarga hídrica, furosemida, profilaxia do contraste e doses da Tabela 8 — livro do ICr-HCFMUSP. A decisão é do médico."
      ficha={fichaInjuriaRenalPed}
    >
      <CampoPaciente id="ira" p={p} onChange={setP} />

      <Bloco titulo="Função renal — Schwartz (Tabela 2, p. 576)">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {n(cr, setCr, 'estatura', 'Estatura', 'cm')}
          {n(cr, setCr, 'atual', 'Creatinina atual', 'mg/dL', 0.01)}
          {n(cr, setCr, 'basal', 'Creatinina basal (se conhecida)', 'mg/dL', 0.01)}
        </div>
        <Opcoes<Metodo>
          label="Método da creatinina / constante"
          valor={metodo}
          opcoes={[['enzimatico', 'Enzimático (0,413)'], ...K_JAFFE.map((x) => [x.id as Metodo, `Jaffé: ${x.texto} (${String(x.k).replace('.', ',')})`] as [Metodo, string])]}
          onChange={setMetodo}
        />
        {tfg !== null && <p>eTFG: <strong className="tabular-nums">{br(tfg, 1)} mL/min/1,73 m²</strong></p>}
        {cr.basal <= 0 && basalEst !== null && <p className="text-muted-foreground">Sem basal: creatinina correspondente a TFG 120 pela Schwartz = {br(basalEst, 2)} mg/dL (p. 575).</p>}
      </Bloco>

      <Bloco titulo="Estadiamento KDIGO pediátrico (Tabela 1, p. 576)" descricao="Vale de 1 mês a 18 anos (p. 575). O estágio é o pior entre creatinina e diurese.">
        <div className="grid gap-3 sm:grid-cols-2">
          {n(cr, setCr, 'diurese', 'Diurese', 'mL/kg/h', 0.1)}
          {n(cr, setCr, 'horas', 'Por quantas horas', 'h')}
        </div>
        <div className="flex flex-wrap gap-4">
          <Opcoes label="Subiu ≥ 0,3 mg/dL em < 48 h?" valor={subiu} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setSubiu} />
          <Opcoes label="Em terapia de substituição renal?" valor={tsr} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setTsr} />
        </div>
        {p.rn && <Nota>A Tabela 1 é para crianças de 1 mês a 18 anos; no RN a leitura não se aplica.</Nota>}
        {estagio !== null && !p.rn && (
          <p>
            {estagio === 0 ? 'Não preenche critério KDIGO com os dados informados.' : <strong>KDIGO estágio {estagio}</strong>}
            {' '}(creatinina: {estCr ?? '—'}; diurese: {estDiu ?? '—'})
          </p>
        )}
        <Nota>{NOTA_KDIGO}</Nota>
      </Bloco>

      <Bloco titulo="Índices urinários (p. 581–582)">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {n(urina, setUrina, 'naU', 'Na urinário', 'mEq/L')}
          {n(urina, setUrina, 'crU', 'Creatinina urinária', 'mg/dL', 0.1)}
          {n(urina, setUrina, 'naS', 'Na sérico', 'mEq/L')}
          {n(urina, setUrina, 'ureia', 'Ureia sérica', 'mg/dL')}
        </div>
        {fe !== null && <p>FeNa: <strong className="tabular-nums">{br(fe, 2)}%</strong> — {leituraFena(fe, p.rn)}</p>}
        {uc !== null && <p>Ureia/creatinina: <strong className="tabular-nums">{br(uc, 1)}</strong>{uc > 40 ? ' — acima de 40, um dos indicativos de hipovolemia (p. 581).' : '.'}</p>}
        <TabelaLivro cabecalho={['Tabela 7 (p. 582)', 'Alteração funcional', 'NTA', 'Glomerulopatia']} linhas={TABELA7} largura={620} />
      </Bloco>

      <Bloco titulo="Sobrecarga hídrica (p. 585)">
        <div className="grid gap-3 sm:grid-cols-3">
          {n(bh, setBh, 'ganhos', 'Ganhos', 'L', 0.01)}
          {n(bh, setBh, 'perdas', 'Perdas', 'L', 0.01)}
          {n(bh, setBh, 'pesoAdm', 'Peso na admissão', 'kg', 0.1)}
        </div>
        {so !== null && <p>Sobrecarga volêmica: <strong className="tabular-nums">{br(so, 1)}%</strong></p>}
        <Nota>{NOTA_SOBRECARGA}</Nota>
      </Bloco>

      {!calc ? (
        <Pendencia p={p} />
      ) : (
        <>
          <Bloco titulo="Furosemida e contraste (p. 584–585)">
            {DOSES_IRA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
            <LinhaFaixa nome="Hidratação profilática do contraste" faixa={hidratacaoContrasteMlH(p.peso)} unidade="mL/h" casas={0} texto="SF ou solução com bicarbonato com 150 mEq/L de Na, 1 a 3 mL/kg/h, idealmente 12 h antes até 12 h depois" pagina="p. 584" />
          </Bloco>
          <Bloco titulo="Tabela 8 — distúrbios hidroeletrolíticos e acidobásicos (p. 583)">
            <div className="grid gap-3 sm:grid-cols-2">
              {n(eletro, setEletro, 'na', 'Na sérico', 'mEq/L', 1, 'ira-e')}
              {n(eletro, setEletro, 'hco3', 'HCO3 sérico', 'mEq/L', 0.1, 'ira-e')}
            </div>
            {na && <p>Na a repor (desejado 130, × peso × 0,6): <strong className="tabular-nums">{br(na.meq, 1)} mEq</strong> = {br(na.mlNaCl3, 0)} mL de NaCl 3% (0,5 mEq/mL). Indicação: aguda e sintomática ou &lt; 120 mEq/L.</p>}
            {bic !== null && <p>Déficit de HCO3 (desejado 15, × peso × 0,3): <strong className="tabular-nums">{br(bic, 1)} mEq</strong>. Indicação: pH &lt; 7,1 e/ou HCO3 &lt; 10 mEq/L.</p>}
            {DOSES_TABELA8.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          </Bloco>
        </>
      )}

      <Bloco titulo="Indicações de TSR de emergência (Tabela 9)">
        <ListaQuadro itens={INDICACOES_TSR} pagina="p. 586" />
      </Bloco>
      <Bloco titulo="Do capítulo">
        <ListaLivro itens={REFERENCIAS_IRA} />
      </Bloco>
    </ToolLayout>
  )
}
