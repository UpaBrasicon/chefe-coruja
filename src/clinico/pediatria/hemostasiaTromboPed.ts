import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP4, type DoseLivro } from './fonteP4.ts'
import type { Faixa } from './fonteP2.ts'
import { porPeso, positivoP5, type ItemLivro } from './fonteP5.ts'

// Síndromes hemorrágicas (cap. 64, p. 675–686) e emergências tromboembólicas
// (cap. 65, p. 687–692) na criança — livro do ICr. Reposição de fator por tipo
// de sangramento (Quadro 2), inibidores (Quadro 3), von Willebrand (Quadro 5),
// PTI (Quadro 6), heparina não fracionada com nomograma do TTPa (Quadro 3 do
// cap. 65), enoxaparina (Quadro 4), varfarina (Quadro 5) e rt-PA. A fórmula de
// UI por Δ% do fator (a mesma do cap. 67) é reaproveitada de `hemoterapiaPed.ts`.
// "< 2 meses" (enoxaparina) e "< 1 ano" (HNF) são tratados como valores que
// incluem o RN (convenção do lote P4 para faixas "< 2 meses").

// Versão .1 de 28/09/2026: tratamento do TEV pediátrico pela ASH/ISTH 2025
// (resumo oficial das mudanças e resumo do artigo lidos) ao lado do cap. 65.
// A diretriz não traz dose pediátrica de DOAC no resumo: não é calculada.

export const ASH_ISTH_2025_TEV: Fonte = {
  citacao: 'Monagle P, Azzam M, Bercovitz R, et al. American Society of Hematology/International Society on Thrombosis and Haemostasis 2025 updated guidelines for treatment of venous thromboembolism in pediatric patients. Blood Adv. 2025;9(10):2587–2636 (resumo do artigo e "Summary of changes" oficial da ASH lidos; texto integral não aberto).',
  url: 'https://doi.org/10.1182/bloodadvances.2024015328',
  pediatrica: true,
}

const baseHemostasia = fichaP4('ped-hemostasia-trombose', 'Hemofilia, von Willebrand, PTI e anticoagulação — criança', 'cap. 64, p. 675–686; cap. 65, p. 687–692; cap. 66, p. 720')

export const fichaHemostasiaTromboPed: Ficha = {
  ...baseHemostasia,
  versao: '2026-09-28.1',
  fontes: [...baseHemostasia.fontes, ASH_ISTH_2025_TEV],
  revisadoEm: '28/09/2026 (ASH/ISTH 2025 conferida pelos resumos; livro do ICr mantido como base)',
}

export const ASH_ISTH_ITENS: { numero: string; populacao: string; texto: string; mudanca: string }[] = [
  { numero: '17–20 (novas)', populacao: 'TEV pediátrico', texto: 'Sugere DOAC (rivaroxabana ou dabigatrana) em vez do padrão (HBPM, HNF, antagonista da vitamina K, fondaparinux); qualquer um dos dois, conforme população e disponibilidade', mudanca: 'novo em 2025' },
  { numero: '1', populacao: 'TVP ou TEP sintomáticos', texto: 'Sugere anticoagular', mudanca: 'força rebaixada de forte para condicional' },
  { numero: '3', populacao: 'TEV provocado selecionado (sem TEP, recorrência, trombo oclusivo persistente em 6 semanas, câncer, anticorpo antifosfolípide ou trombofilia maior, ou fator de risco persistente)', texto: 'Sugere 6 semanas em vez de 3 meses', mudanca: 'era "≤ 3 meses" em 2018' },
  { numero: '4', populacao: 'TEV não provocado', texto: 'Sugere 6 a 12 meses em vez de anticoagulação indefinida', mudanca: 'comparador mudou' },
  { numero: '5–6', populacao: 'Trombose de seio venoso cerebral, com ou sem hemorragia por congestão', texto: 'Sugere anticoagular; anticoagulação isolada em vez de trombólise', mudanca: 'força rebaixada sem hemorragia' },
  { numero: '13–14', populacao: 'TVP proximal e TEP com disfunção de VD sem instabilidade', texto: 'Anticoagulação isolada em vez de trombólise seguida de anticoagulação', mudanca: 'direção reescrita, mesma conduta' },
  { numero: '14', populacao: 'TEP com instabilidade hemodinâmica', texto: 'Sugere trombólise seguida de anticoagulação', mudanca: 'sem mudança' },
  { numero: '7–10', populacao: 'Trombo atrial direito e trombose de veia renal no neonato', texto: 'Anticoagular no trombo atrial de alto risco com baixo risco de sangramento; sem alto risco, não anticoagular; veia renal: anticoagular, trombólise só se ameaça à vida', mudanca: 'recomendações desdobradas' },
  { numero: '16', populacao: 'Trombose sintomática de cateter central', texto: 'Retirada imediata ou tardia do cateter (sem acesso necessário ou cateter não funcionante)', mudanca: 'era "tardia" em 2018' },
]

