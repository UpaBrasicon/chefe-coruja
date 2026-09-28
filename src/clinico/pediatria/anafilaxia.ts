import { DIAS_ANO, DIAS_MES, fichaP2, type DosePeso } from './fonteP2.ts'

// Anafilaxia na criança — livro do ICr, cap. 6 (p. 89–106). Epinefrina IM por
// peso (com a dose fixa por idade como alternativa do próprio livro), segunda e
// terceira linha e refratária, da Tabela 3 (p. 101–102) e do texto (p. 98–101).
// Onde o texto e a Tabela 3 divergem, os dois aparecem.

export const fichaAnafilaxiaPediatrica = fichaP2(
  'ped-anafilaxia-icr',
  'Anafilaxia — criança',
  'cap. 6, p. 97–102',
)

export type LinhaAnafilaxia = 'primeira' | 'segunda' | 'terceira' | 'refrataria'

export const LINHAS_ANAFILAXIA: Record<LinhaAnafilaxia, string> = {
  primeira: 'Primeira linha',
  segunda: 'Segunda linha (junto com a epinefrina)',
  terceira: 'Terceira linha',
  refrataria: 'Hipotensão persistente / anafilaxia refratária',
}

export type DoseAnafilaxia = DosePeso & { linha: LinhaAnafilaxia }

export const DOSES_ANAFILAXIA: DoseAnafilaxia[] = [
  { linha: 'primeira', id: 'epinefrina-im', nome: 'Epinefrina IM', unidade: 'mg', porKg: [0.01, 0.01], maximo: 0.5, porMl: 1, solucao: '1:1.000 (1 mg/mL) — 0,01 mL/kg', via: 'IM no vasto lateral da coxa; repetir a cada 5 a 15 min se a resposta não for plena', pagina: 'p. 98, 101 (Tabela 3)' },
  { linha: 'segunda', id: 'cristaloide', nome: 'Cristaloide (SF)', unidade: 'mL', porKg: [10, 20], via: 'IV em bolo, sob pressão, em alguns minutos; repetir se necessário', pagina: 'p. 100, 101 (Tabela 3)' },
  { linha: 'terceira', id: 'difenidramina-tabela', nome: 'Difenidramina — Tabela 3', unidade: 'mg', porKg: [0.5, 1], via: 'IV 0,5 a 1 mg/kg (ou IM 1 mg/kg)', pagina: 'p. 101 (Tabela 3)',
    nota: 'O texto (p. 100) dá ataque de 1 a 2 mg/kg IV lento, máximo 50 mg; manutenção 5 mg/kg/dia de 6/6 h, máximo 300 mg/dia.' },
  { linha: 'terceira', id: 'difenidramina-texto', nome: 'Difenidramina — texto', unidade: 'mg', porKg: [1, 2], maximo: 50, via: 'IV lentamente (ataque)', pagina: 'p. 100',
    nota: 'A Tabela 3 (p. 101) dá 1 mg/kg IM ou 0,5 a 1 mg/kg IV.' },
  { linha: 'terceira', id: 'metilprednisolona', nome: 'Metilprednisolona', unidade: 'mg', porKg: [1, 2], via: 'IV', pagina: 'p. 101 (Tabela 3)',
    nota: 'O texto (p. 100) dá 1 a 2 mg/kg/dia, de 6/6 h, por 4 dias. O livro não traz máximo.' },
  { linha: 'refrataria', id: 'epinefrina-iv', nome: 'Epinefrina IV em bolus', unidade: 'mg', porKg: [0.01, 0.01], maximo: 0.5, porMl: 0.1, solucao: '1:10.000 — 0,1 mL/kg', via: 'IV a cada 20 min, ou infusão contínua de 0,1 µg/kg/min titulável', pagina: 'p. 100, 102 (Tabela 3)' },
  { linha: 'refrataria', id: 'epinefrina-infusao', nome: 'Epinefrina — infusão contínua', unidade: 'µg/min', porKg: [0.1, 0.1], via: 'IV contínua, titulável', pagina: 'p. 100' },
  { linha: 'refrataria', id: 'norepinefrina', nome: 'Norepinefrina', unidade: 'µg/min', porKg: [0.05, 2], via: 'IV contínua', pagina: 'p. 101, 102 (Tabela 3)' },
  { linha: 'refrataria', id: 'glucagon', nome: 'Glucagon (em uso de betabloqueador)', unidade: 'µg', porKg: [20, 30], maximo: 1000, via: 'IV em 5 min; depois infusão de 5 a 15 µg/min', pagina: 'p. 101, 102 (Tabela 3)' },
  { linha: 'refrataria', id: 'azul-metileno', nome: 'Azul de metileno 1%', unidade: 'mg', porKg: [1, 2], via: 'IV, uma dose (ou 25–50 mg/m², repetível uma vez após 1 h)', pagina: 'p. 102 (Tabela 3)' },
]

