import { fichaP4, type DoseLivro } from './fonteP4.ts'

// Insuficiência cardíaca — livro do ICr, cap. 22 (p. 230–244). Doses orais da
// Tabela 6 (p. 239–240) por peso; inotrópicos/vasodilatadores da Tabela 6
// aparecem como faixa (as infusões com mL/h estão na ferramenta de infusões),
// com exceção da levosimendana, que só este capítulo traz. Índice
// cardiotorácico (Figura 3, p. 237), classificação de Ross e estágios ISHLT.
// Divergências com o Apêndice ficam como nota.

export const fichaInsuficienciaCardiacaPed = fichaP4('ped-insuficiencia-cardiaca', 'Insuficiência cardíaca — criança', 'cap. 22, p. 230–244; Apêndice, p. 901–903')

export const DOSES_IC_ORAIS: DoseLivro[] = [
  { id: 'furosemida', nome: 'Furosemida', unidade: 'mg', porKgDose: [0.5, 2], via: 'VO, IV ou IM a cada 6 a 24 h', pagina: 'p. 239 (Tabela 6)',
    nota: 'Apêndice (p. 902): VO 1 a 6 mg/kg/dose e IM/IV 1 a 2 mg/kg/dose a cada 6 a 12 h, máx. 6 mg/kg/dose e 200 mg/dose.' },
  { id: 'hctz', nome: 'Hidroclorotiazida', unidade: 'mg', porKgDia: [1, 4], doses: [1, 2], via: 'VO a cada 12 a 24 h', pagina: 'p. 239 (Tabela 6)',
    nota: 'Apêndice (p. 903): edema 1 a 2 mg/kg/dia (máx. 37,5 mg/dia < 2 anos; 100 mg/dia ≥ 2 anos).' },
  { id: 'espironolactona', nome: 'Espironolactona', unidade: 'mg', porKgDia: [1, 3], doses: [2, 2], via: 'VO a cada 12 h', pagina: 'p. 239 (Tabela 6)',
    nota: 'Apêndice (p. 901): dose inicial 1 a 3 mg/kg/dia, máx. 100 mg/dia; pode titular até 4 a 6 mg/kg/dia ou 400 mg/dia.' },
  { id: 'captopril-lactente', nome: 'Captopril — lactentes', unidade: 'mg', porKgDia: [0.3, 2.5], doses: [2, 3], via: 'VO a cada 8 a 12 h; titular gradualmente', pagina: 'p. 239 (Tabela 6)',
    nota: 'O capítulo não define a idade de "lactente". Apêndice (p. 899): lactentes 0,1 a 0,3 mg/kg/dose inicial; crianças 0,3 a 0,5 mg/kg/dose, máx. 12,5 mg na dose inicial.' },
  { id: 'captopril-crianca', nome: 'Captopril — crianças', unidade: 'mg', porKgDia: [0.3, 6], doses: [2, 3], via: 'VO a cada 8 a 12 h; titular gradualmente', pagina: 'p. 239 (Tabela 6)',
    nota: 'Apêndice (p. 899): 0,3 a 0,5 mg/kg/dose, máx. 12,5 mg na dose inicial.' },
  { id: 'enalapril', nome: 'Enalapril', unidade: 'mg', porKgDia: [0.1, 0.5], doses: [2, 2], via: 'VO a cada 12 h', pagina: 'p. 239 (Tabela 6)', nota: 'Apêndice (p. 901): 0,1 mg/kg/dia em 1 ou 2 doses, máx. 0,5 mg/kg/dia.' },
  { id: 'carvedilol', nome: 'Carvedilol', unidade: 'mg', porKgDia: [0.1, 1], doses: [2, 2], via: 'VO em duas doses; titular gradualmente', pagina: 'p. 239 (Tabela 6)', nota: 'Não iniciar na fase aguda, em bradicardia ou bloqueio AV (p. 242).' },
  { id: 'metoprolol', nome: 'Metoprolol', unidade: 'mg', porKgDia: [0.2, 1], via: 'VO; titular gradualmente (a tabela não diz o número de tomadas)', pagina: 'p. 240 (Tabela 6)' },
  { id: 'digoxina-menor2', nome: 'Digoxina — < 2 anos', unidade: 'µg', porKgDia: [10, 10], doses: [2, 2], via: 'VO em 2 tomadas (elixir 50 µg/mL; comp. 0,25 mg)', pagina: 'p. 240 (Tabela 6)',
    nota: 'Uso não rotineiro na IC da criança (p. 242); faixa terapêutica sérica 0,5 a 0,9 ng/mL. Apêndice (p. 901): ataque 30 a 50 e manutenção 20 a 30 µg/kg/dia.' },
  { id: 'digoxina-maior2', nome: 'Digoxina — > 2 anos', unidade: 'µg', porKgDia: [5, 10], doses: [2, 2], via: 'VO em 2 tomadas (elixir 50 µg/mL; comp. 0,25 mg)', pagina: 'p. 240 (Tabela 6)',
    nota: 'Aos 2 anos completos a tabela não define (< 2 e > 2). Apêndice (p. 901): ataque 30 a 50 e manutenção 20 a 30 µg/kg/dia.' },
]

