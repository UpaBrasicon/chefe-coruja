import { fichaAdulto } from './fonte.ts'
import { relacaoPF } from './ventilacaoMecanica.ts'

// Oxigenação e insuficiência respiratória aguda no adulto — cap. 27 (IRpA,
// p. 370–386) e cap. 1 (sala de emergência, p. 35–41) do Manual de Medicina
// de Emergência do HCFMUSP (3ª ed., 2022). Contas: gradiente A-a (fórmula do
// livro para ar ambiente em São Paulo) e o esperado pela idade (duas fórmulas),
// relação P/F, incremento de FiO2 no cateter nasal. Leituras: tipo de IRpA,
// tempo de instalação da hipercapnia, cortes de VNI e de VM invasiva. Nada
// escolhe dispositivo nem indica conduta (ADR 0007).
//
// S/F (SpO2/FiO2): o livro não traz — fica fora.

export const fichaOxigenacaoAdulto = fichaAdulto('adulto-oxigenacao-irpa', 'Oxigenação e insuficiência respiratória aguda — adulto', 'cap. 27, p. 370–386; cap. 1, p. 35–41; cap. 37, p. 498')

export type Faixa = [number, number]

const valido = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x) && x > 0

// ---------------------------------------------------------------- gradiente A-a

/**
 * Gradiente A-a em ar ambiente na pressão atmosférica de São Paulo (Tabela 1,
 * p. 371): 130 − (PaO2 + PaCO2). Só vale em ar ambiente: com O2 suplementar o
 * livro não traz fórmula.
 */
export function gradienteAa(pao2: number, paco2: number): number | null {
  if (!valido(pao2) || !valido(paco2)) return null
  return 130 - (pao2 + paco2)
}

/** Valor normal esperado pela idade (Tabela 1, p. 371): 4 + idade/4 ou 2,5 + 0,21 × idade. */
export function aaEsperado(idade: number): { formula1: number; formula2: number } | null {
  if (!valido(idade)) return null
  return { formula1: 4 + idade / 4, formula2: 2.5 + 0.21 * idade }
}

export const AA_ALGUNS_ESTUDOS = 15
export const AA_HIPERCAPNIA = 20

export type LeituraAa = { gradiente: number; esperado: ReturnType<typeof aaEsperado>; notas: string[] }

export function lerGradienteAa(pao2: number, paco2: number, idade?: number): LeituraAa | null {
  const g = gradienteAa(pao2, paco2)
  if (g === null) return null
  const esperado = idade !== undefined ? aaEsperado(idade) : null
  const notas: string[] = []
  if (g < 0) notas.push('Gradiente negativo: a fórmula do livro só vale em ar ambiente, na pressão atmosférica de São Paulo — confira a FiO2 e os valores.')
  if (esperado) {
    const maior = Math.max(esperado.formula1, esperado.formula2)
    const menor = Math.min(esperado.formula1, esperado.formula2)
    notas.push(g > maior ? 'Acima do esperado pelas duas fórmulas de idade (p. 371)' : g <= menor ? 'Dentro do esperado pelas duas fórmulas de idade (p. 371)' : 'Entre os valores das duas fórmulas de idade — acima de uma, dentro da outra (p. 371)')
  }
  notas.push(g < AA_ALGUNS_ESTUDOS ? '< 15: normal no corte que "alguns estudos adotam" (p. 371)' : '≥ 15: acima do corte que "alguns estudos adotam" como normal (< 15, p. 371)')
  if (paco2 > 45) notas.push(g > AA_HIPERCAPNIA ? 'Hipercapnia com gradiente > 20 mmHg: no livro, doença pulmonar intrínseca contribui para a hipercapnia (p. 378)' : 'Hipercapnia com gradiente dentro da normalidade: no livro, hipoventilação global (p. 378)')
  return { gradiente: g, esperado, notas }
}

// ---------------------------------------------------------------- P/F

/** PaO2/FiO2 com FiO2 em % (Tabela 1, p. 371): normal 300–500; < 200 sugere grave hipoxemia. */
export { relacaoPF }

export function lerPF(pf: number): string {
  if (pf < 200) return '< 200 mmHg: "sugere grave hipoxemia" (p. 371); também é o corte gasométrico de VNI (p. 382)'
  if (pf < 300) return 'Entre 200 e 300 mmHg: abaixo da faixa normal do livro (300–500, p. 371)'
  if (pf <= 500) return 'Na faixa normal do livro (300–500 mmHg, p. 371)'
  return 'Acima de 500 mmHg — fora da faixa normal citada (300–500, p. 371)'
}

