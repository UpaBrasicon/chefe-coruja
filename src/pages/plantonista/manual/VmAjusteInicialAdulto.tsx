import { useState } from 'react'

import {
  AJUSTE_INICIAL, ASSINCRONIAS, DOPE, ERRATA_VM, INDICACOES_VM, NOME_MODO, POS_INTUBACAO, TABELA2, cortesIndicacaoVm, fichaVmAjusteAdulto,
  relacaoIE, tinsVcv, vcPorPeso, type Modo,
} from '@/clinico/adulto/ventilacaoMecanica'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoCopia } from '@/domain/copiaCalculo'

import { Alertas, Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'

/** Ventilação mecânica no DE: indicações, ajuste inicial (Tabela 2) e pós-intubação — cap. 37 do manual do HCFMUSP. */
export function VmAjusteInicialAdulto() {
  const [po2, setPo2] = useState(0)
  const [pco2, setPco2] = useState(0)
  const [modo, setModo] = useState<Modo>('vcv')
  const [peso, setPeso] = useState(0)
  const [fr, setFr] = useState(14)
  const [tins, setTins] = useState(1)
  const [vc, setVc] = useState(0)
  const [fluxo, setFluxo] = useState(60)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaVmAjusteAdulto.id)

  const cortes = cortesIndicacaoVm({ po2: informado(po2), pco2: informado(pco2) })
  const vt = vcPorPeso(peso, AJUSTE_INICIAL.vtMlKg)
  const tinsCalc = modo === 'vcv' ? tinsVcv(vc, fluxo) : modo === 'pcv' ? tins : null
  const ie = tinsCalc !== null ? relacaoIE(fr, tinsCalc) : null

  const avisos: string[] = []
  if (modo !== 'psv' && fr > 0 && (fr < AJUSTE_INICIAL.fr[0] || fr > AJUSTE_INICIAL.fr[1])) avisos.push('FR fora de 12–16 rpm (valor inicial da Tabela 2)')
  if (modo === 'pcv' && tins > 0 && (tins < AJUSTE_INICIAL.tins[0] || tins > AJUSTE_INICIAL.tins[1])) avisos.push('Tins fora de 0,8–1,2 s (Tabela 2, PCV)')
  if (modo === 'vcv' && fluxo > 0 && (fluxo < AJUSTE_INICIAL.fluxo[0] || fluxo > AJUSTE_INICIAL.fluxo[1])) avisos.push('Fluxo fora de 30–60 L/min (Tabela 2, VCV)')
  if (ie && (ie.n < AJUSTE_INICIAL.ie[0] || ie.n > AJUSTE_INICIAL.ie[1])) avisos.push(`I:E 1:${br(ie.n, 1)} — a Tabela 2 visa 1:2 ou 1:3`)
  if (vc > 0 && vt && (vc < vt[0] || vc > vt[1])) avisos.push(`VC ${vc} mL fora de 6–8 mL/kg do peso informado (${faixaBr(vt, 0)} mL)`)

  const temGaso = po2 > 0 || pco2 > 0
  const temResultado = temGaso || vt !== null || (modo === 'vcv' && ie !== null)
  const textoCortes = cortes.length ? `cortes do livro atingidos: ${cortes.join('; ')}` : 'nenhum corte numérico da p. 498 atingido'
  const textoIE = ie && tinsCalc ? `Ciclo ${br(ie.cicloS, 2)} s · Tins ${br(tinsCalc, 2)} s · Te ${br(ie.teS, 2)} s · I:E 1:${br(ie.n, 1)}` : null

  // Texto do "Copiar" (C4 = A): gasometria, modo, Vt pelo peso informado, I:E e os avisos da Tabela 2.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'Ventilação mecânica — ajuste inicial (adulto)',
        dados: [
          ['PO2', po2 > 0 ? `${br(po2, 0)} mmHg` : ''],
          ['PCO2', pco2 > 0 ? `${br(pco2, 0)} mmHg` : ''],
          ['Modo', NOME_MODO[modo]],
          ['Peso usado na conta', peso > 0 ? `${br(peso, 1)} kg` : ''],
          ['FR', modo !== 'psv' && fr > 0 ? `${br(fr, 0)} rpm` : ''],
          ['Tins', modo === 'pcv' && tins > 0 ? `${br(tins, 2)} s` : ''],
          ['VC ajustado', modo === 'vcv' && vc > 0 ? `${br(vc, 0)} mL` : ''],
          ['Fluxo (onda quadrada)', modo === 'vcv' && fluxo > 0 ? `${br(fluxo, 0)} L/min` : ''],
        ],
        resultado: [
          ...(temGaso ? [`Indicação (p. 498): ${textoCortes}`] : []),
          ...(vt ? [`Vt 6–8 mL/kg do peso informado (Tabela 2, p. 501–502): ${faixaBr(vt, 0)} mL`] : []),
          ...(modo !== 'psv' && textoIE ? [`${textoIE} (Tabela 2, p. 501–502)`] : []),
          ...avisos,
        ],
        fonte: textoFontes(fichaVmAjusteAdulto),
        versao: fichaVmAjusteAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Ventilação mecânica — ajuste inicial (adulto)"
      description="Indicações, parâmetros iniciais de PCV, VCV e PSV, relação I:E e checagem pós-intubação, como o cap. 37 do manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaVmAjusteAdulto}
    >
      <Bloco titulo="Indicações (p. 498)" descricao="Os cortes numéricos vêm junto do contexto clínico que o livro exige.">
        <ul className="list-disc pl-5">{INDICACOES_VM.map((i) => <li key={i.texto}>{i.texto} <span className="text-tinta-sussurro">({i.pagina})</span></li>)}</ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField id="vm-po2" label="PO2" unit="mmHg" value={po2} onChange={setPo2} step={1} />
          <NumberField id="vm-pco2" label="PCO2" unit="mmHg" value={pco2} onChange={setPco2} step={1} />
        </div>
        {(po2 > 0 || pco2 > 0) && <p>{cortes.length ? <>Cortes do livro atingidos: <strong>{cortes.join('; ')}</strong>.</> : 'Nenhum corte numérico da p. 498 atingido.'}</p>}
      </Bloco>

      <Bloco titulo="Tabela 2 — modos básicos e ajustes (p. 501–502)">
        <Escolha label="Modo" value={modo} onChange={setModo} opcoes={(['pcv', 'vcv', 'psv'] as Modo[]).map((m) => ({ value: m, label: NOME_MODO[m] }))} />
        <dl className="grid gap-2 sm:grid-cols-2">
          {TABELA2.map((l) => (
            <div key={l.parametro} className="rounded-controle border px-3 py-2">
              <dt className="text-tinta-sussurro">{l.parametro}</dt>
              <dd>{l.modos[modo]}</dd>
            </div>
          ))}
        </dl>
      </Bloco>

      <Bloco titulo="Volume corrente e relação I:E" descricao="Vt 6–8 mL/kg (Tabela 2). O livro não diz se é peso real, ideal ou predito e não traz fórmula de peso predito: informe o peso que você quer usar.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="vm-peso" label="Peso usado na conta" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <Resultado rotulo="Vt 6–8 mL/kg" valor={vt ? `${faixaBr(vt, 0)} mL` : 'informe o peso'} />
        </div>
        {modo !== 'psv' ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField id="vm-fr" label="FR" unit="rpm" value={fr} onChange={setFr} step={1} />
            {modo === 'pcv' ? (
              <NumberField id="vm-tins" label="Tins" unit="s" value={tins} onChange={setTins} step={0.1} />
            ) : (
              <>
                <NumberField id="vm-vc" label="VC ajustado" unit="mL" value={vc} onChange={setVc} step={10} />
                <NumberField id="vm-fluxo" label="Fluxo (onda quadrada)" unit="L/min" value={fluxo} onChange={setFluxo} step={5} />
              </>
            )}
            <Resultado rotulo="Ciclo · Tins · Te · I:E" valor={ie && tinsCalc ? `${br(ie.cicloS, 2)} s · ${br(tinsCalc, 2)} s · ${br(ie.teS, 2)} s · 1:${br(ie.n, 1)}` : '—'} />
          </div>
        ) : (
          <p className="text-tinta-sussurro">Na PSV a FR é do paciente (ajustar ventilação de apneia); ciclagem inicial a 25% do pico de fluxo.</p>
        )}
        {modo === 'vcv' && <p className="text-tinta-sussurro">Tins do VCV = VC ÷ fluxo em onda quadrada (conta aritmética; 60 L/min = 1 L/s, como na Figura 2).</p>}
        <Alertas itens={avisos} />
      </Bloco>

      <Bloco titulo="Pós-intubação (Figura 4, p. 509)">
        <ul className="list-disc pl-5">{POS_INTUBACAO.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="font-medium">Instabilização inesperada em VM — DOPE (p. 502)</p>
        <ul className="list-disc pl-5">{DOPE.map((i) => <li key={i}>{i}</li>)}</ul>
      </Bloco>

      <Bloco titulo="Assincronias (Tabela 3, p. 502–504)">
        {ASSINCRONIAS.map((a) => (
          <Trecho key={a.nome} texto={`${a.nome}: ${a.identificacao}. O livro traz: ${a.livro}.`} pagina="Tabela 3" errata={a.errata} />
        ))}
      </Bloco>

      {/* Errata e divergências do cap. 37 vão para "Armadilhas" (C6 = A); o aviso do peso fica no bloco do Vt. */}
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={[...ERRATA_VM.map((e) => `Errata do cap. 37 — ${e}`), ...(guia?.armadilhas ?? [])]}
        ficha={fichaVmAjusteAdulto}
        guia={guia}
      />
      <ResumoFlutuante
        principal={vt ? `${NOME_MODO[modo]} · Vt ${faixaBr(vt, 0)} mL` : temGaso ? (cortes.length ? 'Corte de indicação da p. 498 atingido' : 'Nenhum corte da p. 498 atingido') : `${NOME_MODO[modo]} · informe gasometria ou peso`}
        detalhe={avisos.length ? `${avisos.length} valor${avisos.length > 1 ? 'es' : ''} fora da Tabela 2` : modo !== 'psv' && textoIE ? textoIE : undefined}
        tom={avisos.length ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