export const DIFERENCAS_TEV_2025: string[] = [
  'O cap. 65 do livro (p. 690–691) traz HNF, enoxaparina, varfarina e rt-PA; a ASH/ISTH 2025 sugere rivaroxabana ou dabigatrana em vez desses no TEV pediátrico — as doses pediátricas de DOAC não constam do resumo lido e não são calculadas aqui.',
  'Duração: o livro põe no mínimo 3 meses na trombose de seio venoso e no TEP (p. 690–691); a ASH/ISTH 2025 sugere 6 semanas no TEV provocado selecionado e 6–12 meses no não provocado.',
  'Trombólise: o livro traz rt-PA sistêmico 0,1–0,6 mg/kg/h por 6 h (CHEST); a ASH/ISTH reserva a trombólise ao TEP com instabilidade hemodinâmica e à trombose de veia renal que ameaça a vida.',
]

// ------------------------------------------------------------ hemofilia (Quadro 2, p. 679–680)

export type ReposicaoFator = { inicial: Faixa; manutencao?: Faixa }
export type LinhaQuadro2 = { id: string; tipo: string; f8: ReposicaoFator; f9: ReposicaoFator; dias: string }

/** Quadro 2: UI/kg (o % entre parênteses é o nível desejado). */
export const QUADRO2: LinhaQuadro2[] = [
  { id: 'hemartrose', tipo: 'Hemartrose', f8: { inicial: [15, 25] }, f9: { inicial: [30, 50] }, dias: '1 a 3, prolongar se necessário' },
  { id: 'muscular', tipo: 'Hematoma muscular de pequena monta', f8: { inicial: [15, 25] }, f9: { inicial: [30, 50] }, dias: '1 a 3, prolongar se necessário' },
  { id: 'iliopsoas', tipo: 'Iliopsoas sem compressão neurológica', f8: { inicial: [25, 40], manutencao: [15, 30] }, f9: { inicial: [50, 80], manutencao: [30, 60] }, dias: 'inicial 1 a 2; manutenção 3 a 5; depois profilaxia' },
  { id: 'iliopsoas-comp', tipo: 'Iliopsoas com compressão neurológica, hematoma volumoso ou retroperitônio', f8: { inicial: [40, 50], manutencao: [15, 30] }, f9: { inicial: [60, 80], manutencao: [30, 60] }, dias: 'inicial 1 a 2; manutenção 3 a 7; depois profilaxia' },
  { id: 'snc', tipo: 'Trauma craniano / sistema nervoso central', f8: { inicial: [40, 50], manutencao: [25, 25] }, f9: { inicial: [60, 80], manutencao: [30, 40] }, dias: 'inicial 1 a 7; manutenção 8 a 21; depois profilaxia' },
  { id: 'cervical', tipo: 'Região cervical', f8: { inicial: [40, 50], manutencao: [15, 25] }, f9: { inicial: [60, 80], manutencao: [30, 40] }, dias: 'inicial 1 a 7; manutenção 8 a 14' },
  { id: 'gi', tipo: 'Gastrointestinal', f8: { inicial: [40, 50], manutencao: [25, 25] }, f9: { inicial: [60, 80], manutencao: [30, 40] }, dias: 'inicial 1 a 7; manutenção 8 a 14' },
  { id: 'mucoso', tipo: 'Sangramento cutâneo ou mucoso (epistaxe, equimoses)', f8: { inicial: [0, 15] }, f9: { inicial: [0, 30] }, dias: 'dose única' },
  { id: 'hematuria', tipo: 'Hematúria (após hidratação vigorosa por 48/72 h)', f8: { inicial: [15, 25] }, f9: { inicial: [30, 50] }, dias: '1 a 3 (hidratação e repouso até controle)' },
  { id: 'cortocontuso', tipo: 'Ferimento cortocontuso', f8: { inicial: [0, 25] }, f9: { inicial: [0, 40] }, dias: 'dose única' },
  { id: 'profundo', tipo: 'Ferimento profundo', f8: { inicial: [15, 25] }, f9: { inicial: [30, 50] }, dias: '1 a 5' },
]