// ---------------------------------------------------------------- tipo de IRpA

export type LeituraIrpa = { criterios: string[]; tipo: string | null; notas: string[] }

/**
 * p. 370: IRpA em ar ambiente = PaO2 < 60 (ou SpO2 < 90%) ou PaCO2 > 45.
 * p. 373–374: tipo 1 PaO2 < 60 / PaCO2 < 45; tipo 2 PaO2 < 60 / PaCO2 > 45.
 * PaCO2 de exatamente 45 fica sem tipo, como impresso.
 */
export function lerIrpa(g: { pao2?: number; paco2?: number; spo2?: number }): LeituraIrpa {
  const criterios: string[] = []
  const notas: string[] = []
  if (valido(g.pao2) && g.pao2 < 60) criterios.push('PaO2 < 60 mmHg')
  if (valido(g.spo2) && g.spo2 < 90) criterios.push('SpO2 < 90%')
  if (valido(g.paco2) && g.paco2 > 45) criterios.push('PaCO2 > 45 mmHg')
  let tipo: string | null = null
  const hipox = valido(g.pao2) && g.pao2 < 60
  if (hipox && valido(g.paco2)) {
    if (g.paco2 < 45) tipo = 'Tipo 1 — hipoxêmica (PaO2 < 60 / PaCO2 < 45)'
    else if (g.paco2 > 45) tipo = 'Tipo 2 — hipercápnica (PaO2 < 60 / PaCO2 > 45)'
    else notas.push('PaCO2 exatamente 45: o livro define tipo 1 com < 45 e tipo 2 com > 45.')
  }
  if (!hipox && valido(g.paco2) && g.paco2 > 45) notas.push('Hipercapnia (> 45) sem PaO2 < 60: o critério de IRpA da p. 370 é atingido pela PaCO2; o tipo 2 do livro é escrito com PaO2 < 60.')
  notas.push('Critérios em ar ambiente (p. 370). IRpA mista: os dois tipos ao mesmo tempo (p. 374).')
  return { criterios, tipo, notas }
}

/**
 * Tabela 5 (p. 377–378): PaCO2 > 45 e pH < 7,35 → aguda ou crônica agudizada;
 * PaCO2 > 45 e pH próximo do limite inferior (7,33–7,35) → crônica. As duas
 * linhas se sobrepõem entre 7,33 e 7,35 — as duas aparecem.
 */
export function instalacaoHipercapnia(paco2: number, ph: number): string[] {
  if (!valido(paco2) || !valido(ph) || paco2 <= 45) return []
  const r: string[] = []
  if (ph < 7.35) r.push('Aguda ou crônica agudizada (PaCO2 > 45 e pH < 7,35)')
  if (ph >= 7.33 && ph <= 7.35) r.push('Crônica (PaCO2 > 45 e pH 7,33–7,35)')
  return r
}

/** p. 377: rebaixamento do nível de consciência por PaCO2. */
export const RNC_PACO2 = { normais: [75, 80] as Faixa, cronicos: [90, 100] as Faixa, pagina: 'p. 377' }

// ---------------------------------------------------------------- VNI e VM

/** Indicações de VNI (p. 382) e cortes das p. 378 e 383. */
export const VNI = {
  clinicas: ['Dispneia moderada a grave', 'FR 24–30 ipm', 'Sinais de aumento do trabalho respiratório', 'Uso de musculatura acessória'],
  gasometricas: ['PaCO2 > 45 mmHg ou piora em relação ao basal em retentores crônicos', 'Hipoxemia grave (PaO2/FiO2 < 200 mmHg)'],
  maiorEvidencia: ['Exacerbação de DPOC com acidose respiratória (PaCO2 > 45 mmHg ou pH < 7,3)', 'Edema pulmonar cardiogênico', 'IRpA hipoxêmica em imunossuprimidos (benefício questionável)', 'Extubação de alto risco (idade > 65 anos; ICC; DPOC; APACHE II > 12)'],
  contraindicacoes: ['Qualquer situação que indique ventilação mecânica invasiva', 'Inabilidade de cooperar, proteger via aérea ou manejar secreção', 'Rebaixamento do nível de consciência e alto risco de aspiração', 'Iminência de parada cardiorrespiratória', 'Instabilidade hemodinâmica, choque, arritmias graves', 'Lesões faciais que impossibilitem máscaras', 'Hemorragia digestiva alta', 'Anastomose recente de esôfago'],
  modos: ['CPAP: pressão positiva contínua; principalmente correção de hipoxemia', 'BiPAP: IPAP e EPAP; principalmente correção de hipoventilação; cuidado com fluxos altos de O2 em obstruídos'],
  pagina: 'p. 378, 382–386',
}