/** Levosimendana (Tabela 6, p. 240): ataque 8 a 12 µg/kg; manutenção 0,1 a 0,2 µg/kg/min. */
export function levosimendana(pesoKg: number): { ataqueMcg: [number, number]; manutencaoMcgMin: [number, number] } | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return { ataqueMcg: [8 * pesoKg, 12 * pesoKg], manutencaoMcgMin: [0.1 * pesoKg, 0.2 * pesoKg] }
}

/** Tabela 6 (p. 240): efeito por faixa de dose — referência (mL/h na ferramenta de infusões). */
export const INOTROPICOS_IC: [string, string][] = [
  ['Adrenalina', 'Efeito beta 0,01–0,3 µg/kg/min; efeito alfa > 0,3 µg/kg/min'],
  ['Noradrenalina', 'Efeito beta 0,05–0,1 µg/kg/min; efeito alfa 0,1–1,0 µg/kg/min'],
  ['Dopamina', 'Dopa 2–5; beta 5–10; alfa > 10 µg/kg/min'],
  ['Dobutamina', 'Efeitos beta e alfa 2–20 µg/kg/min'],
  ['Milrinona', '0,25–0,75 µg/kg/min (ajuste na insuficiência renal; cautela em hipotensos, p. 241)'],
  ['Nitroprussiato', '0,3–4,0 µg/kg/min (uso > 72 h, sobretudo com insuficiência renal: cianeto, p. 241)'],
  ['Prostaglandina E1', '0,01–0,1 µg/kg/min — RN com cardiopatia dependente do canal, mesmo antes do ecocardiograma; monitorar apneia, hipertermia e retenção hídrica (p. 241)'],
]

/**
 * Índice cardiotorácico = (A + B) / C (Figura 3, p. 237). Sugere cardiomegalia
 * se > 0,6 no neonato e > 0,55 na criança.
 */
export function indiceCardiotoracico(a: number, b: number, c: number, neonato: boolean): { ict: number; limite: number; acima: boolean } | null {
  if (![a, b, c].every((x) => Number.isFinite(x) && x > 0)) return null
  const ict = (a + b) / c
  const limite = neonato ? 0.6 : 0.55
  return { ict, limite, acima: ict > limite }
}

export const ERRATA_ICT =
  'A legenda da Figura 3 (p. 237) escreve "índice cardiotorácico = A + B/C". Lida ao pé da letra, a conta dá valores absurdos (com as medidas da própria figura, A 58,7 mm, B 100,8 mm e C 288,8 mm, daria ≈ 59); a soma A + B dividida por C dá 0,55. A ferramenta usa (A + B) / C.'

/** Tabela 2 (p. 232): classificação funcional de Ross — referência. */
export const ROSS: [string, string][] = [
  ['I', 'Assintomático'],
  ['II', 'Lactentes com taquipneia e sudorese leves às mamadas, sem déficit de crescimento; crianças maiores com dispneia ao exercício moderado'],
  ['III', 'Lactentes com taquipneia e sudorese acentuadas às mamadas, com déficit de crescimento; crianças maiores com dispneia ao exercício leve ou mínimo'],
  ['IV', 'Taquipneia, sudorese e desconforto respiratório ao repouso'],
]

/** Tabela 3 (p. 232): estágios ISHLT — referência. */
export const ISHLT: [string, string][] = [
  ['A', 'Sob risco de IC (cardiopatia congênita, cardiotóxicos, história familiar de cardiomiopatia)'],
  ['B', 'Estrutura ou função cardíaca anormal, sem sintomas de IC'],
  ['C', 'Estrutura ou função anormal com sintomas de IC atuais ou passados'],
  ['D', 'Estrutura ou função anormal com infusão contínua de inotrópico ou PGE1, ventilação mecânica e/ou assistência circulatória'],
]

export const REFERENCIAS_IC: { texto: string; pagina: string }[] = [
  { texto: 'Disfunção sistólica do VE na criança: fração de encurtamento < 25% e/ou fração de ejeção < 55%.', pagina: 'p. 237' },
  { texto: 'iECA: iniciar em dose baixa e aumentar em 3 a 10 dias (internados); captopril costuma ser 1ª escolha no lactente e enalapril nos > 2 anos; creatinina 50% acima do basal → reavaliar redução ou suspensão.', pagina: 'p. 241–242' },
  { texto: 'Ressuscitação volêmica com cautela e individualizada: indiscriminada pode piorar a criança com IC. Restrição hídrica pode ser necessária.', pagina: 'p. 238, 240' },
]