/** UI do Quadro 2 para o peso: UI/kg × peso. */
export function reposicaoQuadro2(l: LinhaQuadro2, fator: 'f8' | 'f9', pesoKg: number): { inicial: Faixa; manutencao: Faixa | null } | null {
  const r = l[fator]
  const inicial = porPeso(r.inicial, pesoKg)
  if (!inicial) return null
  return { inicial, manutencao: r.manutencao ? porPeso(r.manutencao, pesoKg) : null }
}

export const DOSES_HEMOSTASIA: DoseLivro[] = [
  { id: 'ddavp', nome: 'Desmopressina (DDAVP) — hemofilia A leve/moderada; DVW tipos 1 e 2A responsivos', unidade: 'µg', porKgDose: [0.3, 0.3], via: 'EV em 50 mL de SF em 20 a 30 min; repetir a cada 12 a 24 h, até 3 vezes', pagina: 'p. 679, 682',
    nota: 'Dose-teste prévia; contraindicada com convulsões, HAS ou cardiopatia; risco de hiponatremia dilucional.' },
  { id: 'atx-iv', nome: 'Ácido tranexâmico IV — hemofilia', unidade: 'mg', porKgDose: [10, 10], doses: [3, 4], maxDia: 2000, via: 'EV a cada 6 ou 8 h', pagina: 'p. 679' },
  { id: 'atx-vo', nome: 'Ácido tranexâmico VO — hemofilia', unidade: 'mg', porKgDose: [15, 20], doses: [3, 4], maxDia: 2000, via: 'VO a cada 6 ou 8 h', pagina: 'p. 679' },
  { id: 'atx-dvw', nome: 'Ácido tranexâmico — doença de von Willebrand', unidade: 'mg', porKgDose: [10, 20], doses: [3, 4], maxDia: 2000, via: 'a cada 6 ou 8 h; contraindicado se hematúria', pagina: 'p. 682' },
  { id: 'ccpa', nome: 'CCPa — inibidor (Quadro 3)', unidade: 'UI', porKgDose: [75, 100], via: 'a cada 12 h (grave) ou 12–24 h / 24 h conforme o quadro', pagina: 'p. 681' },
  { id: 'rfviia', nome: 'Fator VII recombinante ativado — inibidor (Quadro 3)', unidade: 'µg', porKgDose: [90, 120], via: 'a cada 2 h inicialmente; no moderado de alta resposta, 1 a 4 doses ou dose única de até 270 µg/kg', pagina: 'p. 681' },
]

/** Quadro 5 (p. 682–683): FVIII/FVW em UI/kg na DVW sem resposta à desmopressina ou em cirurgia. */
export const QUADRO5_DVW: { tipo: string; uiKg: Faixa; frequencia: string; objetivo: string }[] = [
  { tipo: 'Cirurgia de grande porte', uiKg: [40, 50], frequencia: 'diária', objetivo: 'pico de FVIII:C 100%, mínimos > 50%, por 5–10 dias' },
  { tipo: 'Cirurgia de pequeno porte', uiKg: [30, 30], frequencia: 'diária ou em dias alternados', objetivo: 'pico 60%, mínimos > 30%, por 2–4 dias' },
  { tipo: 'Exodontia', uiKg: [20, 20], frequencia: 'dose única', objetivo: 'pico 40%' },
  { tipo: 'Sangramento espontâneo', uiKg: [25, 25], frequencia: 'diária', objetivo: 'pico > 50% até cessar (2–4 dias)' },
]

// ------------------------------------------------------------ PTI (Quadro 6, p. 684)

