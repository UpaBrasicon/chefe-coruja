import { BOLUS, type Bolus } from './bolus.ts'
import { fichaP4, type DoseLivro } from './fonteP4.ts'

// Crise hipertensiva — livro do ICr, cap. 26 (p. 271–277). O livro NÃO traz
// as tabelas de percentis de PA: remete às tabelas da AAP (2017) por sexo,
// idade e percentil de altura (p. 272). Por isso, de 1 a < 13 anos a
// ferramenta pede o p90 e o p95 lidos pelo médico nessas tabelas; ≥ 13 anos os
// cortes são fixos (Tabela 1, p. 272). Abaixo de 1 ano o livro não classifica.
// A PAM não é calculada por fórmula (o livro não traz uma): o médico informa a
// PAM do monitor e a tela mostra a redução de até 25% nas primeiras 8 h (p. 275).

export const fichaCriseHipertensivaPed = fichaP4('ped-crise-hipertensiva', 'Crise hipertensiva — criança', 'cap. 26, p. 271–277; Apêndice, p. 896, 902')

export type Estagio = 'normal' | 'elevada' | 'estagio1' | 'estagio2'

export const ROTULO_ESTAGIO: Record<Estagio, string> = {
  normal: 'PA normal',
  elevada: 'PA elevada',
  estagio1: 'HA estágio 1',
  estagio2: 'HA estágio 2',
}

const ordem: Estagio[] = ['normal', 'elevada', 'estagio1', 'estagio2']
const pior = (a: Estagio, b: Estagio) => (ordem.indexOf(a) >= ordem.indexOf(b) ? a : b)

/** Um valor (sistólico OU diastólico) contra os cortes de 1 a < 13 anos, "o que for menor" (Tabela 1). */
function estagioMenor13(v: number, p90: number, p95: number, fixo: { elevada: number; e1: number; e2: number }): Estagio {
  if (v >= Math.min(p95 + 12, fixo.e2)) return 'estagio2'
  if (v >= Math.min(p95, fixo.e1)) return 'estagio1'
  if (v >= Math.min(p90, fixo.elevada)) return 'elevada'
  return 'normal'
}

/**
 * Tabela 1 (p. 272), 1 a < 13 anos: normal < p90; elevada ≥ p90 a < p95 ou
 * 120 × 80 a < p95 (o que for menor); estágio 1 ≥ p95 a < p95 + 12 ou 130 × 80
 * a 139 × 89 (o que for menor); estágio 2 ≥ p95 + 12 ou ≥ 140 × 90 (o que for
 * menor). Sistólica e diastólica avaliadas em separado; vale a pior.
 */
export function classificarMenor13(pas: number, pad: number, p: { p90s: number; p95s: number; p90d: number; p95d: number }): Estagio | null {
  const v = [pas, pad, p.p90s, p.p95s, p.p90d, p.p95d]
  if (!v.every((x) => Number.isFinite(x) && x > 0)) return null
  const s = estagioMenor13(pas, p.p90s, p.p95s, { elevada: 120, e1: 130, e2: 140 })
  const d = estagioMenor13(pad, p.p90d, p.p95d, { elevada: 80, e1: 80, e2: 90 })
  return pior(s, d)
}

/**
 * Tabela 1 (p. 272), ≥ 13 anos: normal < 120 × 80; elevada 120 × < 80 a
 * 129 × < 80; estágio 1 130 × 80 a 139 × 89; estágio 2 ≥ 140 × 90.
 */
export function classificar13ouMais(pas: number, pad: number): Estagio | null {
  if (![pas, pad].every((x) => Number.isFinite(x) && x > 0)) return null
  if (pas >= 140 || pad >= 90) return 'estagio2'
  if (pas >= 130 || pad >= 80) return 'estagio1'
  if (pas >= 120) return 'elevada'
  return 'normal'
}

/** Aumento > 30 mmHg acima do p95 deve preocupar para lesão de órgão-alvo (p. 272). */
export function acimaDoP95(pas: number, p95s: number): number | null {
  return Number.isFinite(pas) && Number.isFinite(p95s) && p95s > 0 ? pas - p95s : null
}

/** Emergência: decréscimo da PAM ≤ 25% nas primeiras 8 h (p. 275) → PAM mínima ao fim desse período. */
export function pamMinima8h(pamAtual: number): number | null {
  return Number.isFinite(pamAtual) && pamAtual > 0 ? pamAtual * 0.75 : null
}

