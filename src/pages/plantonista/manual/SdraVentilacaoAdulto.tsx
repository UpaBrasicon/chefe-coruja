import { useState } from 'react'

import {
  NOME_BERLIM, RESGATE_HIPOXEMIA, SDRA, TABELAS_PEEP, berlim, conferirSdra, drivingPressure, fichaSdraAdulto, marcosPf, peepParaFio2,
  relacaoPF, tabelaPeepDaClasse, vtSdra, type ColunaPeep, type TabelaPeepId,
} from '@/clinico/adulto/ventilacaoMecanica'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Alertas, Bloco, Escolha, Resultado } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'

const colunaTexto = (c: ColunaPeep) => `FiO2 ${faixaBr(c.fio2, 1)} → PEEP ${faixaBr(c.peep, 0)}`

function TabelaPeep({ id, destaque }: { id: TabelaPeepId; destaque: ColunaPeep[] }) {
  const t = TABELAS_PEEP[id]
  return (
    <div className="overflow-x-auto">
      <p className="font-medium">{t.nome} <span className="text-muted-foreground">({t.pagina})</span></p>
      <table className="text-xs tabular-nums">
        <tbody>
          <tr><th className="pr-2 text-left">FiO2</th>{t.colunas.map((c, i) => <td key={i} className={`border px-1.5 py-1 ${destaque.includes(c) ? 'bg-primary/15 font-semibold' : ''}`}>{faixaBr(c.fio2, 1).replace('–', '↔')}</td>)}</tr>
          <tr><th className="pr-2 text-left">PEEP</th>{t.colunas.map((c, i) => <td key={i} className={`border px-1.5 py-1 ${destaque.includes(c) ? 'bg-primary/15 font-semibold' : ''}`}>{faixaBr(c.peep, 0).replace('–', '↔')}</td>)}</tr>
        </tbody>
      </table>
    </div>
  )
}

