import { useState } from 'react'

import {
  AUTO_PEEP, DESMAME, DESMAME_OUTROS, DESMAME_SUBJETIVOS, DOPE, ERRATA_VM, FALHA_TRE_CLINICA, INDICACOES_VM, NOME_BERLIM, NOME_MODO, POS_INTUBACAO, TABELA2,
  TABELAS_PEEP, berlim, cortesIndicacaoVm, criteriosObjetivosDesmame, falhaTre, marcosPf, mecanica, relacaoPF,
  type ClasseBerlim, type Modo, type TabelaPeepId,
} from '@/clinico/adulto/ventilacaoMecanica'
import { ALARMES_LIVRO, ALVO_SAT, PASSOS_VM, QUADROS_VM, checarAjustes, fichaVmPassos, lerAcompanhamento, tabelaPeepSdra, type QuadroVm } from '@/clinico/adulto/vmPassos'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Alertas, Escolha, Resultado } from '../manual/LoteAPecas'
import { br, faixaBr, informado } from '../manual/loteAFormato'
import { BarraPassos, CartaoPasso, NavPassos, TabelaConferencia } from './Passos'

type Checagem = { hora: string; cst: number | null; driving: number | null; pplato: number; peep: number }

/** VM em cinco passos no formato do protótipo, com as faixas do cap. 37 do manual do HCFMUSP. */
export function VmCincoPassos() {
  const [passo, setPasso] = useState(1)
  // passo 1
  const [peso, setPeso] = useState(0)
  const [quadro, setQuadro] = useState<QuadroVm>('inicial')
  const [po2, setPo2] = useState(0)
  const [pco2, setPco2] = useState(0)
  const [pao2Sdra, setPao2Sdra] = useState(0)
  const [fio2Sdra, setFio2Sdra] = useState(0)
  const [classeManual, setClasseManual] = useState<ClasseBerlim | ''>('')
  // passo 2
  const [modo, setModo] = useState<Modo>('vcv')
  // passo 3
  const [vc, setVc] = useState(0)
  const [fluxo, setFluxo] = useState(0)
  const [tins, setTins] = useState(0)
  const [fr, setFr] = useState(0)
  const [peep, setPeep] = useState(0)
  const [fio2, setFio2] = useState(0)
  const [autoPeep, setAutoPeep] = useState(0)
  const [tabPeep, setTabPeep] = useState<TabelaPeepId | ''>('')
  // passo 4
  const [ppico, setPpico] = useState(0)
  const [pplato, setPplato] = useState(0)
  const [peepMedida, setPeepMedida] = useState(0)
  const [vcMedido, setVcMedido] = useState(0)
  const [fluxoMedido, setFluxoMedido] = useState(0)
  const [autoMedida, setAutoMedida] = useState(0)
  const [ph, setPh] = useState(0)
  const [paco2, setPaco2] = useState(0)
  const [sat, setSat] = useState(0)
  const [historico, setHistorico] = useState<Checagem[]>([])
  // passo 5
  const [po2D, setPo2D] = useState(0)
  const [fio2D, setFio2D] = useState(0)
  const [peepD, setPeepD] = useState(0)
  const [fcD, setFcD] = useState(0)
  const [fcT, setFcT] = useState(0)
  const [frT, setFrT] = useState(0)
  const [satT, setSatT] = useState(0)
  const [pasT, setPasT] = useState(0)

  const pf = pao2Sdra > 0 && fio2Sdra > 0 ? relacaoPF(pao2Sdra, fio2Sdra) : null
  const leituraBerlim = pf !== null ? berlim(pf, 5) : null
  const classe: ClasseBerlim | undefined = classeManual || leituraBerlim?.classe || undefined
  const modos = QUADROS_VM[quadro].modos
  const modoValido = modos.includes(modo) ? modo : modos[0]
  const tabelaPeep: TabelaPeepId = tabPeep || (classe ? tabelaPeepSdra(classe) : 'baixo')

  const checagem = checarAjustes({
    quadro, modo: modoValido, pesoKg: informado(peso), classe, tabelaPeep,
    a: { vcMl: informado(vc), fluxoLMin: informado(fluxo), tinsS: informado(tins), fr: informado(fr), peep: informado(peep), fio2Pct: informado(fio2), autoPeep: informado(autoPeep) },
  })

  const mec = vcMedido > 0 && pplato > 0 && ppico > 0 ? mecanica({ vcMl: vcMedido, fluxoLMin: fluxoMedido || fluxo, ppico, pplato, peep: peepMedida || peep }) : null
  const acompanhamento = lerAcompanhamento(quadro, { ppico: informado(ppico), pplato: informado(pplato), peep: peepMedida || peep || undefined, autoPeep: informado(autoMedida), ph: informado(ph), paco2: informado(paco2), sat: informado(sat) })
  const marcos = pf !== null && quadro === 'sdra' ? marcosPf(pf) : []

  const registrarChecagem = () => {
    if (!(pplato > 0)) return
    const p = peepMedida || peep
    setHistorico((h) => [{ hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), cst: mec?.complacencia ?? null, driving: mec?.driving ?? (pplato >= p ? pplato - p : null), pplato, peep: p }, ...h].slice(0, 8))
  }

  const ir = (n: number) => setPasso(Math.min(5, Math.max(1, n)))
  const criterios = criteriosObjetivosDesmame({ po2: informado(po2D), fio2Pct: informado(fio2D), peep: peepD > 0 ? peepD : undefined, fc: informado(fcD) })
  const falha = falhaTre({ fc: informado(fcT), fr: informado(frT), sat: informado(satT), pas: informado(pasT) })

  return (
    <ToolLayout
      title="Ventilação mecânica em cinco passos (adulto)"
      description="Quem, modo, ajustes, acompanhamento e desmame, com as tabelas do cap. 37 do manual do HCFMUSP. A tela confere os números contra o livro; não escolhe o ajuste. Adulto (14 anos ou mais)."
      ficha={fichaVmPassos}
    >
      <BarraPassos passos={PASSOS_VM} atual={passo} ir={ir} nota={`${QUADROS_VM[quadro].nome} · ${NOME_MODO[modoValido]}${peso > 0 ? ` · ${br(peso, 1)} kg` : ''} — ${QUADROS_VM[quadro].tabela}`} />

      {passo === 1 && (
        <CartaoPasso n={1} titulo="Quem é o paciente e por que vai ser ventilado">
          <ul className="list-disc pl-5">{INDICACOES_VM.map((i) => <li key={i.texto}>{i.texto} <span className="text-tinta-sussurro">({i.pagina})</span></li>)}</ul>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField id="vm5-po2" label="PO2" unit="mmHg" value={po2} onChange={setPo2} />
            <NumberField id="vm5-pco2" label="PCO2" unit="mmHg" value={pco2} onChange={setPco2} />
            <NumberField id="vm5-peso" label="Peso usado na conta" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          </div>
          {(po2 > 0 || pco2 > 0) && <p>{cortesIndicacaoVm({ po2: informado(po2), pco2: informado(pco2) }).join('; ') || 'Nenhum corte numérico da p. 498 atingido.'}</p>}
          <p className="text-tinta-sussurro">O livro escreve "mL/kg" sem dizer se é peso real, ideal ou predito e não traz fórmula de peso predito: informe o peso que você quer usar (errata do cap. 37).</p>
          <Escolha label="Quadro (define a tabela do livro)" value={quadro} onChange={setQuadro} opcoes={(Object.keys(QUADROS_VM) as QuadroVm[]).map((q) => ({ value: q, label: QUADROS_VM[q].nome }))} />
          {quadro === 'sdra' && (
            <div className="flex flex-col gap-3 rounded-controle border border-fio p-3">
              <p className="font-medium">Classe de Berlim pela P/F com PEEP ≥ 5 (p. 505)</p>
              <div className="grid gap-4 sm:grid-cols-3">
                <NumberField id="vm5-pao2" label="PaO2" unit="mmHg" value={pao2Sdra} onChange={setPao2Sdra} />
                <NumberField id="vm5-fio2s" label="FiO2" unit="%" value={fio2Sdra} onChange={setFio2Sdra} max={100} />
                <Resultado rotulo="P/F · classe" valor={pf !== null ? `${Math.round(pf)} · ${leituraBerlim?.classe ? NOME_BERLIM[leituraBerlim.classe] : leituraBerlim?.nota ?? '—'}` : '—'} />
              </div>
              <Escolha label="Ou escolha a classe" value={classeManual} onChange={setClasseManual} opcoes={[{ value: '', label: 'Pela P/F' }, ...(['leve', 'moderada', 'grave'] as ClasseBerlim[]).map((c) => ({ value: c, label: NOME_BERLIM[c] }))]} />
            </div>
          )}
          <NavPassos atual={1} total={5} ir={ir} proximo="Escolher o modo" />
        </CartaoPasso>
      )}

      {passo === 2 && (
        <CartaoPasso n={2} titulo="Modo ventilatório">
          <Escolha label="Modo" value={modoValido} onChange={setModo} opcoes={modos.map((m) => ({ value: m, label: NOME_MODO[m] }))} />
          {quadro !== 'inicial' && <p className="text-tinta-sussurro">As Tabelas 4 e 5 não trazem ajuste em PSV: para esses quadros a tela confere VCV e PCV.</p>}
          <dl className="grid gap-2 sm:grid-cols-2">
            {TABELA2.map((l) => (
              <div key={l.parametro} className="rounded-controle border border-fio px-3 py-2">
                <dt className="text-tinta-sussurro">{l.parametro}</dt>
                <dd>{l.modos[modoValido]}</dd>
              </div>
            ))}
          </dl>
          <p className="text-rotulo text-tinta-sussurro">Tabela 2, p. 501–502 (ajuste inicial por modo).</p>
          <NavPassos atual={2} total={5} ir={ir} proximo="Montar os ajustes" />
        </CartaoPasso>
      )}

      {passo === 3 && (
        <CartaoPasso n={3} titulo="Ajustes e conferência contra o livro">
          <div className="grid gap-4 sm:grid-cols-3">
            {modoValido === 'vcv' && <NumberField id="vm5-vc" label="Volume corrente" unit="mL" value={vc} onChange={setVc} step={10} />}
            {modoValido === 'vcv' && <NumberField id="vm5-fluxo" label="Fluxo (onda quadrada)" unit="L/min" value={fluxo} onChange={setFluxo} step={5} />}
            {modoValido === 'pcv' && <NumberField id="vm5-tins" label="Tempo inspiratório" unit="s" value={tins} onChange={setTins} step={0.1} />}
            <NumberField id="vm5-fr" label={modoValido === 'psv' ? 'FR de apneia' : 'FR'} unit="rpm" value={fr} onChange={setFr} />
            <NumberField id="vm5-peep" label="PEEP" unit="cmH2O" value={peep} onChange={setPeep} />
            <NumberField id="vm5-fio2" label="FiO2" unit="%" value={fio2} onChange={setFio2} max={100} />
            {quadro === 'obstruido' && <NumberField id="vm5-auto" label="Auto-PEEP medida" unit="cmH2O" value={autoPeep} onChange={setAutoPeep} step={0.5} />}
          </div>
          {quadro === 'sdra' && (
            <Escolha label="Tabela PEEP × FiO2" value={tabelaPeep} onChange={(v) => setTabPeep(v)} opcoes={(Object.keys(TABELAS_PEEP) as TabelaPeepId[]).map((t) => ({ value: t, label: `${TABELAS_PEEP[t].nome} (${TABELAS_PEEP[t].pagina})` }))} />
          )}
          {checagem.vtAlvoMl && <p>Vt do quadro pelo peso informado: <strong className="tabular-nums">{faixaBr(checagem.vtAlvoMl, 0)} mL</strong></p>}
          <TabelaConferencia linhas={checagem.linhas} />
          <div className="rounded-controle border border-fio px-3 py-2">
            <p className="font-medium">Alarmes, como a tabela do quadro traz</p>
            <ul className="list-disc pl-5">{ALARMES_LIVRO[quadro].map((a) => <li key={a.texto}>{a.texto} <span className="text-tinta-sussurro">({a.pagina})</span></li>)}</ul>
            <p className="text-tinta-sussurro">Alvo de oxigenação: {ALVO_SAT[quadro].texto} ({ALVO_SAT[quadro].pagina}). Valores de alarme de volume, apneia e FiO2 não estão no livro e não são sugeridos.</p>
          </div>
          {quadro === 'obstruido' && <p className="text-tinta-sussurro">Auto-PEEP ({AUTO_PEEP.pagina}): {AUTO_PEEP.identificar.join('; ')}.</p>}
          <NavPassos atual={3} total={5} ir={ir} proximo="Acompanhar" />
        </CartaoPasso>
      )}

      {passo === 4 && (
        <CartaoPasso n={4} titulo="Acompanhar: mecânica, gasometria e oxigenação">
          <ul className="list-disc pl-5">{POS_INTUBACAO.map((i) => <li key={i}>{i}</li>)}</ul>
          <p className="text-rotulo text-tinta-sussurro">Figura 4, p. 509. Mecânica em VCV, fluxo quadrado, sem esforço, pausa inspiratória de 2–3 s (p. 499–500).</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField id="vm5-ppico" label="Ppico" unit="cmH2O" value={ppico} onChange={setPpico} />
            <NumberField id="vm5-pplato" label="Pplatô" unit="cmH2O" value={pplato} onChange={setPplato} />
            <NumberField id="vm5-peepm" label="PEEP" unit="cmH2O" value={peepMedida} onChange={setPeepMedida} />
            <NumberField id="vm5-vcm" label="Volume corrente" unit="mL" value={vcMedido} onChange={setVcMedido} step={10} />
            <NumberField id="vm5-fluxom" label="Fluxo" unit="L/min" value={fluxoMedido} onChange={setFluxoMedido} step={5} />
            <NumberField id="vm5-autom" label="Auto-PEEP" unit="cmH2O" value={autoMedida} onChange={setAutoMedida} step={0.5} />
            <NumberField id="vm5-ph" label="pH" value={ph} onChange={setPh} step={0.01} />
            <NumberField id="vm5-paco2" label="PaCO2" unit="mmHg" value={paco2} onChange={setPaco2} />
            <NumberField id="vm5-sat" label="SatO2" unit="%" value={sat} onChange={setSat} max={100} />
          </div>
          {mec && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Resultado rotulo="Resistência" valor={mec.resistencia !== null ? `${br(mec.resistencia, 1)} cmH2O/L/s` : '—'} />
              <Resultado rotulo="Complacência estática" valor={mec.complacencia !== null ? `${br(mec.complacencia, 1)} mL/cmH2O` : '—'} />
              <Resultado rotulo="Driving pressure" valor={mec.driving !== null ? `${br(mec.driving, 0)} cmH2O` : '—'} />
              <Resultado rotulo="Constante de tempo (3–5 τ)" valor={mec.tau ? `${br(mec.tau.tauS, 2)} s (${br(mec.tau.esvaziamentoS[0], 1)}–${br(mec.tau.esvaziamentoS[1], 1)} s)` : '—'} />
            </div>
          )}
          {mec && <ul className="list-disc pl-5 text-tinta-apoio">{mec.notas.map((n) => <li key={n}>{n}</li>)}</ul>}
          <Alertas itens={[...acompanhamento, ...marcos]} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={registrarChecagem} disabled={!(pplato > 0)} className="rounded-controle border border-acao px-3 py-2 font-medium text-acao disabled:opacity-45">Guardar esta checagem na tela</button>
            <span className="text-tinta-sussurro">Fica só nesta tela, para comparar ao longo do plantão; não vai ao prontuário.</span>
          </div>
          {historico.length > 0 && (
            <table className="w-full max-w-lg text-left text-sm tabular-nums">
              <thead className="text-tinta-sussurro"><tr><th className="pb-1 font-medium">Hora</th><th className="pb-1 font-medium">Pplatô</th><th className="pb-1 font-medium">PEEP</th><th className="pb-1 font-medium">Driving</th><th className="pb-1 font-medium">Cst</th></tr></thead>
              <tbody>{historico.map((h, i) => <tr key={i} className="border-t border-fio"><td className="py-1">{h.hora}</td><td>{h.pplato}</td><td>{h.peep}</td><td>{br(h.driving, 0)}</td><td>{br(h.cst, 1)}</td></tr>)}</tbody>
            </table>
          )}
          <div className="rounded-controle border border-fio px-3 py-2">
            <p className="font-medium">Instabilização inesperada em VM — DOPE (p. 502)</p>
            <ul className="list-disc pl-5">{DOPE.map((d) => <li key={d}>{d}</li>)}</ul>
          </div>
          <NavPassos atual={4} total={5} ir={ir} proximo="Desmamar" />
        </CartaoPasso>
      )}

      {passo === 5 && (
        <CartaoPasso n={5} titulo="Desmame e teste de respiração espontânea">
          <p className="font-medium">Parâmetros objetivos ({DESMAME.pagina})</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <NumberField id="vm5-po2d" label="PO2" unit="mmHg" value={po2D} onChange={setPo2D} />
            <NumberField id="vm5-fio2d" label="FiO2" unit="%" value={fio2D} onChange={setFio2D} max={100} />
            <NumberField id="vm5-peepd" label="PEEP" unit="cmH2O" value={peepD} onChange={setPeepD} />
            <NumberField id="vm5-fcd" label="FC" unit="bpm" value={fcD} onChange={setFcD} />
          </div>
          <ul className="flex flex-col gap-1">
            {criterios.map((c) => <li key={c.texto} className={c.atende === null ? 'text-tinta-sussurro' : c.atende ? 'text-conforme' : 'text-critico'}>{c.atende === null ? '○' : c.atende ? '✓' : '✗'} {c.texto}</li>)}
          </ul>
          <p><span className="font-medium">Subjetivos:</span> {DESMAME_SUBJETIVOS.join('; ')}. <span className="font-medium">Outros:</span> {DESMAME_OUTROS.join('; ')}.</p>
          <p>TRE: PSV {faixaBr(DESMAME.tre.psv, 0)} cmH2O por {faixaBr(DESMAME.tre.minutos, 0)} minutos.</p>
          <p className="font-medium">Falência durante o TRE</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <NumberField id="vm5-fct" label="FC" unit="bpm" value={fcT} onChange={setFcT} />
            <NumberField id="vm5-frt" label="FR" unit="rpm" value={frT} onChange={setFrT} />
            <NumberField id="vm5-satt" label="SatO2" unit="%" value={satT} onChange={setSatT} max={100} />
            <NumberField id="vm5-past" label="PAS" unit="mmHg" value={pasT} onChange={setPasT} />
          </div>
          {falha.length > 0 ? <Alertas itens={falha.map((f) => `Critério de falência atingido: ${f}`)} /> : <p className="text-tinta-sussurro">Nenhum critério numérico de falência atingido com os valores informados.</p>}
          <p className="text-tinta-sussurro">Clínicos: {FALHA_TRE_CLINICA.join('; ')}.</p>
          <NavPassos atual={5} total={5} ir={ir} />
        </CartaoPasso>
      )}

      <details className="rounded-container border border-fio bg-card px-4 py-3 text-sm">
        <summary className="cursor-pointer font-medium">Errata e divergências do cap. 37</summary>
        <ul className="mt-2 list-disc pl-5 text-tinta-sussurro">{ERRATA_VM.map((e) => <li key={e}>{e}</li>)}</ul>
      </details>
    </ToolLayout>
  )
}
