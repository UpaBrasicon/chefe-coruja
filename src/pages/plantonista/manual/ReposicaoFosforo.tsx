import { useState } from 'react'

import {
  ESQUEMAS_PO4_IV, FOSFATO_EV, REFERENCIAS_PO4, classificarFosforo, comprimidosFosfato, fichaReposicaoFosforo, fosforoMmolL, reposicaoFosforoIV,
  type EsquemaPO4, type SalFosfato,
} from '@/clinico/adulto/eletrolitos'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Alertas, Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br } from './loteAFormato'

/** Hipofosfatemia no adulto: faixas, reposição IV por mmol/kg com teto e VO (Anexo 5, p. 1501). */
export function ReposicaoFosforo() {
  const [po4, setPo4] = useState(0)
  const [esqId, setEsqId] = useState<EsquemaPO4['id']>('grave-critico')
  const esq = ESQUEMAS_PO4_IV.find((e) => e.id === esqId)!
  const [peso, setPeso] = useState(0)
  const [mmolKg, setMmolKg] = useState(esq.mmolKg[0])
  const [horas, setHoras] = useState(esq.horas[0])
  const [sal, setSal] = useState<SalFosfato>('potassio')
  const [mmolVO, setMmolVO] = useState(0)

  const g = po4 > 0 ? classificarFosforo(po4) : null
  const r = reposicaoFosforoIV({ esquema: esqId, pesoKg: peso, mmolKg, horas, sal })
  const trocarEsquema = (id: EsquemaPO4['id']) => {
    const e = ESQUEMAS_PO4_IV.find((x) => x.id === id)!
    setEsqId(id)
    setMmolKg(e.mmolKg[0])
    setHoras(e.horas[0])
  }

  return (
    <ToolLayout
      title="Hipofosfatemia — reposição de fósforo"
      description="Faixas do Anexo 5, reposição IV em mmol/kg com o teto de cada esquema, volume de fosfato e carga de potássio ou sódio, e comprimidos VO, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaReposicaoFosforo}
    >
      <Bloco titulo="Fósforo sérico" descricao="Hipofosfatemia < 2,5 mg/dL (0,8 mmol/L); moderada 1–2 mg/dL; grave < 1 mg/dL (0,32 mmol/L) (p. 1501).">
        <NumberField id="po4" label="PO4 sérico" unit="mg/dL" value={po4} onChange={setPo4} step={0.1} />
        {g && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Resultado rotulo="Faixa" valor={g === 'sem hipofosfatemia' ? 'PO4 ≥ 2,5 mg/dL: sem hipofosfatemia' : g === 'hipofosfatemia' ? 'Hipofosfatemia (sem gravidade nomeada no livro)' : `Hipofosfatemia ${g}`} />
            <Resultado rotulo="Equivalente" valor={`${br(fosforoMmolL(po4), 2)} mmol/L`} />
          </div>
        )}
        {REFERENCIAS_PO4.map((x) => <Trecho key={x.texto} {...x} />)}
      </Bloco>

      <Bloco titulo="Reposição IV" descricao="Formulação EV: 3 mmol PO4/mL; fosfato de potássio 4,4 mEq K/mL; fosfato de sódio 4 mEq Na/mL. Infusão máxima de 7,5 mmol/hora (p. 1501).">
        <Escolha label="Esquema" value={esqId} onChange={trocarEsquema} opcoes={ESQUEMAS_PO4_IV.map((e) => ({ value: e.id, label: e.nome }))} />
        <Trecho {...esq.referencia} />
        <Escolha label="Sal" value={sal} onChange={setSal} opcoes={[{ value: 'potassio', label: 'Fosfato de potássio' }, { value: 'sodio', label: 'Fosfato de sódio' }]} />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="po4-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <NumberField id="po4-dose" label="Dose" unit="mmol/kg" value={mmolKg} onChange={setMmolKg} step={0.01} />
          <NumberField id="po4-horas" label="Tempo" unit="h" value={horas} onChange={setHoras} />
        </div>
        {r ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Resultado rotulo="Fosfato" valor={`${br(r.mmol)} mmol`} />
              <Resultado rotulo={FOSFATO_EV[sal].nome} valor={`${br(r.ml)} mL`} />
              <Resultado rotulo={`Carga de ${r.cation}`} valor={`${br(r.mEqCation)} mEq`} />
              <Resultado rotulo="Velocidade" valor={`${br(r.mmolH, 2)} mmol/h`} />
            </div>
            <Alertas itens={r.alertas} />
          </>
        ) : <p className="text-muted-foreground">Informe peso, dose e tempo.</p>}
      </Bloco>

      <Bloco titulo="Reposição VO" descricao="Moderada em ventilação espontânea: 30–80 mmol/dia em 2–3 doses. Fosfato de sódio comprimido = 250 mg de PO4 elementar (8 mmol) (p. 1501).">
        <NumberField id="po4-vo" label="Fosfato no dia" unit="mmol" value={mmolVO} onChange={setMmolVO} />
        {mmolVO > 0 && <Resultado rotulo="Comprimidos de 8 mmol" valor={`${br(comprimidosFosfato(mmolVO))} comprimidos/dia`} />}
        {mmolVO > 0 && (mmolVO < 30 || mmolVO > 80) && <Alertas itens={['Fora da faixa de 30–80 mmol/dia do manual.']} />}
      </Bloco>
    </ToolLayout>
  )
}
