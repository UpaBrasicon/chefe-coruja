import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP4, type DoseLivro } from './fonteP4.ts'

// Doença falciforme — livro do ICr, cap. 63 (p. 664–674). Crise álgica pela
// intensidade da dor (Figura 1, p. 668), morfina por peso, cetamina em infusão,
// febre (critérios de internação), sequestro esplênico, AVC e síndrome torácica
// aguda. O capítulo cita dipirona, paracetamol e ibuprofeno sem dose: as doses
// vêm do Apêndice (Tabela 2) e estão marcadas assim. Hidratação: o capítulo diz
// que NÃO há recomendação a favor ou contra fluidos na crise álgica (p. 669).
//
// Versão .1 de 28/09/2026: PCDT da Doença Falciforme do MS (Portaria Conjunta
// SAES/SECTICS nº 16, de 1/11/2024), lido no texto — hidroxiureia (critérios e
// dose), profilaxia com penicilina por peso/idade, antibiótico na febre,
// indicações de transfusão simples, sequestro esplênico e síndrome torácica
// aguda (PCDT_FALCIFORME). O livro fica como base; as diferenças aparecem.

export const PCDT_FALCIFORME_2024: Fonte = {
  citacao: 'Ministério da Saúde. Protocolo Clínico e Diretrizes Terapêuticas da Doença Falciforme (Portaria Conjunta SAES/SECTICS nº 16, de 1º de novembro de 2024). Brasília: MS; 2024.',
  url: 'https://www.gov.br/saude/pt-br/assuntos/pcdt/d/doenca-falciforme/view',
  pediatrica: true,
}

const baseFalciforme = fichaP4('ped-falciforme', 'Doença falciforme — crise álgica e complicações agudas', 'cap. 63, p. 664–674; Apêndice, p. 901–906')

export const fichaFalciformePed: Ficha = {
  ...baseFalciforme,
  versao: '2026-09-28.1',
  fontes: [...baseFalciforme.fontes, { ...PCDT_FALCIFORME_2024, citacao: `${PCDT_FALCIFORME_2024.citacao} Critérios (p. 6–8), transfusão (p. 9–10), febre (p. 16 e 19), esquemas (p. 18–19), sequestro e STA (p. 22).` }],
  revisadoEm: '28/09/2026 (PCDT 2024 conferido no texto; livro do ICr mantido como base)',
}

const pos = (x: number) => Number.isFinite(x) && x > 0

/** PCDT 2024 — o que a ferramenta mostra, com página do PDF. */
export const PCDT_FALCIFORME = {
  hidroxiureia: {
    criterios: 'HbSS, HbSβ⁰, HbSβ⁺ grave e HbSD-Punjab a partir de 9 meses; HbSC, HbSD e HbSβ-tal a partir de 2 anos (antes de 2 anos e a partir de 9 meses só com dactilite no 1º ano, Hb < 7 g/dL ou leucócitos > 20.000/mm³, médias fora de evento agudo)',
    inicialMgKgDia: 15,
    incrementoMgKgDia: 5,
    aCadaSemanas: 4,
    maximoMgKgDia: 35,
    apresentacao: 'cápsula de 500 mg; comprimido revestido de 100 mg (fracionável) recomendado até 25 kg',
    exclusao: 'Neutrófilos < 1.500/mm³ (> 1 ano) ou < 1.000 (< 1 ano); Hb < 4,5 g/dL; reticulócitos < 80.000 (se Hb < 8); plaquetas < 80.000; gestação ou sem contracepção',
    pagina: 'p. 6–8 e 18',
  },
  profilaxia: {
    idade: 'crianças de 3 meses a 5 anos',
    penicilinaV: [
      { criterio: '< 3 anos ou até 15 kg', dose: '125 mg (200.000 UI; 2,5 mL da solução de 80.000 UI/mL) a cada 12 h', mg: 125 },
      { criterio: '> 3 anos ou 15–25 kg', dose: '250 mg (400.000 UI; 5 mL) a cada 12 h', mg: 250 },
    ],
    benzatina: [
      { ate: 10, ui: 300_000, criterio: 'até 10 kg' },
      { ate: 20, ui: 600_000, criterio: '10 a 20 kg' },
      { ate: Infinity, ui: 1_200_000, criterio: 'acima de 20 kg' },
    ],
    benzatinaIntervalo: 'a cada 4 semanas',
    alergia: 'estolato de eritromicina VO',
    pagina: 'p. 7, 9 e 18–19',
  },
  febre: {
    alerta: 'Febre é urgência; > 38,2 °C abaixo de 3 anos pode sugerir bacteriemia/sepse; cobrir encapsulados (S. pneumoniae, H. influenzae)',
    penicilinaCristalinaUKgDia: [100_000, 250_000] as [number, number],
    ceftriaxonaMgKgDia: [50, 75] as [number, number],
    ceftriaxonaMaxGDia: 4,
    texto: 'Crianças: penicilina G cristalina 100.000–250.000 U/kg/dia IV 6/6 h; alternativa ceftriaxona 50–75 mg/kg/dia IV 12/12 h (máx. 4 g/dia); STA: associar macrolídeo; meningite: ceftriaxona; suspeita de Mycoplasma: macrolídeo; osteomielite: IV por 4–6 semanas cobrindo S. aureus e Salmonella',
    pagina: 'p. 16 e 19',
  },
  transfusaoSimples: {
    indicacoes: [
      'Crise de aplasia de medula e pancitopenia',
      'Infecção aguda progressiva com queda ≥ 1,5 g/dL da Hb basal ou Hb < 7 g/dL',
      'Sequestro hepático ou esplênico agudo',
      'Gestação',
      'AVC agudo quando a transfusão de troca não estiver disponível',
      'STA com necessidade crescente de O₂ para manter saturação > 95%',
    ],
    formula: 'Volume (mL) = (Ht desejado − Ht inicial) × volemia (peso × 60) / Ht do concentrado (70%)',
    pagina: 'p. 9–10',
  },
  sequestro: {
    expansorMlKg: [10, 15] as [number, number],
    sfMlKg: [40, 100] as [number, number],
    chMlKg: 10,
    hbAlvo: [6, 7] as [number, number],
    texto: 'Acesso venoso; expansor plasmático 10–15 mL/kg (na falta, SF 40–100 mL/kg em 2 h em etapa rápida); repouso, O₂ por máscara, membros elevados; CH 10 mL/kg para Hb 6–7 g/dL, atento à volemia',
    pagina: 'p. 22',
  },
  sta: {
    spo2Uti: 93,
    texto: 'Dor torácica intensa, tosse, febre, sintomas respiratórios, hipoxemia e/ou infiltrado novo: internação de urgência; SpO₂ < 93% indica UTI; hemograma com reticulócitos, hemocultura, saturação e RX (repetir a cada 24 h se normal); antibiótico com macrolídeo',
    pagina: 'p. 16 e 22',
  },
}