/**
 * Fenoterol em nebulização (Tabela 3, p. 101): 1 gota (0,25 mg) a cada 3 kg,
 * máximo 10 gotas, em 3 a 5 mL de SF. Devolve gotas (fração não arredondada) e mg.
 */
export function fenoterolGotas(pesoKg: number): { gotas: number; mg: number; noMaximo: boolean } | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  const bruto = pesoKg / 3
  const gotas = Math.min(bruto, 10)
  return { gotas, mg: gotas * 0.25, noMaximo: bruto > 10 }
}

/** Itens sem cálculo por peso (dose fixa no livro). */
export const FIXOS_ANAFILAXIA: { nome: string; dose: string; pagina: string }[] = [
  { nome: 'Salbutamol aerossol (broncoespasmo)', dose: '100 a 200 µg (1 a 2 jatos) a cada 5 min, máximo 10 jatos', pagina: 'p. 100, 101 (Tabela 3)' },
  { nome: 'Epinefrina inalatória (estridor sem reversão, sugestão da EAACI)', dose: '2 a 5 mL da solução 1 mg/mL, sem atrasar a IM', pagina: 'p. 100' },
  { nome: 'Vasopressina', dose: '10 a 40 UI/dose em bolo', pagina: 'p. 101, 102 (Tabela 3)' },
  { nome: 'Oxigênio', dose: 'suficiente para saturação de cerca de 96%', pagina: 'p. 101 (Tabela 3)' },
  { nome: 'Observação no serviço', dose: '4 a 6 h; 6 a 8 h nos pacientes de risco (asma, bifásica prévia, difícil controle, doses repetidas, sibilância, hipotensão, estridor)', pagina: 'p. 101' },
  { nome: 'Autoinjetor na alta', dose: '0,15 mg para lactentes e crianças de 15 a 30 kg; 0,3 mg acima de 30 kg e adolescentes', pagina: 'p. 101' },
]

/**
 * Dose fixa de epinefrina IM por idade — alternativa do livro (p. 98 e Tabela 3):
 * < 6 meses 0,1–0,15 mg; 6 meses a 6 anos 0,15 mg; 6 a 12 anos 0,3 mg; a partir
 * de 12 anos 0,5 mg. Com 6 e 12 anos completos o livro cabe em duas faixas: as
 * duas doses são devolvidas.
 */
export function epinefrinaDoseFixa(dias: number): { doses: string[]; ambigua: boolean } | null {
  if (!Number.isFinite(dias) || dias < 0) return null
  if (dias < 6 * DIAS_MES) return { doses: ['0,1 a 0,15 mg'], ambigua: false }
  const anos = Math.floor(dias / DIAS_ANO)
  if (anos < 6) return { doses: ['0,15 mg'], ambigua: false }
  if (anos === 6) return { doses: ['0,15 mg', '0,3 mg'], ambigua: true }
  if (anos < 12) return { doses: ['0,3 mg'], ambigua: false }
  if (anos === 12) return { doses: ['0,3 mg', '0,5 mg'], ambigua: true }
  return { doses: ['0,5 mg'], ambigua: false }
}

export const CRITERIOS_ANAFILAXIA: string[] = [
  'Início súbito com pele/mucosa (urticária generalizada, prurido ou eritema, edema de lábio, língua e úvula) E comprometimento respiratório OU queda da PA/sintomas de órgão-alvo.',
  'Dois ou mais, logo após exposição a provável alérgeno: pele/mucosa; respiratório; queda da PA ou sintomas associados; gastrointestinal (cólica, dor, vômito).',
  'Queda da PA após exposição a alérgeno conhecido: na criança, PA sistólica baixa para a idade ou queda maior que 30%.',
]
