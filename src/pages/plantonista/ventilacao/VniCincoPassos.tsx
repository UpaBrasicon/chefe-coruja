import { useState } from 'react'

import { INDICACOES_VM_DPOC } from '@/clinico/adulto/asmaDpoc'
import { VNI, cortesVni, relacaoPF } from '@/clinico/adulto/oxigenacao'
import {
  ALVOS_SAT_VNI, CONTRAINDICACOES_VNI, INTERFACES_VNI, MODOS_VNI, PASSOS_VNI, QUADROS_VNI, RETIRADA_VNI, fichaVniPassos, lerAcompanhamentoVni, lerAjustesVni,
  type ModoVni, type QuadroVni,
} from '@/clinico/adulto/vniPassos'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Alertas, Escolha, Resultado } from '../manual/LoteAPecas'
import { informado } from '../manual/loteAFormato'
import { BarraPassos, CartaoPasso, NavPassos } from './Passos'

function Marca({ id, rotulo, marcado, alternar, extra }: { id: string; rotulo: string; marcado: boolean; alternar: () => void; extra?: string }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2">
      <input id={id} type="checkbox" className="mt-0.5 size-4 shrink-0" checked={marcado} onChange={alternar} />
      <span>{rotulo}{extra && <span className="text-tinta-sussurro"> ({extra})</span>}</span>
    </label>
  )
}