export type EntradaVni = { fr?: number; paco2?: number; pf?: number; ph?: number; idade?: number; apache?: number }

/** Cortes numéricos de VNI atingidos. O livro diz que não há critério gasométrico específico (p. 378): lista, não decide. */
export function cortesVni(v: EntradaVni): string[] {
  const r: string[] = []
  if (valido(v.fr) && v.fr >= 24 && v.fr <= 30) r.push('FR 24–30 ipm (indicação clínica, p. 382)')
  if (valido(v.fr) && v.fr > 30) r.push('FR > 30 ipm — acima da faixa 24–30 da p. 382 (o livro não dá corte superior para VNI)')
  if (valido(v.paco2) && v.paco2 > 45) r.push('PaCO2 > 45 mmHg (indicação gasométrica, p. 382)')
  if (valido(v.pf) && v.pf < 200) r.push('P/F < 200 mmHg (hipoxemia grave, p. 382)')
  if (valido(v.ph) && v.ph < 7.3) r.push('pH < 7,3 — "acidose respiratória ao menos moderada" com desconforto: candidatos usuais (p. 378); DPOC com acidose (p. 383)')
  if (valido(v.idade) && v.idade > 65) r.push('Idade > 65 anos (extubação de alto risco, p. 383)')
  if (valido(v.apache) && v.apache > 12) r.push('APACHE II > 12 (extubação de alto risco, p. 383)')
  return r
}

/** p. 498 (cap. 37) e p. 41 (cap. 1): indicações de IOT/VM. */
export const INDICACOES_IOT = [
  { texto: 'Hipoxemia (PO2 < 60) com esforço respiratório sem melhora após aporte adequado de O2 (cateter, Venturi, não reinalante e VNI quando indicada)', pagina: 'cap. 37, p. 498' },
  { texto: 'Hipercapnia (PCO2 > 55) em não retentor crônico, principalmente com falência ventilatória e/ou carbonarcose', pagina: 'cap. 37, p. 498' },
  { texto: 'Insuficiência respiratória não reversível pelo tratamento inicial ou hipoxemia persistente apesar de O2 suplementar em fluxo adequado', pagina: 'cap. 1, p. 41' },
]

// ---------------------------------------------------------------- dispositivos de O2

export type Dispositivo = { id: string; nome: string; cap1?: string; cap27?: string; indicacoes27?: string }

/** Tabela 1 do cap. 1 (p. 36–37) e Tabela 7 do cap. 27 (p. 381–382), lado a lado. */
export const DISPOSITIVOS: Dispositivo[] = [
  { id: 'cateter', nome: 'Cateter nasal', cap1: 'Cada L/min aumenta 1–4% a FiO2 (ex.: 6 L/min → 35–44%); > 4 L/min considerar umidificar; > 6 L/min não garantem maior FiO2', cap27: 'Cada L/min aumenta 3–4% a FiO2 (ex.: 3 L/min → 30–34%); baixos fluxos, máximo 5 L/min', indicacoes27: 'Casos menos graves; qualquer IRpA sem shunt predominante' },
  { id: 'simples', nome: 'Máscara facial simples', cap1: '5–10 L/min → FiO2 40–60%; não pode ser < 5 L/min (reinalação de CO2)' },
  { id: 'aerossol', nome: 'Máscara facial de aerossol', cap27: 'Combinações variáveis de O2 e fluxos moderados', indicacoes27: 'Qualquer IRpA hipoxêmica não refratária a O2' },
  { id: 'nao-reinalante', nome: 'Máscara não reinalante / com reservatório', cap1: '15 L/min → FiO2 70%; 40 L/min ("flush rate") → FiO2 100%', cap27: 'Alta concentração (90–100%) e altos fluxos', indicacoes27: 'IRpA hipoxêmica com predomínio de shunt (SDRA, pneumonia grave)' },
  { id: 'venturi', nome: 'Máscara de Venturi', cap1: '12–15 L/min, FiO2 24–50% conforme a válvula; não umidificar', cap27: 'Mistura ar-oxigênio, FiO2 definida (24–50%), altos fluxos', indicacoes27: 'Precisão de titulação de FiO2; exacerbação de DPOC ou IRpA mista' },
  { id: 'cnaf', nome: 'Cateter nasal de alto fluxo', cap1: '40–70 L/min → FiO2 titulável, podendo ser próxima de 100%; aquecido e umidificado', cap27: 'Até 60 L/min em adultos (p. 378–379)' },
  { id: 'bvm', nome: 'Bolsa-valva-máscara', cap1: '40 L/min → FiO2 100% em apneia, 90% em respiração espontânea', cap27: 'Fluxo de O2 a 15 L/min (p. 378)' },
]

