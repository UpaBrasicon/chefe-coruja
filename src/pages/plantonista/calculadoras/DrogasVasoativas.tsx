import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { InfusionDoses, type InfusaoDroga } from '@/components/plantonista/InfusionDoses'

const drogas: InfusaoDroga[] = [
  { nome: 'Noradrenalina simples', faixa: '0,01 – 3,3 µg/kg/min', preparo: '4 mL + 96 mL SG 5% → 1 mL = 40 mcg', conc: 40, doseMin: 0.01, doseMax: 3.3, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Noradrenalina concentrada', faixa: '0,01 – 3,3 µg/kg/min', preparo: '20 mL + 80 mL SG 5% → 1 mL = 200 mcg', conc: 200, doseMin: 0.01, doseMax: 3.3, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Adrenalina', faixa: '0,1 – 2 µg/kg/min', preparo: '10 mL + 90 mL SF 0,9% → 1 mL = 100 mcg', conc: 100, doseMin: 0.1, doseMax: 2, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Vasopressina', faixa: '0,01 – 0,04 UI/min', preparo: '2 mL + 98 mL SG 5% → 1 mL = 0,4 UI', conc: 0.4, doseMin: 0.01, doseMax: 0.04, porPeso: false, porMinuto: true, unidade: 'UI/min' },
  { nome: 'Dobutamina', faixa: '2 – 20 µg/kg/min', preparo: '60 mL + 190 mL SF 0,9% → 1 mL = 3.000 mcg', conc: 3000, doseMin: 2, doseMax: 20, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Milrinona', faixa: '0,375 – 0,75 µg/kg/min', preparo: '20 mL + 80 mL SG 5% → 1 mL = 200 mcg', conc: 200, doseMin: 0.375, doseMax: 0.75, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Levosimendana', faixa: '0,05 – 0,2 µg/kg/min', preparo: '5 mL + 495 mL SG 5% → 1 mL = 25 mcg', conc: 25, doseMin: 0.05, doseMax: 0.2, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Dopamina — dose dopa', faixa: '1 – 5 µg/kg/min', preparo: '50 mL + 200 mL SF 0,9% → 1 mL = 1.000 mcg', conc: 1000, doseMin: 1, doseMax: 5, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Dopamina — dose beta', faixa: '5 – 15 µg/kg/min', preparo: '50 mL + 200 mL SF 0,9% → 1 mL = 1.000 mcg', conc: 1000, doseMin: 5, doseMax: 15, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Dopamina — dose alfa', faixa: '15 – 50 µg/kg/min', preparo: '100 mL + 150 mL SF 0,9% → 1 mL = 2.000 mcg', conc: 2000, doseMin: 15, doseMax: 50, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Nitroprussiato de sódio', faixa: '0,1 – 10 µg/kg/min', preparo: '2 mL + 248 mL SG 5% → 1 mL = 200 mcg', conc: 200, doseMin: 0.1, doseMax: 10, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Nitroglicerina', faixa: '5 – 100 µg/min', preparo: '10 mL + 240 mL SF 0,9% → 1 mL = 200 mcg', conc: 200, doseMin: 5, doseMax: 100, porPeso: false, porMinuto: true, unidade: 'µg/min' },
]

export function DrogasVasoativas() {
  return (
    <ToolLayout
      title="Drogas Vasoativas em Infusão Contínua"
      description="Preparo das diluições e vazão (mL/h) para a dose alvo."
    >
      <InfusionDoses drogas={drogas} />
    </ToolLayout>
  )
}
