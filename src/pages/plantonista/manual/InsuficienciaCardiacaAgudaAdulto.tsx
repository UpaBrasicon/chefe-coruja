import { useState } from 'react'

import {
  DIFERENCAS_ICA_2021, DIRETRIZ_ICA_2021, ENSAIOS_ICA, BETABLOQUEADOR_ICA, CORTES_IC, DIGOXINA_ICA, FIGURA1_COLUNAS, FUROSEMIDA_ICA, INFUSOES_IC, MR_PROANP_CORTE, PERFIS,
  classificarFe, criteriosUti, faixaPasFigura, fichaIcAgudaAdulto, furosemidaIca, leituraBnp, leituraNtProBnp, levosimendana, mlHFaixaCap, perfilHemodinamico,
  prognosticoIc, respostaDiuretico,
} from '@/clinico/adulto/insuficienciaCardiacaAguda'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'


const pede = 'informe o peso'
const LEITURA = { atinge: 'atinge o corte maior', 'entre-cortes': 'entre os dois números do corte', 'nao-atinge': 'abaixo do corte' }

/** Insuficiência cardíaca aguda do adulto (cap. 21 do manual do HCFMUSP). */
export function InsuficienciaCardiacaAgudaAdulto() {
  const [peso, setPeso] = useState(0)
  const [perf, setPerf] = useState<'quente' | 'frio'>('quente')
  const [vol, setVol] = useState<'seco' | 'umido'>('umido')
  const [pas, setPas] = useState(0)
  const [fe, setFe] = useState(0)
  const [ureia, setUreia] = useState(0)
  const [cr, setCr] = useState(0)
  const [bnp, setBnp] = useState(0)
  const [nt, setNt] = useState(0)
  const [idade, setIdade] = useState(0)
  const [naU, setNaU] = useState(0)
  const [vol6, setVol6] = useState(0)
  const [sao2, setSao2] = useState(0)
  const [fr, setFr] = useState(0)
  const [fc, setFc] = useState(0)

  const perfil = perfilHemodinamico(perf === 'frio', vol === 'umido')
  const faixas = faixaPasFigura(pas)
  const cfe = classificarFe(fe)
  const prog = prognosticoIc(ureia, pas, cr)
  const furo = furosemidaIca(peso)
  const levo = levosimendana(peso)
  const resp = respostaDiuretico(informado(naU), informado(vol6))
  const uti = criteriosUti({ sao2: informado(sao2), fr: informado(fr), fc: informado(fc), pas: informado(pas) })

  return (
    <ToolLayout
      title="Insuficiência cardíaca aguda — adulto"
      description="Perfil hemodinâmico, faixa de PAS da Figura 1, peptídeos, prognóstico, furosemida por peso, resposta ao diurético e infusões com mL/h. Adulto (14 anos ou mais)."
      ficha={fichaIcAgudaAdulto}
    >
      <CampoPeso id="ic-peso" peso={peso} onChange={setPeso}>
        <NumberField id="ic-pas" label="PAS" unit="mmHg" value={pas} onChange={setPas} step={1} />
        <NumberField id="ic-fe" label="Fração de ejeção (se conhecida)" unit="%" value={fe} onChange={setFe} step={1} />
      </CampoPeso>

      <Bloco titulo="Perfil hemodinâmico (p. 289–291)" descricao="Perfusão: enchimento capilar, temperatura da pele, sudorese, confusão, baixo débito urinário, livedo, cianose. Volemia: edema, turgência jugular, fígado palpável, refluxo abdominojugular, ascite, estertores.">
        <div className="flex flex-wrap gap-6">
          <Escolha label="Perfusão" value={perf} onChange={setPerf} opcoes={[{ value: 'quente', label: 'Quente (bem perfundido)' }, { value: 'frio', label: 'Frio (mal perfundido)' }]} />
          <Escolha label="Volemia" value={vol} onChange={setVol} opcoes={[{ value: 'seco', label: 'Seco' }, { value: 'umido', label: 'Úmido (congesto)' }]} />
        </div>
        <LinhaManual nome={`Perfil ${PERFIS[perfil].nome}`} texto={PERFIS[perfil].texto} pagina={PERFIS[perfil].pagina} />
        {faixas && (
          <>
            <p className="text-sm">Figura 1 (p. 302): {faixas.join(' e ')}{faixas.length > 1 && <span className="text-atencao"> — 140 mmHg está nas duas colunas da figura</span>}</p>
            {FIGURA1_COLUNAS.filter((c) => faixas.includes(c.pas)).map((c) => (
              <LinhaManual key={c.pas + c.perfil} nome={`${c.pas} · ${c.perfil}`} texto={c.itens} pagina="Figura 1, p. 302" />
            ))}
          </>
        )}
        {cfe && <p className="text-sm">FE {br(fe, 0)}%: {cfe.rotulos.join(' e ') || '—'} {cfe.nota && <span className="text-tinta-sussurro">({cfe.nota})</span>} (p. 286)</p>}
        <p className="text-sm text-tinta-sussurro">{BETABLOQUEADOR_ICA.texto} ({BETABLOQUEADOR_ICA.pagina})</p>
      </Bloco>

      <Bloco titulo="Furosemida EV (p. 296, 298)">
        <LinhaManual
          nome="Furosemida"
          texto="0,5–1,0 mg/kg/dose; na falha, dobrar a dose; mantida a resposta inadequada, associar tiazídico (ou acetazolamida, p. 298); resposta adequada: manter a dose EV a cada 12 h"
          conta={furo ? <>dose <strong>{faixaBr(furo.doseMg, 0)} mg</strong> · dobrada {faixaBr(furo.dobradaMg, 0)} mg</> : pede}
          pagina="p. 296 e 298"
          errata={FUROSEMIDA_ICA.errata}
        />
        {furo?.acimaDe240 && <p className="text-atencao">A dose dobrada passa de 240 mg, o máximo diário da p. 296.</p>}
        <p className="text-sm text-tinta-sussurro">O capítulo não traz dose de furosemida conforme o uso prévio de diurético.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ic-nau" label="Na urinário em 2 h" unit="mEq/L" value={naU} onChange={setNaU} step={1} />
          <NumberField id="ic-v6" label="Diurese em 6 h" unit="mL" value={vol6} onChange={setVol6} step={10} />
        </div>
        {resp.map((x) => <p key={x.criterio} className={x.leitura === 'nao-atinge' ? 'text-atencao' : ''}>{x.criterio}: {LEITURA[x.leitura]} (corte do livro: Na ≥ 50–70 mEq/L; débito 100–150 mL/h)</p>)}
      </Bloco>

      <Bloco titulo="Infusões (p. 296–297)" descricao="Faixa do capítulo; mL/h no preparo do Anexo 1 (p. 1486–1489).">
        {INFUSOES_IC.map((i) => {
          const ml = informado(peso) || i.id === 'nitroglicerina' ? mlHFaixaCap(i, peso) : null
          return (
            <LinhaManual
              key={i.id}
              nome={i.nome}
              texto={`${faixaBr(i.faixaCap, 3)} ${i.unidade}`}
              conta={i.id === 'levosimendana'
                ? (levo ? <><strong>{faixaBr(levo.ugMin, 2)} µg/min</strong> · {faixaBr(levo.total24hMg, 2)} mg em 24 h</> : pede)
                : ml ? <strong>{faixaBr(ml)} mL/h</strong> : pede}
              pagina={i.pagina}
              nota={i.nota}
            />
          )
        })}
        <LinhaManual nome="Digoxina" texto={`IC com FA de resposta rápida (> ${DIGOXINA_ICA.fcCorte} bpm): ${faixaBr(DIGOXINA_ICA.semUsoPrevioMg, 2)} mg EV sem uso prévio; idosos ou insuficiência renal ${faixaBr(DIGOXINA_ICA.idosoOuIrMg, 4)} mg`} pagina={DIGOXINA_ICA.pagina} />
      </Bloco>

      <Bloco titulo="Laboratório e prognóstico (p. 292–294)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ic-ur" label="Ureia" unit="mg/dL" value={ureia} onChange={setUreia} step={1} />
          <NumberField id="ic-cr" label="Creatinina" unit="mg/dL" value={cr} onChange={setCr} step={0.1} />
          <Resultado rotulo="Três variáveis (usa a PAS acima)" valor={prog ? `${prog.n} de 3 — ${prog.texto}` : 'informe ureia, PAS e creatinina'} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ic-bnp" label="BNP" unit="pg/mL" value={bnp} onChange={setBnp} step={1} />
          <NumberField id="ic-nt" label="NT-proBNP" unit="pg/mL" value={nt} onChange={setNt} step={1} />
          <NumberField id="ic-idade" label="Idade (para o NT-proBNP)" unit="anos" value={idade} onChange={setIdade} step={1} />
        </div>
        {bnp > 0 && <p>{leituraBnp(bnp)}</p>}
        {nt > 0 && <p>{leituraNtProBnp(nt, idade) ?? 'informe a idade'}</p>}
        <p className="text-sm text-tinta-sussurro">BNP: FA e insuficiência renal aumentam; obesidade diminui (p. 295). MR-proANP: &lt; {MR_PROANP_CORTE} pg/mL improvável; ≥ {MR_PROANP_CORTE} provável (p. 294).</p>
        {CORTES_IC.map((c) => <Trecho key={c.texto} texto={c.texto} pagina={c.pagina} />)}
      </Bloco>

      <Bloco titulo="Critérios de UTI com sinal vital (p. 302)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ic-sao2" label="SaO2" unit="%" value={sao2} onChange={setSao2} step={1} />
          <NumberField id="ic-fr" label="FR" unit="irpm" value={fr} onChange={setFr} step={1} />
          <NumberField id="ic-fc" label="FC" unit="bpm" value={fc} onChange={setFc} step={1} />
        </div>
        {uti.length > 0 ? <ul className="list-disc pl-5 text-atencao">{uti.map((u) => <li key={u}>{u}</li>)}</ul> : <p className="text-tinta-sussurro">Nenhum critério numérico atingido com os valores informados.</p>}
        <p className="text-sm text-tinta-sussurro">O livro também lista necessidade de intubação, uso de musculatura acessória, hipoperfusão/baixo débito e arritmias graves.</p>
      </Bloco>
      <Bloco titulo="ESC 2021 e ensaios recentes — ao lado do manual" descricao="ESC 2021 lida pela página do periódico (classes não conferidas); ADVOR, CLOROTIC e DAPA ACT pelos resumos.">
        {sao2 > 0 && <p className="text-sm">{sao2 < 90 ? 'SpO2 informada abaixo de 90%: a ESC 2021 indica oxigênio.' : 'SpO2 informada ≥ 90%: a ESC 2021 não indica oxigênio de rotina (o manual mira > 95%).'}</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left align-top text-sm">
            <thead className="text-tinta-sussurro"><tr><th className="pr-3 pb-2">Tema</th><th className="pr-3 pb-2">ESC 2021</th><th className="pr-3 pb-2">Manual do HC</th></tr></thead>
            <tbody>{DIRETRIZ_ICA_2021.map((d) => <tr key={d.tema} className="border-t"><td className="pr-3 py-2 font-medium">{d.tema}</td><td className="pr-3 py-2">{d.esc}</td><td className="pr-3 py-2 text-tinta-sussurro">{d.livro}</td></tr>)}</tbody>
          </table>
        </div>
        {ENSAIOS_ICA.map((e) => <LinhaManual key={e.ensaio} nome={e.ensaio} texto={e.texto} pagina="resumo" />)}
        <ul className="list-disc pl-5 text-sm text-tinta-sussurro">{DIFERENCAS_ICA_2021.map((d) => <li key={d}>{d}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
