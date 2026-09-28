import { fichaP4, type DoseLivro } from './fonteP4.ts'

// Doença falciforme — livro do ICr, cap. 63 (p. 664–674). Crise álgica pela
// intensidade da dor (Figura 1, p. 668), morfina por peso, cetamina em infusão,
// febre (critérios de internação), sequestro esplênico, AVC e síndrome torácica
// aguda. O capítulo cita dipirona, paracetamol e ibuprofeno sem dose: as doses
// vêm do Apêndice (Tabela 2) e estão marcadas assim. Hidratação: o capítulo diz
// que NÃO há recomendação a favor ou contra fluidos na crise álgica (p. 669).

export const fichaFalciformePed = fichaP4('ped-falciforme', 'Doença falciforme — crise álgica e complicações agudas', 'cap. 63, p. 664–674; Apêndice, p. 901–906')

export type Intensidade = 'leve' | 'moderada' | 'intensa'

/** Figura 1 (p. 668): leve 1–3, moderada 4–6, intensa 7–10 na escala de dor. */
export function intensidadeDor(nota: number): Intensidade | null {
  if (!Number.isInteger(nota) || nota < 1 || nota > 10) return null
  return nota <= 3 ? 'leve' : nota <= 6 ? 'moderada' : 'intensa'
}

export const CONDUTA_FIGURA1: Record<Intensidade, string> = {
  leve: 'Dipirona, paracetamol, ibuprofeno; reavaliar para alta.',
  moderada: 'Morfina EV 0,05 mg/kg; se não houver melhora em 20–30 min: repetir morfina 0,05 mg/kg, manter de horário (4/4 h), associar dipirona de horário, AINH se não contraindicado, estimular hidratação VO.',
  intensa: 'Morfina EV 0,05 mg/kg; reavaliar em 20–30 min, com as mesmas medidas da dor moderada se não houver melhora.',
}

export const DOSES_CRISE_ALGICA: DoseLivro[] = [
  { id: 'morfina-figura', nome: 'Morfina EV — Figura 1', unidade: 'mg', porKgDose: [0.05, 0.05], via: 'EV; reavaliar em 20 a 30 min; pode repetir; de horário 4/4 h', pagina: 'p. 668 (Figura 1)' },
  { id: 'morfina-texto', nome: 'Morfina parenteral — texto (crianças)', unidade: 'mg', porKgDose: [0.05, 0.15], via: 'EV ou SC (evitar IM), em intervalos preestabelecidos; reavaliar a cada 15 a 30 min', pagina: 'p. 668',
    nota: 'Adolescentes: 5 a 10 mg por dose (p. 668). O capítulo não define a idade de "adolescente".' },
  { id: 'dipirona', nome: 'Dipirona (dose do Apêndice)', unidade: 'mg', porKgDose: [10, 25], doses: [4, 4], maxDose: 1000, via: 'VO/IV/VR a cada 6 h; evitar em < 3 meses e < 5 kg', pagina: 'Apêndice, p. 901', nota: 'O capítulo cita a dipirona de horário sem dose (p. 668).' },
  { id: 'paracetamol', nome: 'Paracetamol (dose do Apêndice)', unidade: 'mg', porKgDose: [10, 15], doses: [4, 6], maxDia: 4000, via: 'VO 4 a 6 vezes ao dia; máx. 75 mg/kg/dia ou 4 g/dia', pagina: 'Apêndice, p. 906', nota: 'O teto por dia aplicado é o de 4 g; confira também 75 mg/kg/dia.' },
  { id: 'ibuprofeno', nome: 'Ibuprofeno (dose do Apêndice)', unidade: 'mg', porKgDose: [4, 10], doses: [3, 4], maxDose: 400, via: 'VO a cada 6 a 8 h; curto período (5 a 7 dias) se não contraindicado', pagina: 'Apêndice, p. 903', nota: 'O capítulo lista os AINE sem dose; cautela com insuficiência renal, discrasia e doença péptica (p. 668).' },
]

/** Cetamina subanestésica em refratários (centros com experiência): 0,1 a 0,3 mg/kg/h (p. 668). */
export function cetaminaMgH(pesoKg: number): [number, number] | null {
  return Number.isFinite(pesoKg) && pesoKg > 0 ? [0.1 * pesoKg, 0.3 * pesoKg] : null
}

/** Paracetamol: teto de 75 mg/kg/dia do Apêndice, para comparar com os 4 g/dia. */
export function paracetamolTetoDiaMg(pesoKg: number): number | null {
  return Number.isFinite(pesoKg) && pesoKg > 0 ? Math.min(75 * pesoKg, 4000) : null
}

/** Sequestro esplênico: queda de Hb ≥ 2 g/dL em relação ao basal (p. 670). */
export function quedaHb(basal: number, atual: number): { queda: number; criterio: boolean } | null {
  if (![basal, atual].every((x) => Number.isFinite(x) && x > 0)) return null
  const queda = basal - atual
  return { queda, criterio: queda >= 2 }
}

/** Febre ≥ 38,5 °C (p. 667): situações de internação listadas no livro. */
export const INTERNACAO_FEBRE: string[] = [
  'Toxemia',
  'Infecção do SNC',
  'Osteomielite ou artrite séptica',
  'Criança menor de 1 ano',
  'Internação prévia por bacteriemia no último ano',
  'Temperatura > 39,5 °C',
  'Outras complicações associadas (síndrome torácica aguda, crise álgica)',
  'Pais com dificuldade de retornar ao serviço',
]

export const REFERENCIAS_FALCIFORME: { rotulo: string; texto: string; pagina: string }[] = [
  { rotulo: 'Febre', texto: 'T ≥ 38,5 °C: exames com culturas e antibiótico parenteral de amplo espectro precoce (ceftriaxona, cefotaxima ou cefuroxima). Osteomielite: cobrir Salmonella e S. aureus por 4 a 6 semanas.', pagina: 'p. 666–667' },
  { rotulo: 'Crise álgica', texto: 'Avaliar e medicar em até 1 h da chegada; reavaliar a cada 30 a 60 min. Evitar meperidina; codeína e tramadol contraindicados pelo FDA em < 12 anos. Transfusão só se outra condição indicar.', pagina: 'p. 668–669' },
  { rotulo: 'Síndrome torácica aguda', texto: 'Internação; O₂ para SpO₂ > 94%; cefalosporina + macrolídeo; grave: exsanguineotransfusão; moderada: simples ou exsanguineo.', pagina: 'p. 669–670' },
  { rotulo: 'Sequestro esplênico', texto: 'Queda de Hb ≥ 2 g/dL do basal com baço aumentado; cristaloide e CH na urgência quando sintomática; evitar Hb > 8 g/dL (hiperviscosidade).', pagina: 'p. 670' },
  { rotulo: 'AVC / AIT', texto: 'Transfusão em até 2 h dos sintomas; simples se exsanguineo não for possível em 2 h e Hb ≤ 8,5 g/dL. Prevenção secundária: HbS < 30% e Hb > 9 g/dL. Sem indicação de alteplase.', pagina: 'p. 671' },
  { rotulo: 'Crise aplástica', texto: 'Hb 3 a 6 g/dL com reticulócitos baixos (parvovírus B19); internação com precaução de gotículas; CH se anemia sintomática.', pagina: 'p. 672' },
  { rotulo: 'Priapismo', texto: '> 2 h: serviço de emergência e avaliação urológica; > 4 h ou refratário: urologista (irrigação com α-adrenérgico). Transfusão e exsanguineo não devem ser usadas na fase aguda.', pagina: 'p. 672' },
]