export const DOSES_PTI: DoseLivro[] = [
  { id: 'mp-pti', nome: 'Metilprednisolona IV', unidade: 'mg', porKgDia: [30, 30], doses: [1, 1], maxDia: 1000, via: 'EV por 3 dias', pagina: 'p. 684' },
  { id: 'pred-pti', nome: 'Prednisona oral — esquema longo', unidade: 'mg', porKgDia: [1, 2], via: 'VO por 4 a 21 dias, seguido de desmame', pagina: 'p. 684',
    nota: 'O Quadro 6 não traz máximo; o teto de 60 mg/dia do Apêndice (p. 907) é das indicações asma e síndrome nefrótica e não é aplicado aqui.' },
  { id: 'pred-pti-curto', nome: 'Prednisona oral — esquema curto', unidade: 'mg', porKgDia: [4, 4], via: 'VO por 4 dias', pagina: 'p. 684' },
  { id: 'prednisolona-ash', nome: 'Prednisolona — sangramento mucoso sem risco de morte (ASH 2019)', unidade: 'mg', porKgDia: [2, 4], via: 'VO por 5 a 7 dias', pagina: 'p. 684' },
  { id: 'igiv-pti', nome: 'Imunoglobulina humana IV', unidade: 'g', porKgDose: [0.8, 1], via: '0,8 g/kg dose única ou 1 g/kg/dia, podendo repetir', pagina: 'p. 684' },
  { id: 'anti-d', nome: 'Imunoglobulina anti-D — dose única', unidade: 'µg', porKgDose: [75, 75], via: 'dose única (ou 25 µg/kg/dia por 2 dias seguidos)', pagina: 'p. 684' },
]

// ------------------------------------------------------------ anticoagulação (cap. 65)

/** HNF (Quadro 3, p. 690): ataque 75 UI/kg EV em 10 min. */
export const hnfAtaqueUI = (pesoKg: number) => porPeso([75, 75], pesoKg)

/** HNF manutenção inicial: 28 UI/kg/h (< 1 ano) ou 20 UI/kg/h (> 1 ano). Com 12 meses exatos o quadro não define. */
export function hnfManutencaoUIkgH(idadeMeses: number): number | 'indefinido' | null {
  if (!Number.isFinite(idadeMeses) || idadeMeses < 0) return null
  if (idadeMeses < 12) return 28
  if (idadeMeses === 12) return 'indefinido'
  return 20
}

export type AjusteHnf = { bolusUIkg: number; pausaMin: number; ajustePct: number; repetirTtpa: string }

/** Nomograma do TTPa (Quadro 3): alvo 60–85 s (anti-Xa 0,35–0,70). */
export function ajusteHnf(ttpaSeg: number): AjusteHnf | null {
  if (!positivoP5(ttpaSeg)) return null
  if (ttpaSeg < 50) return { bolusUIkg: 50, pausaMin: 0, ajustePct: 10, repetirTtpa: '4 h' }
  if (ttpaSeg < 60) return { bolusUIkg: 0, pausaMin: 0, ajustePct: 10, repetirTtpa: '4 h' }
  if (ttpaSeg <= 85) return { bolusUIkg: 0, pausaMin: 0, ajustePct: 0, repetirTtpa: '24 h' }
  if (ttpaSeg <= 95) return { bolusUIkg: 0, pausaMin: 0, ajustePct: -10, repetirTtpa: '4 h' }
  if (ttpaSeg <= 120) return { bolusUIkg: 0, pausaMin: 30, ajustePct: -10, repetirTtpa: '4 h' }
  return { bolusUIkg: 0, pausaMin: 60, ajustePct: -15, repetirTtpa: '4 h' }
}

/** Dose profilática de HNF: 10 UI/kg/h (observação do Quadro 3). */
export const HNF_PROFILATICA_UI_KG_H = 10

export const ERRATA_HNF =
  'Quadro 3 do cap. 65 (p. 690, conferido no PDF): "dose profilática de heparina fracionada = 10 U/kg/h" — o quadro é de heparina NÃO fracionada (a de baixo peso molecular está no Quadro 4, em mg/kg SC). Lido como HNF.'

export const NOTA_HEPARINA_ONCO =
  'Cap. 66, Tabela 12 (p. 720), trombose na síndrome da veia cava superior: heparina ataque 75 a 100 U/kg e manutenção 18 a 20 U/kg/h — difere do Quadro 3 do cap. 65 (75 UI/kg; 28 ou 20 UI/kg/h). As duas passagens são mostradas.'

