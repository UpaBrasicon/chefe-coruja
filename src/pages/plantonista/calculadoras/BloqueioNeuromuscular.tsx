import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { InfusionDoses, type InfusaoDroga } from '@/components/plantonista/InfusionDoses'

const drogas: InfusaoDroga[] = [
  { nome: 'Atracúrio', faixa: '5 – 10 µg/kg/min', preparo: '10 mL + 90 mL (SF 0,9% ou SG 5%) → 1 mL = 1 mg', conc: 1000, doseMin: 5, doseMax: 10, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Cisatracúrio', faixa: '1 – 3 µg/kg/min', preparo: '50 mL + 50 mL SF 0,9% → 1 mL = 1 mg', conc: 1000, doseMin: 1, doseMax: 3, porPeso: true, porMinuto: true, unidade: 'µg/kg/min' },
  { nome: 'Rocurônio', faixa: '0,3 – 0,6 mg/kg/h', preparo: '10 mL + 90 mL SF 0,9% → 1 mL = 1 mg', conc: 1, doseMin: 0.3, doseMax: 0.6, porPeso: true, porMinuto: false, unidade: 'mg/kg/h' },
  { nome: 'Pancurônio', faixa: '0,02 – 0,07 mg/kg/h', preparo: '20 mL + 80 mL SF 0,9% → 1 mL = 0,4 mg', conc: 0.4, doseMin: 0.02, doseMax: 0.07, porPeso: true, porMinuto: false, unidade: 'mg/kg/h' },
]

export function BloqueioNeuromuscular() {
  return (
    <ToolLayout
      title="Bloqueio Neuromuscular Contínuo"
      description="Doses de bloqueadores neuromusculares em infusão contínua (BI)."
    >
      <InfusionDoses drogas={drogas} />
    </ToolLayout>
  )
}