/** Faixas por L/min do cateter nasal nos dois capítulos. */
export const CATETER = {
  cap1: { porLitro: [1, 4] as Faixa, exemplo: { lmin: 6, fio2: [35, 44] as Faixa }, semGanhoAcima: 6, umidificarAcima: 4, pagina: 'cap. 1, Tabela 1, p. 36' },
  cap27: { porLitro: [3, 4] as Faixa, exemplo: { lmin: 3, fio2: [30, 34] as Faixa }, maximo: 5, pagina: 'cap. 27, Tabela 7, p. 382' },
}

export type IncrementoCateter = { cap1: Faixa; cap27: Faixa; avisos: string[] }

/**
 * Incremento de FiO2 (em pontos percentuais) que cada capítulo atribui ao
 * fluxo do cateter nasal. O livro não imprime a FiO2 de partida (ar ambiente),
 * então a conta devolve só o incremento; os exemplos impressos aparecem ao
 * lado — e não batem exatamente com a regra linear (ver errata).
 */
export function incrementoCateter(lmin: number): IncrementoCateter | null {
  if (!valido(lmin)) return null
  const avisos: string[] = []
  if (lmin > CATETER.cap27.maximo) avisos.push('Acima de 5 L/min: o cap. 27 escreve "máximo de 5 L/min" (p. 382).')
  if (lmin > CATETER.cap1.semGanhoAcima) avisos.push('Acima de 6 L/min: o cap. 1 escreve que fluxos > 6 L/min não garantem maior FiO2 (p. 36).')
  if (lmin > CATETER.cap1.umidificarAcima) avisos.push('Acima de 4 L/min: o cap. 1 cita considerar umidificar (p. 36).')
  return { cap1: [CATETER.cap1.porLitro[0] * lmin, CATETER.cap1.porLitro[1] * lmin], cap27: [CATETER.cap27.porLitro[0] * lmin, CATETER.cap27.porLitro[1] * lmin], avisos }
}

// ---------------------------------------------------------------- alvos de SatO2

export const ALVOS_SAT = [
  { contexto: 'Paciente crítico no DE', alvo: 'SatO2 94–98%', pagina: 'cap. 1, p. 35' },
  { contexto: 'DPOC conhecida ou risco de insuficiência hipercápnica', alvo: 'SatO2 88–92% (Venturi 24–28% preferida)', pagina: 'cap. 1, p. 36' },
  { contexto: 'Limiar de normalidade (pouco claro)', alvo: 'SatO2 > 95% (DPOC 88–92%); PaO2 > 80 mmHg', pagina: 'cap. 27, Tabela 1, p. 371' },
  { contexto: 'IRpA hipercápnica', alvo: 'SatO2 90–93% (PaO2 60–70 mmHg), ou próximo do basal se este for pior', pagina: 'cap. 27, p. 379' },
  { contexto: 'Sem risco hipercápnico (Figura 5)', alvo: 'SatO2 < 94% em ar ambiente → ramo "iniciar suporte de O2"', pagina: 'cap. 27, Figura 5, p. 385' },
]