/** VNI em cinco passos no formato do protótipo, só com o que o manual do HCFMUSP traz. */
export function VniCincoPassos() {
  const [passo, setPasso] = useState(1)
  const ir = (n: number) => setPasso(Math.min(5, Math.max(1, n)))
  // passo 1
  const [quadro, setQuadro] = useState<QuadroVni>('dpoc')
  const [fr, setFr] = useState(0)
  const [paco2, setPaco2] = useState(0)
  const [pao2, setPao2] = useState(0)
  const [fio2, setFio2] = useState(0)
  const [ph, setPh] = useState(0)
  const [contra, setContra] = useState<string[]>([])
  // passo 2
  const [iface, setIface] = useState('')
  // passo 3
  const [modo, setModo] = useState<ModoVni>('bipap')
  const [ipap, setIpap] = useState(0)
  const [epap, setEpap] = useState(0)
  const [cpap, setCpap] = useState(0)
  const [alvo, setAlvo] = useState('')
  // passo 4
  const [ph4, setPh4] = useState(0)
  const [paco24, setPaco24] = useState(0)
  const [pao24, setPao24] = useState(0)
  const [sat4, setSat4] = useState(0)
  const [naoRetentor, setNaoRetentor] = useState(false)
  const [rebaixamento, setRebaixamento] = useState(false)
  const [instabilidade, setInstabilidade] = useState(false)
  const [pausas, setPausas] = useState(false)
  const [secrecao, setSecrecao] = useState(false)

  const pf = pao2 > 0 && fio2 > 0 ? relacaoPF(pao2, fio2) : null
  const cortes = cortesVni({ fr: informado(fr), paco2: informado(paco2), pf: pf ?? undefined, ph: informado(ph) })
  const ajustes = lerAjustesVni(quadro, { modo, ipap: informado(ipap), epap: informado(epap), cpap: informado(cpap) })
  const alvoEscolhido = alvo || (quadro === 'dpoc' ? 'dpoc' : quadro === 'eap' ? 'ic' : '')
  const acomp = lerAcompanhamentoVni({ ph: informado(ph4), paco2: informado(paco24), pao2: informado(pao24), sat: informado(sat4), alvoSat: alvoEscolhido, naoRetentor, rebaixamento, instabilidade, pausas, secrecao, dpoc: quadro === 'dpoc' })
  const alternar = (t: string) => setContra((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]))

  return (
    <ToolLayout
      title="Ventilação não invasiva em cinco passos (adulto)"
      description="Quem, interface, ajustes, acompanhamento e retirada, com o que o manual do HCFMUSP traz (cap. 1, 21, 27 e 31). Pressões só onde o livro dá valor (DPOC). Adulto (14 anos ou mais)."
      ficha={fichaVniPassos}
    >
      <BarraPassos passos={PASSOS_VNI} atual={passo} ir={ir} nota={`${QUADROS_VNI[quadro].nome}${iface ? ` · ${iface}` : ''} · ${modo === 'cpap' ? 'CPAP' : 'BiPAP'}`} />

      {passo === 1 && (
        <CartaoPasso n={1} titulo="Esse paciente deve receber VNI?">
          <Escolha label="Quadro" value={quadro} onChange={setQuadro} opcoes={(Object.keys(QUADROS_VNI) as QuadroVni[]).map((q) => ({ value: q, label: QUADROS_VNI[q].nome }))} />
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField id="vni-fr" label="FR" unit="ipm" value={fr} onChange={setFr} />
            <NumberField id="vni-ph" label="pH" value={ph} onChange={setPh} step={0.01} />
            <NumberField id="vni-paco2" label="PaCO2" unit="mmHg" value={paco2} onChange={setPaco2} />
            <NumberField id="vni-pao2" label="PaO2" unit="mmHg" value={pao2} onChange={setPao2} />
            <NumberField id="vni-fio2" label="FiO2" unit="%" value={fio2} onChange={setFio2} max={100} />
            <Resultado rotulo="P/F" valor={pf !== null ? Math.round(pf) : '—'} />
          </div>
          {cortes.length > 0 && <ul className="list-disc pl-5">{cortes.map((c) => <li key={c}>{c}</li>)}</ul>}
          <p className="text-tinta-sussurro">O livro diz que não há critério gasométrico específico para indicar VNI (p. 378): a tela lista os cortes, não decide.</p>
          <p><span className="font-medium">Indicações clínicas (p. 382):</span> {VNI.clinicas.join('; ')}.</p>
          <p><span className="font-medium">Maior evidência de benefício (p. 383):</span> {VNI.maiorEvidencia.join('; ')}.</p>
          <div className="flex flex-col gap-1.5">
            <p className="font-medium">Contraindicações — marque as presentes</p>
            {CONTRAINDICACOES_VNI.map((c, i) => <Marca key={c.texto} id={`vni-ci-${i}`} rotulo={c.texto} extra={c.pagina} marcado={contra.includes(c.texto)} alternar={() => alternar(c.texto)} />)}
          </div>
          {contra.length > 0 && <Alertas itens={[`${contra.length} contraindicação(ões) do livro marcada(s): ${contra.join('; ')}.`]} />}
          <NavPassos atual={1} total={5} ir={ir} proximo="Escolher a interface" />
        </CartaoPasso>
      )}

      {passo === 2 && (
        <CartaoPasso n={2} titulo="Interface">
          <Escolha label="Interface em uso" value={iface} onChange={setIface} opcoes={INTERFACES_VNI.map((i) => ({ value: i, label: i }))} />
          <p className="text-tinta-sussurro">O livro cita as quatro interfaces (p. 382) e não traz critério de escolha entre elas. Lesão facial que impossibilite máscara é contraindicação (p. 384).</p>
          <NavPassos atual={2} total={5} ir={ir} proximo="Montar os ajustes" />
        </CartaoPasso>
      )}

      {passo === 3 && (
        <CartaoPasso n={3} titulo="Modo e pressões">
          <div className="grid gap-2 sm:grid-cols-2">
            {MODOS_VNI.map((m) => <p key={m.id} className="rounded-controle border border-fio px-3 py-2"><span className="font-medium">{m.nome}:</span> {m.texto} <span className="text-tinta-sussurro">({m.pagina})</span></p>)}
          </div>
          <Escolha label="Modo" value={modo} onChange={setModo} opcoes={MODOS_VNI.map((m) => ({ value: m.id, label: m.nome }))} />
          <p className="rounded-controle bg-trilha/50 px-3 py-2">{QUADROS_VNI[quadro].livro} <span className="text-tinta-sussurro">({QUADROS_VNI[quadro].pagina})</span></p>
          <div className="grid gap-4 sm:grid-cols-3">
            {modo === 'bipap' ? (
              <>
                <NumberField id="vni-ipap" label="IPAP" unit="cmH2O" value={ipap} onChange={setIpap} />
                <NumberField id="vni-epap" label="EPAP" unit="cmH2O" value={epap} onChange={setEpap} />
                <Resultado rotulo="Pressão de suporte (IPAP − EPAP)" valor={ajustes.suporte !== null ? `${ajustes.suporte} cmH2O` : '—'} />
              </>
            ) : <NumberField id="vni-cpap" label="CPAP" unit="cmH2O" value={cpap} onChange={setCpap} />}
          </div>
          <Alertas itens={ajustes.foraDoLivro} />
          {ajustes.notas.map((n) => <p key={n} className="text-tinta-sussurro">{n}</p>)}
          <Escolha label="Alvo de SatO2 que o livro escreve" value={alvoEscolhido} onChange={setAlvo} opcoes={ALVOS_SAT_VNI.map((a) => ({ value: a.id, label: `${a.contexto}: ${a.faixa ? `${a.faixa[0]}–${a.faixa[1]}%` : `> ${a.acima}%`}` }))} />
          <p className="text-tinta-sussurro">Alarmes da VNI: o livro não traz valores; nenhum é sugerido.</p>
          <NavPassos atual={3} total={5} ir={ir} proximo="Liguei a VNI — acompanhar" />
        </CartaoPasso>
      )}

      {passo === 4 && (
        <CartaoPasso n={4} titulo="Acompanhar">
          <p className="text-tinta-sussurro">O livro não traz critério de falha da VNI nem escores preditivos (HACOR, ROX). A tela mostra o que ele traz como indicação de VM invasiva e o alvo de SatO2 escolhido.</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <NumberField id="vni-ph4" label="pH" value={ph4} onChange={setPh4} step={0.01} />
            <NumberField id="vni-paco24" label="PaCO2" unit="mmHg" value={paco24} onChange={setPaco24} />
            <NumberField id="vni-pao24" label="PaO2" unit="mmHg" value={pao24} onChange={setPao24} />
            <NumberField id="vni-sat4" label="SatO2" unit="%" value={sat4} onChange={setSat4} max={100} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Marca id="vni-nr" rotulo="Não retentor crônico de CO2" marcado={naoRetentor} alternar={() => setNaoRetentor((x) => !x)} />
            <Marca id="vni-rnc" rotulo="Rebaixamento do nível de consciência" marcado={rebaixamento} alternar={() => setRebaixamento((x) => !x)} />
            <Marca id="vni-inst" rotulo="Instabilidade hemodinâmica" marcado={instabilidade} alternar={() => setInstabilidade((x) => !x)} />
            {quadro === 'dpoc' && <Marca id="vni-pausa" rotulo="Pausas respiratórias com rebaixamento" marcado={pausas} alternar={() => setPausas((x) => !x)} />}
            <Marca id="vni-sec" rotulo="Não consegue manejar ou remover secreção" marcado={secrecao} alternar={() => setSecrecao((x) => !x)} />
          </div>
          {acomp.sat && <p className="font-medium">{acomp.sat}</p>}
          <Alertas itens={acomp.invasiva} />
          {quadro === 'dpoc' && <p className="text-tinta-sussurro">Indicações de VM invasiva na DPOC (Tabela 7, p. 425–426): {INDICACOES_VM_DPOC.join('; ')}.</p>}
          <NavPassos atual={4} total={5} ir={ir} proximo="Retirar" />
        </CartaoPasso>
      )}

      {passo === 5 && (
        <CartaoPasso n={5} titulo="Retirar">
          <p>{RETIRADA_VNI}</p>
          <NavPassos atual={5} total={5} ir={ir} />
        </CartaoPasso>
      )}
    </ToolLayout>
  )
}
