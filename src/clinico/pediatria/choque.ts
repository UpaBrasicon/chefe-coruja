import { fichaP2, type DosePeso, type Faixa } from './fonteP2.ts'

// Choque séptico na criança — livro do ICr, cap. 5 (p. 79–88). Expansão
// volêmica em mL/kg (p. 85), drogas vasoativas da Tabela 2 (p. 87) e metas do
// manejo inicial (p. 83). A tabela de sinais vitais anormais (Tabela 1, p. 87)
// está em sinaisVitais.ts.

export const fichaChoquePediatrico = fichaP2('ped-choque-icr', 'Choque séptico — criança', 'cap. 5, p. 79–88')

export type Volume = {
  bolus: Faixa
  primeiraHora: Faixa
  semSuporte: number
}

/** Bolus de 10 a 20 mL/kg; 40 a 60 mL/kg na primeira hora; sem suporte ventilatório/vasoativo, até 40 mL/kg e só no hipotenso (p. 85). */
export function volumesChoque(pesoKg: number): Volume | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return {
    bolus: [10 * pesoKg, 20 * pesoKg],
    primeiraHora: [40 * pesoKg, 60 * pesoKg],
    semSuporte: 40 * pesoKg,
  }
}

/** Diurese-alvo acima de 1 mL/kg/h (p. 82–83). */
export const diureseAlvo = (pesoKg: number) => (Number.isFinite(pesoKg) && pesoKg > 0 ? pesoKg : null)

export const VASOATIVAS: DosePeso[] = [
  { id: 'epinefrina', nome: 'Epinefrina (Adrenalina® 1 mg/mL)', unidade: 'µg/min', porKg: [0.1, 1], via: 'IV contínua; inotrópico, vasodilatador em dose baixa e vasopressor em dose alta', pagina: 'p. 87 (Tabela 2)',
    nota: 'O texto (p. 86) diz que entre 0,05 e 0,3 µg/kg/min a epinefrina é inotrópico e cronotrópico potente, com queda da resistência vascular periférica.' },
  { id: 'dopamina', nome: 'Dopamina (5 mg/mL)', unidade: 'µg/min', porKg: [2, 20], via: 'IV contínua; quando epinefrina e noradrenalina não estão disponíveis (p. 86)', pagina: 'p. 87 (Tabela 2)' },
  { id: 'dobutamina', nome: 'Dobutamina (Dobutrex® 12,5 mg/mL)', unidade: 'µg/min', porKg: [2, 20], via: 'IV contínua; inotrópico, vasodilatador', pagina: 'p. 87 (Tabela 2)' },
]

export const METAS_CHOQUE: { texto: string; pagina: string }[] = [
  { texto: 'Enchimento capilar < 2 s; pulsos periféricos normais; extremidades quentes; diurese > 1 mL/kg/h; estado mental recuperado; PA normal para a idade; glicemia e cálcio iônico normais.', pagina: 'p. 83' },
  { texto: 'Acesso periférico ou intraósseo em 5 min; volume em até 30 min; antibiótico e inotrópico (se refratário a volume) em até 60 min.', pagina: 'p. 83' },
  { texto: 'Droga vasoativa quando a hipoperfusão persiste após 40 a 60 mL/kg, ou antes se houver sobrecarga; epinefrina e noradrenalina são as preferenciais. Em veia periférica, concentração máxima de 16 µg/mL.', pagina: 'p. 86' },
  { texto: 'Cristaloides balanceados (Ringer lactato, Plasmalyte) preferidos ao soro fisiológico.', pagina: 'p. 86' },
  { texto: 'Glicemia entre 140 e 180 mg/dL (consenso citado); transfusão não indicada com Hb > 7 g/dL no paciente estabilizado.', pagina: 'p. 86–87' },
  { texto: 'Além da primeira hora: índice cardíaco entre 3,3 e 6,0 L/min/m² e ScvO₂ > 70%.', pagina: 'p. 87' },
]

export const ERRATA_CHOQUE: string[] = [
  'p. 87 — índice cardíaco impresso em "L/min/m3"; a unidade de índice cardíaco é por m² de superfície corporal. Mostrado aqui como L/min/m².',
  'p. 81 (Quadro 2, disfunção respiratória) — "FiO2 > 50% para manter saturação acima de 50%": o valor da saturação parece trocado; o critério não é usado nesta ferramenta.',
]
