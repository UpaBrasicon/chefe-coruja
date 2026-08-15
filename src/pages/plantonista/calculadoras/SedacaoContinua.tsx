import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { InfusionDoses, type InfusaoDroga } from '@/components/plantonista/InfusionDoses'

const drogas: InfusaoDroga[] = [
  { nome: 'Fentanil', faixa: '0,3 – 3 µg/kg/h', preparo: '50 mL + 50 mL SF 0,9% → 1 mL = 25 µg', conc: 25, doseMin: 0.3, doseMax: 3, porPeso: true, porMinuto: false, unidade: 'µg/kg/h' },
  { nome: 'Midazolam', faixa: '0,25 – 5 µg/kg/min', preparo: '20 mL + 80 mL SF 0,9% → 1 mL = 1 mg', conc: 1000, doseMin: 0.25, doseMax: 5, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Cetamina', faixa: '0,5 – 1 mg/kg/h', preparo: '10 mL + 240 mL SF 0,9% → 1 mL = 2 mg', conc: 2, doseMin: 0.5, doseMax: 1, porPeso: true, porMinuto: false, unidade: 'mg/kg/h' },
  { nome: 'Dexmedetomidina', faixa: '0,2 – 1,5 µg/kg/h', preparo: '2 mL + 48 mL SF 0,9% → 1 mL = 4 µg', conc: 4, doseMin: 0.2, doseMax: 1.5, porPeso: true, porMinuto: false, unidade: 'µg/kg/h' },
  { nome: 'Propofol 1%', faixa: '0,5 – 5 mg/kg/h', preparo: 'Propofol 1% → 1 mL = 10 mg', conc: 10, doseMin: 0.5, doseMax: 5, porPeso: true, porMinuto: false, unidade: 'mg/kg/h' },
  { nome: 'Propofol 2%', faixa: '0,5 – 5 mg/kg/h', preparo: 'Propofol 2% → 1 mL = 20 mg', conc: 20, doseMin: 0.5, doseMax: 5, porPeso: true, porMinuto: false, unidade: 'mg/kg/h' },
]

export function SedacaoContinua() {
  return (
    <ToolLayout
      title="Sedação Contínua"
      description="Doses de analgosedação em infusão contínua. Referência: Falcão LFR, Macedo GL. Farmacologia Aplicada em Medicina Intensiva."
    >
      <InfusionDoses drogas={drogas} />
    </ToolLayout>
  )
}
