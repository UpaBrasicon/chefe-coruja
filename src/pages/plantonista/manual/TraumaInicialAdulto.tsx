import { useState } from 'react'

import {
  ALIQUOTA_TRAUMA_ML, ERRATA_TRAUMA, RMC_ADULTO, TORACOLOMBAR, TORNIQUETE_MAX_MIN, TRAUMA_REFERENCIAS, TXA_TRAUMA,
  cristaloideAcumulado, fichaTraumaAdulto, hemotorax, torniqueteRestante, txaTrauma,
} from '@/clinico/adulto/trauma'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { Bloco, LinhaManual } from './PecasLoteC'

const CRISTALOIDE = { abaixo: 'abaixo de 1 L', dentro: 'dentro de 1–3 L', acima: 'acima de 3 L' }

/** Atendimento inicial do politraumatizado (caps. 47–48 do manual do HCFMUSP): tempos e volumes. */
export function TraumaInicialAdulto() {
  const [minTrauma, setMinTrauma] = useState(0)
  const [drenIni, setDrenIni] = useState(0)
  const [drenSub, setDrenSub] = useState(0)
  const [drenH, setDrenH] = useState(0)
  const [minTorniquete, setMinTorniquete] = useState(0)
  const [cristal, setCristal] = useState(0)

  const txa = minTrauma > 0 ? txaTrauma(minTrauma) : null
  const hemo = drenIni > 0 ? hemotorax(drenIni, informado(drenSub), informado(drenH)) : null
  const torn = minTorniquete > 0 ? torniqueteRestante(minTorniquete) : null
  const cris = cristal > 0 ? cristaloideAcumulado(cristal) : null

  return (
    <ToolLayout
      title="Politraumatizado — tempos e volumes (adulto)"
      description="Janela e velocidade do ácido tranexâmico, débito do dreno no hemotórax, tempo de torniquete e cristaloide antes da transfusão, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaTraumaAdulto}
    >
      <Bloco titulo="Ácido tranexâmico — CRASH-2 (p. 649)">
        <LinhaManual
          nome="Ácido tranexâmico"
          texto={`${TXA_TRAUMA.bolusG} g IV em bolus em ${TXA_TRAUMA.bolusMin} min, seguido de ${TXA_TRAUMA.manutG} g IV ao longo de ${TXA_TRAUMA.manutH} h, desde que com menos de ${TXA_TRAUMA.janelaH} h do trauma, na hemorragia conhecida ou suspeita`}
          conta={<>bolus 100 mg/min · manutenção 125 mg/h · total 2 g</>}
          pagina={TXA_TRAUMA.pagina}
          nota="O capítulo não traz apresentação nem diluição: a conta fica em mg/min e mg/h."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-min" label="Tempo desde o trauma" unit="min" value={minTrauma} onChange={setMinTrauma} step={5} />
          <Resultado rotulo="Janela de menos de 3 h" valor={txa ? (txa.dentroDaJanela ? `dentro — faltam ${br(txa.minutosRestantes, 0)} min` : 'fora (3 h ou mais)') : '—'} />
        </div>
      </Bloco>

      <Bloco titulo="Hemotórax (p. 644–645)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-dren" label="Drenagem inicial" unit="mL" value={drenIni} onChange={setDrenIni} step={50} />
          <NumberField id="tr-drens" label="Drenagem subsequente" unit="mL" value={drenSub} onChange={setDrenSub} step={10} />
          <NumberField id="tr-drenh" label="Em" unit="h" value={drenH} onChange={setDrenH} step={0.5} />
        </div>
        {hemo && (
          <>
            <p className={hemo.inicialAtinge ? 'text-atencao' : ''}>
              Inicial {br(drenIni, 0)} mL: {hemo.inicialAtinge ? 'igual ou superior a 1.500 mL — o livro fala em alta probabilidade de toracotomia de urgência' : 'abaixo de 1.500 mL'}.
            </p>
            {hemo.debitoMlH !== null && (
              <p className={hemo.debitoAtinge ? 'text-atencao' : ''}>
                Subsequente {br(hemo.debitoMlH, 0)} mL/h: {hemo.debitoAtinge ? 'acima de 200 mL/h' : 'não passa de 200 mL/h'}
                {hemo.horasNaJanela === false && ' (o livro fala nas próximas 2 a 4 horas; o período informado está fora disso)'}.
              </p>
            )}
          </>
        )}
      </Bloco>

      <Bloco titulo="Circulação (p. 646–647)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-torn" label="Torniquete aplicado há" unit="min" value={minTorniquete} onChange={setMinTorniquete} step={5} />
          <Resultado rotulo={`Até ${TORNIQUETE_MAX_MIN / 60} h (p. 646)`} valor={torn === null ? '—' : torn >= 0 ? `faltam ${br(torn, 0)} min` : `passou ${br(-torn, 0)} min`} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="tr-cris" label="Cristaloide já infundido" unit="mL" value={cristal} onChange={setCristal} step={250} />
          <Resultado rotulo="Em relação aos 1–3 L (p. 647)" valor={cris ? CRISTALOIDE[cris] : '—'} />
          <Resultado rotulo="Alíquotas restritas (p. 646)" valor={`${faixaBr(ALIQUOTA_TRAUMA_ML, 0)} mL`} />
        </div>
        <p className="text-sm text-muted-foreground">
          O livro: transfusão bem indicada em quem mantém instabilidade após 1–3 L de cristaloide ou com hemorragia moderada/grave persistente (p. 647). ABC score e
          metas de hipotensão permissiva têm telas próprias (transfusão maciça e ressuscitação volêmica).
        </p>
      </Bloco>

      <Bloco titulo="Referências numéricas do capítulo">
        {TRAUMA_REFERENCIAS.map((t) => <Trecho key={t.texto} texto={t.texto} pagina={t.pagina} />)}
      </Bloco>

      <Bloco titulo="Coluna">
        <p className="text-sm font-medium">Restrição de movimento da coluna — trauma contuso no adulto (cap. 48, Tabela 3, p. 664)</p>
        <ul className="list-disc pl-5 text-sm">{RMC_ADULTO.map((x) => <li key={x}>{x}</li>)}</ul>
        <p className="text-sm text-muted-foreground">Em trauma penetrante o livro diz que a restrição da coluna não é indicada (p. 670).</p>
        <p className="text-sm font-medium">Coluna toracolombar ({TORACOLOMBAR.pagina})</p>
        <p className="text-sm">Mecanismo de força importante: {TORACOLOMBAR.mecanismo.join('; ')}.</p>
        <p className="text-sm">Exame da coluna: {TORACOLOMBAR.exame.join('; ')}.</p>
        <p className="text-sm text-muted-foreground">{TORACOLOMBAR.texto}</p>
        <p className="text-sm text-muted-foreground">NEXUS, regra canadense, MGAP e Triage-RTS têm telas próprias.</p>
      </Bloco>

      <Bloco titulo="Errata">
        <ul className="list-disc pl-5 text-sm text-muted-foreground">{ERRATA_TRAUMA.map((e) => <li key={e}>{e}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