/** p. 36: entrada do paciente e o que o texto cita. Não escolhe: lista o que o livro associa a cada situação. */
export const ENTRADA_O2 = [
  { situacao: 'Choque, politrauma ou SatO2 < 85% na admissão', livro: 'Máscara não reinalante', pagina: 'cap. 1, p. 36' },
  { situacao: 'Risco de insuficiência respiratória hipercápnica', livro: 'Evitar altas FiO2; preferência por Venturi 24–28%, alvo 88–92%', pagina: 'cap. 1, p. 36' },
  { situacao: 'Demais pacientes com hipoxemia (SatO2 < 90–94%)', livro: 'Cateter nasal 2–6 L/min ou máscara simples 5–10 L/min', pagina: 'cap. 1, p. 36' },
  { situacao: 'Paciente crítico (Figura 5)', livro: 'Máscara com reservatório 15 L/min ou bolsa-valva-máscara', pagina: 'cap. 27, Figura 5, p. 385' },
  { situacao: 'Risco hipercápnico sem acidose respiratória (Figura 5)', livro: 'FiO2 24–28% — cateter O2 2 L/min', pagina: 'cap. 27, Figura 5, p. 385' },
]

/** Leitura da SatO2 contra os cortes do livro. */
export function lerSat(sat: number, riscoHipercapnia: boolean): string[] {
  if (!valido(sat) || sat > 100) return []
  const r: string[] = []
  if (sat < 85) r.push('SatO2 < 85%: o cap. 1 cita máscara não reinalante na admissão (p. 36)')
  if (sat < 90) r.push('SatO2 < 90%: critério de IRpA em ar ambiente (p. 370) e de gravidade na dispneia (cap. 26, p. 360)')
  if (riscoHipercapnia) {
    r.push(sat < 88 ? 'Abaixo do alvo 88–92% (risco hipercápnico, cap. 1, p. 36)' : sat > 92 ? 'Acima do alvo 88–92% (risco hipercápnico, cap. 1, p. 36)' : 'Dentro do alvo 88–92% (risco hipercápnico, cap. 1, p. 36)')
  } else {
    if (sat < 94) r.push('SatO2 < 94%: Figura 5 (p. 385), ramo "iniciar suporte de O2" em ar ambiente; abaixo do alvo 94–98% do cap. 1')
    else if (sat > 98) r.push('Acima do alvo 94–98% (cap. 1, p. 35)')
    else r.push('Dentro do alvo 94–98% (cap. 1, p. 35)')
  }
  return r
}

// ---------------------------------------------------------------- errata

export const ERRATA_OXIGENACAO = [
  'Cateter nasal: cap. 1 (p. 36) "1–4% por L/min" x cap. 27 (p. 382) "3–4% por L/min". As duas faixas aparecem.',
  'Exemplos impressos não batem exatamente com a regra linear: cap. 27 "3 L/min → 30–34%" (3 × 3–4% = 9–12 pontos) e cap. 1 "6 L/min → 35–44%" (6 × 1–4% = 6–24 pontos). O livro não imprime a FiO2 de partida; a tela mostra só o incremento e os exemplos como impressos.',
  'Máximo do cateter: "máximo de 5 L/min" (cap. 27) x "> 6 L/min não garantem maior FiO2" e cateter "2–6 L/min" (cap. 1).',
  'Não reinalante: 15 L/min → 70% (cap. 1, p. 36) x "90 a 100%" com reservatório (cap. 27, p. 382).',
  'Alto fluxo: 40–70 L/min (cap. 1, p. 37) x "até 60 L/min" em adultos (cap. 27, p. 378).',
  'Alvos de SatO2: 94–98% (cap. 1) x > 95% como limiar de normalidade (cap. 27, p. 371); hipercápnico 88–92% (cap. 1) x 90–93% (cap. 27, p. 379).',
  'Hipoxemia no ABCDE: "oximetria < 88–90%" (cap. 1, p. 40) x SpO2 < 90% (cap. 27, p. 370).',
  'Tabela 5 (p. 377–378): "pH < 7,35" (aguda/crônica agudizada) e "7,33–7,35" (crônica) se sobrepõem — as duas linhas aparecem.',
  'Tipos de IRpA (p. 373–374): tipo 1 PaCO2 < 45 e tipo 2 > 45 — PaCO2 exatamente 45 fica sem tipo.',
  'p. 383: extubação de alto risco "ver detalhes no Capítulo 37" — o cap. 37 não traz esses detalhes.',
  'VNI: "PaCO2 > 45" (cap. 27, p. 382–383) x "pH 7,35 e PaCO2 > 60" na DPOC (cap. 31, Tabela 6, p. 424).',
  'Gradiente A-a: a fórmula 130 − (PaO2 + PaCO2) é para ar ambiente na pressão de São Paulo (p. 371); o livro não traz fórmula com O2 suplementar.',
]