/** Enoxaparina (Quadro 4, p. 690), mg/kg/dose SC. "< 2 m" e "> 2 m": com 2 meses exatos o quadro não define. */
export type Enoxaparina = { terapeutica12h: Faixa; profilatica12h: number; profilatica24h: number }
export function enoxaparinaPorIdade(idadeMeses: number): Enoxaparina | 'indefinido' | null {
  if (!Number.isFinite(idadeMeses) || idadeMeses < 0) return null
  if (idadeMeses < 2) return { terapeutica12h: [1.5, 1.75], profilatica12h: 0.75, profilatica24h: 1.5 }
  if (idadeMeses === 2) return 'indefinido'
  return { terapeutica12h: [1, 1], profilatica12h: 0.5, profilatica24h: 1 }
}

/** Varfarina, dia 1 (Quadro 5, p. 690): INR basal 1,0–1,3 → 0,2 mg/kg VO (máx. 5 mg). */
export function varfarinaDia1Mg(pesoKg: number): number | null {
  return positivoP5(pesoKg) ? Math.min(0.2 * pesoKg, 5) : null
}

/** Ajuste da varfarina pelo INR (Quadro 5, p. 690–691). */
export function ajusteVarfarina(inr: number, dia: 'd2-4' | 'd5+'): string | null {
  if (!positivoP5(inr) || inr < 1.1) return null
  const inicial = dia === 'd2-4'
  if (inr <= (inicial ? 1.3 : 1.4)) return inicial ? 'Repetir a dose inicial' : 'Aumentar 20% da dose'
  if (inr <= 1.9) return inicial ? '50% da dose inicial' : 'Aumentar 10% da dose'
  if (inr <= 3) return inicial ? '50% da dose inicial' : 'Sem alteração'
  if (inr <= 3.5) return inicial ? '25% da dose inicial' : 'Reduzir 10% da dose'
  return inicial ? 'Suspender até INR < 3,5; retornar com redução de 50% da dose' : 'Suspender até INR < 3,5; retornar com redução de 20% da dose'
}

export const NOTA_VARFARINA =
  'Quadro 5: dia 2–4 com INR 1,4–1,9 e 2,0–3,0 → 50% da dose inicial; dia 5 em diante com INR 1,1–1,4 → +20% e 1,5–1,9 → +10%. INR 2,0–3,0 é o alvo terapêutico da maioria dos casos (2,5–3,5 em prótese mitral mecânica). Valores entre as faixas impressas (p. ex., 1,35 nos dias 2–4) caem na faixa seguinte.'

/** rt-PA sistêmico (CHEST, p. 691): 0,1 a 0,6 mg/kg/h por 6 h. */
export const rtpaMgH = (pesoKg: number) => porPeso([0.1, 0.6], pesoKg)

export const REFERENCIAS_HEMOSTASIA: ItemLivro[] = [
  { texto: 'Hemofilia: leve 5–40%, moderada 1–5%, grave < 1% de fator.', pagina: 'p. 678' },
  { texto: 'Dose de fator VIII (UI) = Δ fator × peso ÷ 2; fator IX (UI) = Δ fator × peso; Δ = % desejado − % basal.', pagina: 'p. 679' },
  { texto: 'Cefaleia não habitual ou TCE no hemofílico: repor o fator rapidamente e depois fazer TC.', pagina: 'p. 679' },
  { texto: 'Inibidor de alto título (> 5 UB): agentes de bypass (rFVIIa ou CCPa).', pagina: 'p. 679' },
  { texto: 'PTI: plaquetas < 100.000 isoladas. Tratar (ABHH/AMB 2013) se recém-diagnosticada com < 20.000 e sangramento ativo; sangramento grave: plaquetas + metilprednisolona 30 mg/kg e/ou IgIV 1 g/kg.', pagina: 'p. 682–684' },
  { texto: 'Enoxaparina: anti-Xa terapêutico 0,5–1,0 U/mL e profilático 0,1–0,3 U/mL, colhido 4–6 h após a dose.', pagina: 'p. 690' },
  { texto: 'HNF: TTPa 4 h após o ataque e 4 h após cada ajuste; com TTPa terapêutico, hemograma e TTPa diários.', pagina: 'p. 690' },
  { texto: 'Trombose de seio venoso e TEP: anticoagulação por no mínimo 3 meses; trombose arterial: HNF ou HBPM (CHEST 5 a 7 dias; estudos sugerem mais tempo).', pagina: 'p. 690–691' },
]