/** SDRA no DE — Berlim, Tabela 5 e tabelas PEEP × FiO2 do cap. 37 do manual do HCFMUSP. */
export function SdraVentilacaoAdulto() {
  const [pao2, setPao2] = useState(0)
  const [fio2, setFio2] = useState(0)
  const [peep, setPeep] = useState(0)
  const [peso, setPeso] = useState(0)
  const [tabela, setTabela] = useState<TabelaPeepId>('baixo')
  const [pplato, setPplato] = useState(0)
  const [fr, setFr] = useState(0)
  const [tins, setTins] = useState(0)
  const [fluxo, setFluxo] = useState(0)
  const [ph, setPh] = useState(0)

  const pf = relacaoPF(pao2, fio2)
  const b = pf !== null ? berlim(pf, peep) : null
  const vt = b?.classe ? vtSdra(b.classe, peso) : null
  const leitura = peepParaFio2(tabela, fio2 / 100)
  const destaque = leitura ? (leitura.exatas.length ? leitura.exatas : [leitura.anterior, leitura.seguinte].filter((c): c is ColunaPeep => !!c)) : []
  const dp = drivingPressure(pplato, peep)
  const avisos = conferirSdra({ pplato: informado(pplato), peep: pplato > 0 ? peep : undefined, fr: informado(fr), tins: informado(tins), fluxo: informado(fluxo), ph: informado(ph) })

  return (
    <ToolLayout
      title="SDRA — ventilação protetora (adulto)"
      description="Classe de Berlim pela P/F, Vt por gravidade, tabelas PEEP × FiO2 (ARDSnet, ALVEOLI, LOVS), driving pressure e marcos de prona e bloqueio, como o cap. 37 do manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaSdraAdulto}
    >
      <Bloco titulo="Critérios de Berlim (p. 505)" descricao="Relação PO2/FiO2 com PEEP ≥ 5 cmH2O: leve 201–300, moderada 101–200, grave ≤ 100. O capítulo traz só a relação P/F.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="sd-pao2" label="PaO2" unit="mmHg" value={pao2} onChange={setPao2} step={1} />
          <NumberField id="sd-fio2" label="FiO2" unit="%" value={fio2} onChange={setFio2} step={5} />
          <NumberField id="sd-peep" label="PEEP" unit="cmH2O" value={peep} onChange={setPeep} step={1} />
        </div>
        {pf !== null && (
          <>
            <Resultado rotulo="P/F" valor={`${br(pf, 0)} mmHg — ${b?.classe ? NOME_BERLIM[b.classe] : 'sem classe'}`} />
            {b?.nota && <p className="text-muted-foreground">{b.nota}</p>}
            <Alertas itens={marcosPf(pf)} />
          </>
        )}
      </Bloco>

      <Bloco titulo="Tabela 5 — ajuste na SDRA (p. 506)" descricao="O livro não diz qual peso usar no mL/kg nem traz fórmula de peso predito: informe o peso que você quer usar.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Vt" valor={`leve ${SDRA.vtLeve} mL/kg; moderada/grave ${faixaBr(SDRA.vtModeradaGrave, 0)} mL/kg`} />
          <Resultado rotulo="PEEP" valor="leve/moderada: tabela PEEP baixo; grave: PEEP alto" />
          <Resultado rotulo="FiO2" valor="100% inicial → SatO2 > 92%" />
          <Resultado rotulo="FR" valor={`${SDRA.frInicial} rpm inicial; graves podem precisar de ${faixaBr(SDRA.frGrave, 0)}`} />
          <Resultado rotulo="PCV · VCV" valor="Tins ≤ 1 s · fluxo 45–60 L/min; I:E ≥ 1:2" />
          <Resultado rotulo="Pressões" valor="Pplatô ≤ 30; evitar driving pressure > 15 cmH2O" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="sd-peso" label="Peso usado na conta" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <Resultado rotulo="Vt pela classe de Berlim" valor={vt ? `${faixaBr(vt, 0)} mL` : b?.classe ? 'informe o peso' : 'informe PaO2, FiO2 e PEEP'} />
        </div>
        <p className="text-muted-foreground">p. 506: modos controlados nas primeiras 48–72 horas; diminuir espaço morto não fisiológico. p. 507: tolera-se hipercapnia se pH &gt; 7,2.</p>
      </Bloco>

      <Bloco titulo="Tabelas PEEP × FiO2 (p. 506–507)" descricao="A tela marca a coluna da FiO2 informada; sem coluna exata, marca as vizinhas — o livro não interpola. As duas tabelas de PEEP alto têm resultados práticos muito semelhantes (p. 507).">
        <Escolha label="Tabela" value={tabela} onChange={setTabela} opcoes={[{ value: 'baixo', label: 'PEEP baixo (Tabela 6)' }, { value: 'alveoli', label: 'PEEP alto — ALVEOLI' }, { value: 'lovs', label: 'PEEP alto — LOVS' }]} />
        {b?.classe && <p>Para a classe {NOME_BERLIM[b.classe].toLowerCase()}, a Tabela 5 aponta a tabela de PEEP {tabelaPeepDaClasse(b.classe)}.</p>}
        <TabelaPeep id={tabela} destaque={destaque} />
        {leitura && (leitura.exatas.length
          ? <p>FiO2 {br(fio2 / 100, 2)}: {leitura.exatas.map(colunaTexto).join(' · ')}</p>
          : <p>FiO2 {br(fio2 / 100, 2)} sem coluna na tabela. Vizinhas: {[leitura.anterior, leitura.seguinte].filter((c): c is ColunaPeep => !!c).map(colunaTexto).join(' · ')}</p>)}
      </Bloco>

      <Bloco titulo="Conferir o ventilador contra a Tabela 5">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="sd-plato" label="Pplatô" unit="cmH2O" value={pplato} onChange={setPplato} step={1} />
          <Resultado rotulo="Driving pressure (Pplatô − PEEP)" valor={dp !== null ? `${br(dp, 0)} cmH2O` : '—'} />
          <NumberField id="sd-fr" label="FR" unit="rpm" value={fr} onChange={setFr} step={1} />
          <NumberField id="sd-tins" label="Tins" unit="s" value={tins} onChange={setTins} step={0.1} />
          <NumberField id="sd-fluxo" label="Fluxo (VCV)" unit="L/min" value={fluxo} onChange={setFluxo} step={5} />
          <NumberField id="sd-ph" label="pH" value={ph} onChange={setPh} step={0.01} />
        </div>
        {avisos.length ? <Alertas itens={avisos} /> : <p>Nenhum valor informado fora da Tabela 5.</p>}
      </Bloco>

      <Bloco titulo="Hipoxemia grave — recursos citados (p. 507–508)">
        <ul className="list-disc pl-5">{RESGATE_HIPOXEMIA.map((r) => <li key={r.nome}><strong>{r.nome}:</strong> {r.texto} <span className="text-muted-foreground">({r.pagina})</span></li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
