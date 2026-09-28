import { useState } from 'react'

import {
  ALVOS_SAT, CATETER, DISPOSITIVOS, ENTRADA_O2, ERRATA_OXIGENACAO, INDICACOES_IOT, RNC_PACO2, VNI, cortesVni, fichaOxigenacaoAdulto, incrementoCateter,
  instalacaoHipercapnia, lerGradienteAa, lerIrpa, lerPF, lerSat, relacaoPF,
} from '@/clinico/adulto/oxigenacao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Alertas, Bloco, Escolha, Resultado } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'

/** Oxigenação e IRpA no adulto — caps. 1, 27 e 37 do manual do HCFMUSP. */
export function OxigenacaoIrpaAdulto() {
  const [pao2, setPao2] = useState(0)
  const [paco2, setPaco2] = useState(0)
  const [ph, setPh] = useState(0)
  const [fio2, setFio2] = useState(21)
  const [spo2, setSpo2] = useState(0)
  const [idade, setIdade] = useState(0)
  const [risco, setRisco] = useState<'nao' | 'sim'>('nao')
  const [lmin, setLmin] = useState(0)
  const [fr, setFr] = useState(0)
  const [apache, setApache] = useState(0)

  const arAmbiente = fio2 === 21
  const aa = arAmbiente ? lerGradienteAa(pao2, paco2, informado(idade)) : null
  const pf = relacaoPF(pao2, fio2)
  const irpa = lerIrpa({ pao2: informado(pao2), paco2: informado(paco2), spo2: informado(spo2) })
  const instal = instalacaoHipercapnia(paco2, ph)
  const sat = lerSat(spo2, risco === 'sim')
  const cat = incrementoCateter(lmin)
  const vni = cortesVni({ fr: informado(fr), paco2: informado(paco2), pf: pf ?? undefined, ph: informado(ph), idade: informado(idade), apache: informado(apache) })
  const temGaso = pao2 > 0 || paco2 > 0 || spo2 > 0

  return (
    <ToolLayout
      title="Oxigenação e insuficiência respiratória — adulto"
      description="Gradiente A-a e esperado pela idade, P/F, tipo de IRpA, hipercapnia aguda ou crônica, FiO2 dos dispositivos, alvos de SatO2 e cortes de VNI e IOT, como os caps. 1, 27 e 37 do manual do HCFMUSP trazem. Adulto (14 anos ou mais)."
      ficha={fichaOxigenacaoAdulto}
    >
      <Bloco titulo="Gasometria e oximetria">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ox-pao2" label="PaO2" unit="mmHg" value={pao2} onChange={setPao2} step={1} />
          <NumberField id="ox-paco2" label="PaCO2" unit="mmHg" value={paco2} onChange={setPaco2} step={1} />
          <NumberField id="ox-ph" label="pH" value={ph} onChange={setPh} step={0.01} />
          <NumberField id="ox-fio2" label="FiO2 na coleta" unit="%" value={fio2} onChange={setFio2} step={1} />
          <NumberField id="ox-spo2" label="SpO2" unit="%" value={spo2} onChange={setSpo2} step={1} />
          <NumberField id="ox-idade" label="Idade" unit="anos" value={idade} onChange={setIdade} step={1} />
        </div>
      </Bloco>

      {temGaso && (
        <Bloco titulo="Leitura (cap. 27)">
          <p>{irpa.criterios.length ? <>Critérios de IRpA em ar ambiente (p. 370): <strong>{irpa.criterios.join('; ')}</strong></> : 'Nenhum critério de IRpA da p. 370 nos valores informados.'}</p>
          {irpa.tipo && <p><strong>{irpa.tipo}</strong> (p. 373–374)</p>}
          {irpa.notas.map((n) => <p key={n} className="text-muted-foreground">{n}</p>)}
          {instal.length > 0 && <p>Tempo de instalação (Tabela 5, p. 377–378): <strong>{instal.join(' · ')}</strong>{instal.length > 1 && ' — as duas linhas da tabela se sobrepõem entre 7,33 e 7,35.'}</p>}
          {paco2 > 0 && <p className="text-muted-foreground">RNC por PaCO2 (p. 377): indivíduos normais não desenvolvem abaixo de {faixaBr(RNC_PACO2.normais, 0)} mmHg; hipercápnicos crônicos, usualmente até {faixaBr(RNC_PACO2.cronicos, 0)} mmHg.</p>}
        </Bloco>
      )}

      <Bloco titulo="Gradiente A-a e P/F (Tabela 1, p. 371)" descricao="Gradiente = 130 − (PaO2 + PaCO2), em ar ambiente na pressão atmosférica de São Paulo. Esperado pela idade: 4 + idade/4 ou 2,5 + 0,21 × idade; alguns estudos adotam < 15.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Gradiente A-a" valor={aa ? `${br(aa.gradiente, 0)} mmHg` : arAmbiente ? 'informe PaO2 e PaCO2' : 'só em ar ambiente (FiO2 21%)'} />
          <Resultado rotulo="Esperado pela idade" valor={aa?.esperado ? `${br(aa.esperado.formula1, 1)} ou ${br(aa.esperado.formula2, 1)} mmHg` : '—'} />
          <Resultado rotulo="P/F" valor={pf !== null ? `${br(pf, 0)} mmHg` : '—'} />
        </div>
        {aa && <ul className="list-disc pl-5">{aa.notas.map((n) => <li key={n}>{n}</li>)}</ul>}
        {pf !== null && <p>{lerPF(pf)}</p>}
        {!arAmbiente && <p className="text-muted-foreground">O livro não traz fórmula do gradiente com O2 suplementar.</p>}
      </Bloco>

      <Bloco titulo="Alvo de SatO2">
        <Escolha label="DPOC conhecida ou risco de insuficiência hipercápnica?" value={risco} onChange={setRisco} opcoes={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]} />
        {sat.length > 0 && <ul className="list-disc pl-5">{sat.map((s) => <li key={s}>{s}</li>)}</ul>}
        <ul className="flex flex-col gap-1 text-muted-foreground">{ALVOS_SAT.map((a) => <li key={a.contexto}>{a.contexto}: {a.alvo} ({a.pagina})</li>)}</ul>
      </Bloco>

      <Bloco titulo="Dispositivos de O2 (cap. 1, Tabela 1; cap. 27, Tabela 7)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ox-lmin" label="Cateter nasal — fluxo" unit="L/min" value={lmin} onChange={setLmin} step={0.5} />
          <Resultado rotulo="Incremento de FiO2 — cap. 1 (1–4%/L)" valor={cat ? `+${faixaBr(cat.cap1, 0)} pontos` : '—'} />
          <Resultado rotulo="Incremento de FiO2 — cap. 27 (3–4%/L)" valor={cat ? `+${faixaBr(cat.cap27, 0)} pontos` : '—'} />
        </div>
        <p className="text-muted-foreground">O livro não imprime a FiO2 de partida; exemplos impressos: {CATETER.cap27.exemplo.lmin} L/min → {faixaBr(CATETER.cap27.exemplo.fio2, 0)}% (cap. 27) e {CATETER.cap1.exemplo.lmin} L/min → {faixaBr(CATETER.cap1.exemplo.fio2, 0)}% (cap. 1).</p>
        {cat && <Alertas itens={cat.avisos} />}
        <div className="flex flex-col gap-2">
          {DISPOSITIVOS.map((d) => (
            <div key={d.id} className="rounded-lg border px-3 py-2">
              <p className="font-medium">{d.nome}</p>
              {d.cap1 && <p className="text-muted-foreground">Cap. 1: {d.cap1}</p>}
              {d.cap27 && <p className="text-muted-foreground">Cap. 27: {d.cap27}</p>}
              {d.indicacoes27 && <p className="text-muted-foreground">Indicações (Tabela 7): {d.indicacoes27}</p>}
            </div>
          ))}
        </div>
        <p className="font-medium">O que o livro associa a cada situação de entrada</p>
        <ul className="list-disc pl-5">{ENTRADA_O2.map((e) => <li key={e.situacao}>{e.situacao}: {e.livro} <span className="text-muted-foreground">({e.pagina})</span></li>)}</ul>
      </Bloco>

      <Bloco titulo="VNI (p. 378, 382–386)" descricao="p. 378: não há critérios gasométricos específicos para indicar VNI. A tela lista os cortes do livro atingidos; não decide.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ox-fr" label="FR" unit="ipm" value={fr} onChange={setFr} step={1} />
          <NumberField id="ox-apache" label="APACHE II (extubação)" value={apache} onChange={setApache} step={1} />
        </div>
        {vni.length > 0 ? <Alertas itens={vni} /> : <p>Nenhum corte numérico de VNI atingido nos valores informados.</p>}
        <p className="font-medium">Indicações</p>
        <ul className="list-disc pl-5">{[...VNI.clinicas, ...VNI.gasometricas].map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="font-medium">Maior evidência de benefício</p>
        <ul className="list-disc pl-5">{VNI.maiorEvidencia.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="font-medium">Contraindicações</p>
        <ul className="list-disc pl-5">{VNI.contraindicacoes.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="font-medium">Modos</p>
        <ul className="list-disc pl-5">{VNI.modos.map((i) => <li key={i}>{i}</li>)}</ul>
      </Bloco>

      <Bloco titulo="Intubação e VM invasiva">
        <ul className="list-disc pl-5">{INDICACOES_IOT.map((i) => <li key={i.texto}>{i.texto} <span className="text-muted-foreground">({i.pagina})</span></li>)}</ul>
        {pao2 > 0 && pao2 < 60 && <p>PaO2 &lt; 60 mmHg: corte numérico da p. 498 (junto com esforço respiratório sem melhora após O2 adequado).</p>}
        {paco2 > 55 && <p>PaCO2 &gt; 55 mmHg: corte numérico da p. 498 (em não retentor crônico).</p>}
      </Bloco>

      <Bloco titulo="Errata e divergências do livro">
        <ul className="list-disc pl-5 text-muted-foreground">{ERRATA_OXIGENACAO.map((e) => <li key={e}>{e}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