/** Hidroxiureia pelo PCDT: dose inicial, incremento e máximo em mg/dia. */
export function hidroxiureiaMgDia(pesoKg: number): { inicial: number; incremento: number; maximo: number; comprimido100: boolean } | null {
  if (!pos(pesoKg)) return null
  const h = PCDT_FALCIFORME.hidroxiureia
  return { inicial: h.inicialMgKgDia * pesoKg, incremento: h.incrementoMgKgDia * pesoKg, maximo: h.maximoMgKgDia * pesoKg, comprimido100: pesoKg <= 25 }
}

/** Benzilpenicilina benzatina profilática por peso (p. 19). */
export function benzatinaProfilaxia(pesoKg: number): { ui: number; criterio: string } | null {
  if (!pos(pesoKg)) return null
  const f = PCDT_FALCIFORME.profilaxia.benzatina.find((b) => pesoKg <= b.ate)!
  return { ui: f.ui, criterio: f.criterio }
}

/** Penicilina V profilática por idade/peso (p. 18–19): < 3 anos ou ≤ 15 kg → 125 mg 12/12 h; senão 250 mg 12/12 h. */
export function penicilinaVProfilaxia(idadeMeses: number, pesoKg: number): { mg: number; criterio: string } | null {
  if (!Number.isFinite(idadeMeses) || idadeMeses < 0 || !pos(pesoKg)) return null
  const [a, b] = PCDT_FALCIFORME.profilaxia.penicilinaV
  return idadeMeses < 36 || pesoKg <= 15 ? { mg: a.mg, criterio: a.criterio } : { mg: b.mg, criterio: b.criterio }
}

/** Antibiótico na febre pelo PCDT (p. 19): penicilina cristalina U/dia e ceftriaxona mg/dia (teto 4 g). */
export function antibioticoFebre(pesoKg: number) {
  if (!pos(pesoKg)) return null
  const f = PCDT_FALCIFORME.febre
  const ceft: [number, number] = [Math.min(f.ceftriaxonaMgKgDia[0] * pesoKg, f.ceftriaxonaMaxGDia * 1000), Math.min(f.ceftriaxonaMgKgDia[1] * pesoKg, f.ceftriaxonaMaxGDia * 1000)]
  return { penicilinaUDia: [f.penicilinaCristalinaUKgDia[0] * pesoKg, f.penicilinaCristalinaUKgDia[1] * pesoKg] as [number, number], ceftriaxonaMgDia: ceft, ceftriaxonaNoTeto: f.ceftriaxonaMgKgDia[1] * pesoKg > f.ceftriaxonaMaxGDia * 1000 }
}

/** Sequestro esplênico pelo PCDT (p. 22): expansor, SF alternativo e CH em mL. */
export function sequestroPcdt(pesoKg: number) {
  if (!pos(pesoKg)) return null
  const s = PCDT_FALCIFORME.sequestro
  return { expansorMl: [s.expansorMlKg[0] * pesoKg, s.expansorMlKg[1] * pesoKg] as [number, number], sfMl: [s.sfMlKg[0] * pesoKg, s.sfMlKg[1] * pesoKg] as [number, number], chMl: s.chMlKg * pesoKg }
}

export const DIFERENCAS_PCDT_FALCIFORME: string[] = [
  'Sequestro esplênico: o livro define pela queda de Hb ≥ 2 g/dL com baço aumentado e manda cristaloide e CH evitando Hb > 8; o PCDT fixa expansor 10–15 mL/kg (ou SF 40–100 mL/kg em 2 h) e CH 10 mL/kg para Hb 6–7 g/dL.',
  'STA: o livro põe O₂ para SpO₂ > 94% e exsanguineotransfusão na grave; o PCDT põe UTI com SpO₂ < 93% e transfusão simples quando a necessidade de O₂ cresce para manter saturação > 95%.',
  'Febre: o livro cita ceftriaxona, cefotaxima ou cefuroxima sem dose; o PCDT traz penicilina cristalina 100–250 mil U/kg/dia ou ceftriaxona 50–75 mg/kg/dia (máx. 4 g).',
  'Hidroxiureia e profilaxia com penicilina não estão no capítulo do livro (são de ambulatório); entram aqui pelo PCDT para conferência na urgência.',
]

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