/** Hidralazina IV/IM: já no Apêndice (bolus.ts), com a nota do capítulo (até 0,4 mg/kg/dose). */
export const HIDRALAZINA_IV: Bolus | undefined = BOLUS.find((b) => b.id === 'hidralazina')

export const DOSES_CRISE_HA: DoseLivro[] = [
  { id: 'hidralazina-vo', nome: 'Hidralazina VO (sintomas menos significativos)', unidade: 'mg', porKgDose: [0.25, 0.25], maxDose: 20, fonteMaximo: 'máx. do Apêndice: 20 mg/dose VO (p. 902)', via: 'VO a cada 6 a 8 h', pagina: 'p. 276 (Tabela 3)',
    errata: 'A Tabela 3 imprime o máximo como "até 2 5 mg/dose" (quebra de linha no meio do número, p. 276): não dá para saber se é 25 mg. O cálculo usa o máximo do Apêndice (20 mg/dose, p. 902).' },
  { id: 'isradipina', nome: 'Isradipina', unidade: 'mg', porKgDose: [0.05, 0.1], maxDose: 5, via: 'VO a cada 6 a 8 h', pagina: 'p. 276 (Tabela 3)',
    nota: 'Apêndice (p. 896): 2 a 3 vezes ao dia, máx. 0,6 mg/kg/dia ou 10 mg/dia.' },
  { id: 'minoxidil', nome: 'Minoxidil', unidade: 'mg', porKgDose: [0.1, 0.2], maxDose: 10, via: 'VO a cada 8 a 12 h', pagina: 'p. 276 (Tabela 3)' },
]

/** Infusões da Tabela 3 (µg/kg/min) — faixa para o peso em µg/min. */
export const INFUSOES_CRISE_HA: { id: string; nome: string; faixa: [number, number]; maximo?: number; pagina: string; nota: string }[] = [
  { id: 'fenoldopam', nome: 'Fenoldopam', faixa: [0.2, 0.5], maximo: 0.8, pagina: 'p. 276 (Tabela 3)', nota: 'Doses altas pioram taquicardia sem reduzir a PA.' },
]

export const ERRATAS_CRISE_HA: string[] = [
  'Esmolol na Tabela 3 (p. 276): "100-500 µg/kg/min". No Apêndice, 100 a 500 µg/kg é o BOLUS (p. 895) e a manutenção é 25 a 100 µg/kg/min, titulando até 500 (p. 895). Não calculado aqui (ferramentas de doses por peso e de infusões).',
  'Nitroprussiato na Tabela 3 (p. 276): "Inicial: 0-3 mcg/kg/min", máx. 10. O Apêndice traz 0,3 a 3 µg/kg/min (p. 896) e o cap. de IC, 0,3 a 4,0 (p. 240). Não calculado aqui (ferramenta de infusões).',
  'Nitroprussiato: o texto fala em cuidado no uso > 24 h (p. 275–276) e a Tabela 3 em > 72 h (p. 276).',
  'Clonidina na Tabela 3 (p. 276): "2-5 mcg/dose até 10 mcg/kg/dose" — a unidade da dose inicial não tem "/kg" e a do máximo tem. Não calculada.',
]

export const REFERENCIAS_CRISE_HA: { texto: string; pagina: string }[] = [
  { texto: 'Aferição: membro superior direito, sentado, após 5 min de repouso; câmara de ar com largura ≥ 40% e comprimento de 80 a 100% da circunferência do braço. Se ≥ p90, mais duas medidas na mesma visita e usar a média.', pagina: 'p. 271' },
  { texto: 'Urgência: elevação aguda sintomática sem lesão de órgão-alvo. Emergência: com lesão de órgão-alvo ou ameaça à vida. Em geral a crise está acima do estágio 2.', pagina: 'p. 272' },
  { texto: 'Emergência: medicação IV em UTI, PAM reduzida no máximo 25% nas primeiras 8 h, depois PA em torno do p95 em 12 a 24/48 h; manter euvolemia. Urgência: redução mais gradual, alvo em torno do p95.', pagina: 'p. 275–277' },
  { texto: 'Nitroprussiato: coadministrar tiossulfato na proporção 1 mg : 10 mg, se uso prolongado ou doença renal/hepática.', pagina: 'p. 276' },
]
