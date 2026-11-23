import { useState } from 'react'

import {
  DIFERENCAS_ICA_2026, DIRETRIZ_ICA_2026, ENSAIOS_ICA, BETABLOQUEADOR_ICA, CORTES_IC, DIGOXINA_ICA, FIGURA1_COLUNAS, FUROSEMIDA_ICA, INFUSOES_IC, MR_PROANP_CORTE, PERFIS,
  classificarFe, criteriosUti, faixaPasFigura, fichaIcAgudaAdulto, furosemidaIca, leituraBnp, leituraNtProBnp, levosimendana, mlHFaixaCap, perfilHemodinamico,
  prognosticoIc, respostaDiuretico,
} from '@/clinico/adulto/insuficienciaCardiacaAguda'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { EscolhaDaAmpola } from '@/components/plantonista/calc/EscolhaDaAmpola'
import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'


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
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaIcAgudaAdulto.id)
  const temPeso = Number.isFinite(peso) && peso > 0
  const temResultado = temPeso || pas > 0 || fe > 0 || prog !== null || bnp > 0 || nt > 0 || resp.length > 0 || sao2 > 0 || fr > 0 || fc > 0
  const infusoes = INFUSOES_IC.map((i) => {
    const ml = informado(peso) || i.id === 'nitroglicerina' ? mlHFaixaCap(i, peso) : null
    const conta = i.id === 'levosimendana'
      ? (levo ? `${faixaBr(levo.ugMin, 2)} µg/min · ${faixaBr(levo.total24hMg, 2)} mg em 24 h` : '—')
      : ml ? `${faixaBr(ml)} mL/h` : '—'
    return `- ${i.nome}: ${faixaBr(i.faixaCap, 3)} ${i.unidade} — ${conta} (${i.pagina})`
  })

  // Texto do "Copiar" (C3 e C4 = A): dados, perfil, furosemida e infusões com a mesma conta da tela, laboratório e UTI.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'Insuficiência cardíaca aguda — adulto',
        dados: [
          ['Peso', temPeso ? `${numeroBr(peso)} kg` : ''],
          ['PAS', pas > 0 ? `${numeroBr(pas)} mmHg` : ''],
          ['Fração de ejeção', fe > 0 ? `${numeroBr(fe)}%` : ''],
          ['Perfusão', perf === 'frio' ? 'fria (mal perfundido)' : 'quente (bem perfundido)'],
          ['Volemia', vol === 'umido' ? 'úmido (congesto)' : 'seco'],
          ['Ureia', ureia > 0 ? `${numeroBr(ureia)} mg/dL` : ''],
          ['Creatinina', cr > 0 ? `${numeroBr(cr)} mg/dL` : ''],
          ['BNP', bnp > 0 ? `${numeroBr(bnp)} pg/mL` : ''],
          ['NT-proBNP', nt > 0 ? `${numeroBr(nt)} pg/mL` : ''],
          ['Idade', idade > 0 ? `${numeroBr(idade)} anos` : ''],
          ['Na urinário em 2 h', naU > 0 ? `${numeroBr(naU)} mEq/L` : ''],
          ['Diurese em 6 h', vol6 > 0 ? `${numeroBr(vol6)} mL` : ''],
          ['SaO2', sao2 > 0 ? `${numeroBr(sao2)}%` : ''],
          ['FR', fr > 0 ? `${numeroBr(fr)} irpm` : ''],
          ['FC', fc > 0 ? `${numeroBr(fc)} bpm` : ''],
        ],
        resultado: [
          `Perfil ${PERFIS[perfil].nome}: ${PERFIS[perfil].texto} (${PERFIS[perfil].pagina})`,
          ...(faixas ? [`Figura 1 (p. 302): ${faixas.join(' e ')}`] : []),
          ...(cfe ? [`FE ${br(fe, 0)}%: ${cfe.rotulos.join(' e ') || '—'}${cfe.nota ? ` (${cfe.nota})` : ''} (p. 286)`] : []),
          ...(temPeso
            ? [
                `Furosemida (p. 296 e 298): dose ${furo ? `${faixaBr(furo.doseMg, 0)} mg · dobrada ${faixaBr(furo.dobradaMg, 0)} mg` : '—'}`,
                ...(furo?.acimaDe240 ? ['A dose dobrada passa de 240 mg, o máximo diário da p. 296.'] : []),
                `Errata da furosemida: ${FUROSEMIDA_ICA.errata}`,
                'Infusões (p. 296–297; mL/h no preparo do Anexo 1):',
                ...infusoes,
                `- Digoxina: IC com FA de resposta rápida (> ${DIGOXINA_ICA.fcCorte} bpm): ${faixaBr(DIGOXINA_ICA.semUsoPrevioMg, 2)} mg EV sem uso prévio; idosos ou insuficiência renal ${faixaBr(DIGOXINA_ICA.idosoOuIrMg, 4)} mg (${DIGOXINA_ICA.pagina})`,
              ]
            : []),
          ...resp.map((x) => `${x.criterio}: ${LEITURA[x.leitura]} (corte do livro: Na ≥ 50–70 mEq/L; débito 100–150 mL/h)`),
          ...(prog ? [`Prognóstico, três variáveis (p. 292–294): ${prog.n} de 3 — ${prog.texto}`] : []),
          ...(bnp > 0 ? [leituraBnp(bnp) ?? ''] : []),
          ...(nt > 0 ? [leituraNtProBnp(nt, idade) ?? 'NT-proBNP: informe a idade'] : []),
          ...(uti.length ? [`Critérios de UTI (p. 302): ${uti.join('; ')}`] : []),
        ].filter((l) => l !== ''),
        fonte: textoFontes(fichaIcAgudaAdulto),
        versao: fichaIcAgudaAdulto.versao,
        quando: new Date(),
      })
    : undefined

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
            <p className="text-apoio">Figura 1 (p. 302): {faixas.join(' e ')}{faixas.length > 1 && <span className="text-atencao"> — 140 mmHg está nas duas colunas da figura</span>}</p>
            {FIGURA1_COLUNAS.filter((c) => faixas.includes(c.pas)).map((c) => (
              <LinhaManual key={c.pas + c.perfil} nome={`${c.pas} · ${c.perfil}`} texto={c.itens} pagina="Figura 1, p. 302" />
            ))}
          </>
        )}
        {cfe && <p className="text-apoio">FE {br(fe, 0)}%: {cfe.rotulos.join(' e ') || '—'} {cfe.nota && <span className="text-tinta-sussurro">({cfe.nota})</span>} (p. 286)</p>}
        <p className="text-apoio text-tinta-sussurro">{BETABLOQUEADOR_ICA.texto} ({BETABLOQUEADOR_ICA.pagina})</p>
      </Bloco>

      <Bloco titulo="Furosemida EV (p. 296, 298)">
        <LinhaManual
          nome="Furosemida"
          texto="0,5–1,0 mg/kg/dose; na falha, dobrar a dose; mantida a resposta inadequada, associar tiazídico (ou acetazolamida, p. 298); resposta adequada: manter a dose EV a cada 12 h"
          conta={furo ? <>dose <strong>{faixaBr(furo.doseMg, 0)} mg</strong> · dobrada {faixaBr(furo.dobradaMg, 0)} mg</> : pede}
          pagina="p. 296 e 298"
          errata={FUROSEMIDA_ICA.errata}
          extra={furo ? <EscolhaDaAmpola chave="adulto-ic:furosemida" unidade="mg" doses={[{ rotulo: 'Dose', dose: furo.doseMg }, { rotulo: 'Dobrada', dose: furo.dobradaMg }]} /> : undefined}
        />
        {furo?.acimaDe240 && <p className="text-atencao">A dose dobrada passa de 240 mg, o máximo diário da p. 296.</p>}
        <p className="text-apoio text-tinta-sussurro">O capítulo não traz dose de furosemida conforme o uso prévio de diurético.</p>
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
        <p className="text-apoio text-tinta-sussurro">BNP: FA e insuficiência renal aumentam; obesidade diminui (p. 295). MR-proANP: &lt; {MR_PROANP_CORTE} pg/mL improvável; ≥ {MR_PROANP_CORTE} provável (p. 294).</p>
        {CORTES_IC.map((c) => <Trecho key={c.texto} texto={c.texto} pagina={c.pagina} />)}
      </Bloco>

      <Bloco titulo="Critérios de UTI com sinal vital (p. 302)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ic-sao2" label="SaO2" unit="%" value={sao2} onChange={setSao2} step={1} />
          <NumberField id="ic-fr" label="FR" unit="irpm" value={fr} onChange={setFr} step={1} />
          <NumberField id="ic-fc" label="FC" unit="bpm" value={fc} onChange={setFc} step={1} />
        </div>
        {uti.length > 0 ? <ul className="list-disc pl-5 text-atencao">{uti.map((u) => <li key={u}>{u}</li>)}</ul> : <p className="text-tinta-sussurro">Nenhum critério numérico atingido com os valores informados.</p>}
        <p className="text-apoio text-tinta-sussurro">O livro também lista necessidade de intubação, uso de musculatura acessória, hipoperfusão/baixo débito e arritmias graves.</p>
      </Bloco>
      {/* ESC 2026 e ensaios vão para "Evidências" (C6 = A); a errata da furosemida fica no item: muda o máximo da dose. */}
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaIcAgudaAdulto}
        guia={guia}
        comparacao={
          <BlocoComparacao titulo="ESC 2026 e ensaios recentes — ao lado da ESC 2021 e do manual" resumo="ESC 2026: recomendações da seção 7 (IC descompensada) pelo slideset oficial da ESC, com classe e nível; o texto integral está fechado e os slides não trazem dose. ADVOR, CLOROTIC e DAPA ACT pelos resumos.">
            {sao2 > 0 && <p className="text-apoio">{sao2 < 90 ? 'SpO2 informada abaixo de 90%: a ESC 2026 recomenda oxigênio (I, C).' : 'SpO2 informada ≥ 90%: a ESC 2026 não indica oxigênio de rotina (o manual mira > 95%).'}</p>}
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[760px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">ESC 2026</TableHead><TableHead className="pr-3 pb-2">ESC 2021</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_ICA_2026.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.esc2026} <span className="text-tinta-sussurro">({d.classe}; {d.slide})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.esc2021}</TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            {ENSAIOS_ICA.map((e) => <LinhaManual key={e.ensaio} nome={e.ensaio} texto={e.texto} pagina="resumo" />)}
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_ICA_2026.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={temPeso ? `Adulto · ${numeroBr(peso)} kg · perfil ${perfil}` : `Perfil ${PERFIS[perfil].nome} · informe o peso`}
        detalhe={[
          ...(furo ? [`furosemida ${faixaBr(furo.doseMg, 0)} mg`] : []),
          ...(furo?.acimaDe240 ? ['dose dobrada acima de 240 mg'] : []),
          ...(uti.length ? [`${uti.length} critério${uti.length > 1 ? 's' : ''} de UTI`] : []),
          ...(temPeso ? ['"Copiar" leva também as infusões'] : []),
        ].join(' · ') || undefined}
        tom={uti.length || furo?.acimaDe240 ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
