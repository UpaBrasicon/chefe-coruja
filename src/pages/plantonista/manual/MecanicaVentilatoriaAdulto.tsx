import { useState } from 'react'

import { CAUSAS_MECANICA, CONDICOES_MECANICA, EXEMPLO_FIGURA2, NORMAL_MECANICA, fichaMecanicaAdulto, mecanica } from '@/clinico/adulto/ventilacaoMecanica'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoCopia } from '@/domain/copiaCalculo'
import { Button } from '@/components/ui/button'

import { Bloco, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'

/** Mecânica ventilatória — resistência, complacência estática, constante de tempo e driving pressure (cap. 37). */
export function MecanicaVentilatoriaAdulto() {
  const [vc, setVc] = useState(0)
  const [fluxo, setFluxo] = useState(60)
  const [ppico, setPpico] = useState(0)
  const [pplato, setPplato] = useState(0)
  const [peep, setPeep] = useState(0)

  const m = mecanica({ vcMl: vc, fluxoLMin: fluxo, ppico, pplato, peep })
  const exemplo = () => {
    const e = EXEMPLO_FIGURA2
    setVc(e.vcMl); setFluxo(e.fluxoLMin); setPpico(e.ppico); setPplato(e.pplato); setPeep(e.peep)
  }
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaMecanicaAdulto.id)
  const temResultado = m.resistencia !== null || m.complacencia !== null || m.driving !== null
  const linhas = [
    ...(m.resistencia !== null ? [`Resistência ${br(m.resistencia, 1)} cmH2O/L/s`] : []),
    ...(m.complacencia !== null ? [`Complacência estática ${br(m.complacencia, 1)} mL/cmH2O`] : []),
    ...(m.driving !== null ? [`Driving pressure ${br(m.driving, 1)} cmH2O`] : []),
  ]

  // Texto do "Copiar" (C4 = A): valores do ventilador, as quatro contas e as notas das faixas do livro.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'Mecânica ventilatória (adulto)',
        dados: [
          ['Volume corrente', vc > 0 ? `${br(vc, 0)} mL` : ''],
          ['Fluxo', fluxo > 0 ? `${br(fluxo, 0)} L/min` : ''],
          ['Ppico', ppico > 0 ? `${br(ppico, 0)} cmH2O` : ''],
          ['Pplatô', pplato > 0 ? `${br(pplato, 0)} cmH2O` : ''],
          ['PEEP', `${br(peep, 0)} cmH2O`],
        ],
        resultado: [
          ...(m.resistencia !== null ? [`Resistência (Ppico − Pplatô)/fluxo: ${br(m.resistencia, 1)} cmH2O/L/s · normal ${faixaBr(NORMAL_MECANICA.resistencia, 0)} (p. 499)`] : []),
          ...(m.complacencia !== null ? [`Complacência estática VC/(Pplatô − PEEP): ${br(m.complacencia, 1)} mL/cmH2O · normal ${faixaBr(NORMAL_MECANICA.complacencia, 0)} (p. 499)`] : []),
          ...(m.driving !== null ? [`Driving pressure (Pplatô − PEEP): ${br(m.driving, 1)} cmH2O · evitar > 15 (p. 506)`] : []),
          ...(m.tau ? [`Constante de tempo (R × Cst): ${br(m.tau.tauS, 2)} s · esvaziamento ${faixaBr(m.tau.esvaziamentoS, 2)} s`] : []),
          ...m.notas,
        ],
        fonte: textoFontes(fichaMecanicaAdulto),
        versao: fichaMecanicaAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Mecânica ventilatória (adulto)"
      description="Resistência, complacência estática, constante de tempo e driving pressure com as fórmulas e faixas do cap. 37 do manual do HCFMUSP. Adulto (14 anos ou mais)."
      ficha={fichaMecanicaAdulto}
    >
      <Bloco titulo="Condições para a medida (p. 499–500)">
        <ol className="list-decimal pl-5">{CONDICOES_MECANICA.map((c) => <li key={c}>{c}</li>)}</ol>
      </Bloco>

      <Bloco titulo="Valores do ventilador" descricao="VCV com fluxo quadrado e pausa inspiratória. O fluxo em L/min é convertido para L/s (60 L/min = 1 L/s).">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="mc-vc" label="Volume corrente" unit="mL" value={vc} onChange={setVc} step={10} />
          <NumberField id="mc-fluxo" label="Fluxo" unit="L/min" value={fluxo} onChange={setFluxo} step={5} />
          <NumberField id="mc-pico" label="Ppico" unit="cmH2O" value={ppico} onChange={setPpico} step={1} />
          <NumberField id="mc-plato" label="Pplatô" unit="cmH2O" value={pplato} onChange={setPplato} step={1} />
          <NumberField id="mc-peep" label="PEEP" unit="cmH2O" value={peep} onChange={setPeep} step={1} />
        </div>
        <div><Button type="button" size="sm" variant="outline" onClick={exemplo}>Carregar o exemplo da Figura 2 (p. 499)</Button></div>
      </Bloco>

      <Bloco titulo="Resultado">
        <div className="grid gap-3 sm:grid-cols-2">
          <Resultado rotulo={`Resistência (Ppico − Pplatô)/fluxo · normal ${faixaBr(NORMAL_MECANICA.resistencia, 0)}`} valor={m.resistencia !== null ? `${br(m.resistencia, 1)} cmH2O/L/s` : '—'} />
          <Resultado rotulo={`Complacência estática VC/(Pplatô − PEEP) · normal ${faixaBr(NORMAL_MECANICA.complacencia, 0)}`} valor={m.complacencia !== null ? `${br(m.complacencia, 1)} mL/cmH2O` : '—'} />
          <Resultado rotulo="Driving pressure (Pplatô − PEEP) · evitar > 15 (p. 506)" valor={m.driving !== null ? `${br(m.driving, 1)} cmH2O` : '—'} />
          <Resultado rotulo="Constante de tempo (R × Cst) · 3–5 constantes para esvaziar" valor={m.tau ? `${br(m.tau.tauS, 2)} s · esvaziamento ${faixaBr(m.tau.esvaziamentoS, 2)} s` : '—'} />
        </div>
        {m.notas.length > 0 && <ul className="list-disc pl-5">{m.notas.map((n) => <li key={n}>{n}</li>)}</ul>}
        {/* A errata da fórmula impressa vai para "Armadilhas" (C6 = A). */}
        <Trecho texto="Resistência (Ppico – Pplatô/fluxo); complacência (volume corrente/Pplatô – PEEP)" pagina="p. 499" />
        <p className="text-tinta-sussurro">Complacência dinâmica: o capítulo não traz fórmula — não calculada.</p>
      </Bloco>

      <Bloco titulo="Tabela 1 — causas (p. 500)">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><p className="font-medium">↓ Complacência</p><ul className="list-disc pl-5">{CAUSAS_MECANICA.complacencia.map((c) => <li key={c}>{c}</li>)}</ul></div>
          <div><p className="font-medium">↑ Resistência</p><ul className="list-disc pl-5">{CAUSAS_MECANICA.resistencia.map((c) => <li key={c}>{c}</li>)}</ul></div>
        </div>
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={[
          'Fórmulas da p. 499 — errata do livro: impresso sem parênteses; a Figura 2 confirma (Ppico − Pplatô)/fluxo e VC/(Pplatô − PEEP).',
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaMecanicaAdulto}
        guia={guia}
      />
      <ResumoFlutuante
        principal={linhas.length ? linhas[0] : 'Informe os valores do ventilador'}
        detalhe={linhas.length > 1 ? linhas.slice(1).join(' · ') : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
