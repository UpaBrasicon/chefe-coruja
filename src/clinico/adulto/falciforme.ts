import { completo, escolha, marcadas, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Anemia falciforme — cap. 80 do Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022), p. 1051–1061. Hidratação e analgesia da crise álgica (com a
// Tabela 5), quetamina, síndrome torácica aguda (Tabela 3) e metas. O livro
// não dá dose pediátrica neste capítulo; nada é convertido para criança.

const CAP = 'cap. 80 Anemia falciforme'

export const fichaFalciformeAdulto = fichaAdulto('adulto-falciforme', 'Anemia falciforme — crise álgica e síndrome torácica aguda (adulto)', `${CAP}, p. 1055–1061 (Tabela 5)`)

export type Faixa = [number, number]
const valido = (x: number) => Number.isFinite(x) && x > 0

/** Hidratação na crise álgica: 50 mL/kg em 24 h, SF 0,9% + SG 5% (SF se hipovolêmico) (p. 1056). */
export const HIDRATACAO_FALCIFORME = { mlKg24h: 50, pagina: 'p. 1056' }

export function hidratacaoFalciforme(pesoKg: number): { ml24h: number; mlH: number } | null {
  if (!valido(pesoKg)) return null
  const ml24h = HIDRATACAO_FALCIFORME.mlKg24h * pesoKg
  return { ml24h, mlH: ml24h / 24 }
}

/** Dor grave (8-10): morfina 0,15 mg/kg EV, repetida a cada 20 min com 0,05 mg/kg (Tabela 5, p. 1058). */
export const MORFINA_FALCIFORME = { ataqueMgKg: 0.15, repeticaoMgKg: 0.05, intervaloMin: 20, pagina: 'p. 1058' }

export function morfinaFalciforme(pesoKg: number): { ataqueMg: number; repeticaoMg: number } | null {
  if (!valido(pesoKg)) return null
  return { ataqueMg: MORFINA_FALCIFORME.ataqueMgKg * pesoKg, repeticaoMg: MORFINA_FALCIFORME.repeticaoMgKg * pesoKg }
}

export const ANALGESIA_POR_INTENSIDADE = [
  { faixa: 'Dor leve: 1-4', texto: 'Opioides ou não opioides: codeína 30 mg VO 6/6 h; tramadol 50-100 mg VO 6/6 h; AINE e analgésicos comuns se sem contraindicação', pagina: 'p. 1057' },
  { faixa: 'Dor moderada: 5-7', texto: 'Via endovenosa: tramadol 50-100 mg EV 6/6 h e analgésicos comuns (dipirona EV); sem resposta, opioides de maior potência', pagina: 'p. 1057' },
  { faixa: 'Dor grave: 8-10', texto: 'Opioides de alta potência imediatamente: morfina 0,15 mg/kg EV e 0,05 mg/kg a cada 20 min até controle; porta-opioide ≤ 30 min', pagina: 'p. 1056–1058' },
]

/**
 * Quetamina na dor refratária (p. 1056): 0,25 mg/kg intranasal; 3-5 µg/kg/min EV
 * (o livro escreve "0,1 a 0,3 mg/kg/hora"); bolus 0,3-1 mg/kg EV; máximo 1 mg/kg/h.
 */
export const QUETAMINA_FALCIFORME = { inMgKg: 0.25, infusaoUgKgMin: [3, 5] as Faixa, infusaoLivroMgKgH: [0.1, 0.3] as Faixa, bolusMgKg: [0.3, 1] as Faixa, maxMgKgH: 1, pagina: 'p. 1056' }

export const NOTA_QUETAMINA_FALCIFORME =
  'p. 1056 — 3-5 µg/kg/min equivalem a 0,18-0,3 mg/kg/h, e não 0,1-0,3 mg/kg/h como está entre parênteses. A ferramenta mostra as duas faixas; 0,1 mg/kg/h corresponde a cerca de 1,7 µg/kg/min.'

export type ContaQuetamina = { inMg: number; infusaoMgH: Faixa; infusaoLivroMgH: Faixa; bolusMg: Faixa; maxMgH: number }

export function quetaminaFalciforme(pesoKg: number): ContaQuetamina | null {
  if (!valido(pesoKg)) return null
  const q = QUETAMINA_FALCIFORME
  return {
    inMg: q.inMgKg * pesoKg,
    infusaoMgH: [(q.infusaoUgKgMin[0] * 60 * pesoKg) / 1000, (q.infusaoUgKgMin[1] * 60 * pesoKg) / 1000],
    infusaoLivroMgH: [q.infusaoLivroMgKgH[0] * pesoKg, q.infusaoLivroMgKgH[1] * pesoKg],
    bolusMg: [q.bolusMgKg[0] * pesoKg, q.bolusMgKg[1] * pesoKg],
    maxMgH: q.maxMgKgH * pesoKg,
  }
}

export const STA_ANTIBIOTICOS = [
  { texto: 'Ceftriaxone 2 g EV 1 x/dia + claritromicina 500 mg EV 12/12 h ou azitromicina 500 mg EV 1 x/dia', pagina: 'p. 1057' },
  { texto: 'Na crise hemolítica a cefotaxima pode ser superior ao ceftriaxone (risco de hemólise com o último)', pagina: 'p. 1057' },
  { texto: 'Alternativa: quinolonas respiratórias (levofloxacina ou moxifloxacina); o livro não traz dose', pagina: 'p. 1058' },
]

export const METAS_FALCIFORME = [
  { texto: 'Crise álgica: O2 se SatO2 < 90% ou PaO2 < 60 mmHg; não há indicação de transfusão para a crise álgica', pagina: 'p. 1056' },
  { texto: 'STA: O2 para SatO2 ≥ 95%; broncodilatador 4/4 ou 6/6 h', pagina: 'p. 1058' },
  { texto: 'STA leve: transfusão com alvo de Hb ≥ 10 g/dL', pagina: 'p. 1058' },
  { texto: 'STA moderada a grave (mais de um lobo, O2 ≥ 4 L/min, piora): eritrocitoaférese com alvo HbS < 30% e Hb ≥ 10 g/dL', pagina: 'p. 1058' },
  { texto: 'AVC isquêmico: HbS < 30% e Hb > 8 e < 10 g/dL; AAS 100-300 mg 1 x/dia', pagina: 'p. 1059' },
  { texto: 'Sequestro esplênico (queda de Hb ≥ 2 g/dL): concentrado de hemácias com dose 50% menor que a habitual (o livro não traz a dose habitual)', pagina: 'p. 1055, 1059' },
  { texto: 'Priapismo: < 4 h aspiração + salina + alfa-adrenérgico; > 4 h urologia; > 12 h eritrocitoaférese', pagina: 'p. 1059–1060' },
  { texto: 'Alta: leucócitos > 5.000 e < 30.000/mm³; Hb > 5 g/dL; sem infiltrado, sem sepse, estável', pagina: 'p. 1061' },
]

// Síndrome torácica aguda (Tabela 3, p. 1053)

export const criteriosSta: Escore = {
  ficha: fichaAdulto('adulto-sindrome-toracica-aguda', 'Síndrome torácica aguda — critérios diagnósticos (adulto)', `${CAP}, p. 1052–1053 (Tabela 3)`),
  descricao: 'Infiltrado novo na radiografia e pelo menos 1 dos 7 critérios da Tabela 3 do manual do HC.',
  itens: [
    { tipo: 'escolha', id: 'infiltrado', rotulo: 'Infiltrado novo na radiografia', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }] },
    { tipo: 'marca', id: 'dor', rotulo: 'Dor torácica', pontos: 1 },
    { tipo: 'marca', id: 'febre', rotulo: 'Temperatura > 38,5 °C', pontos: 1 },
    { tipo: 'marca', id: 'taquipneia', rotulo: 'Taquipneia', pontos: 1 },
    { tipo: 'marca', id: 'tosse', rotulo: 'Tosse', pontos: 1 },
    { tipo: 'marca', id: 'sibilancia', rotulo: 'Sibilância', pontos: 1 },
    { tipo: 'marca', id: 'sat', rotulo: 'Diminuição de 2% ou mais na SatO2 em relação ao basal', pontos: 1 },
    { tipo: 'marca', id: 'pao2', rotulo: 'PaO2 < 60 mmHg', pontos: 1 },
  ],
  calcular(r) {
    if (!completo(criteriosSta, r)) return null
    const infiltrado = escolha(criteriosSta, r, 'infiltrado')!.valor === 1
    const criterios = marcadas(criteriosSta, r)
    const preenche = infiltrado && criterios.length >= 1
    return {
      rotulo: 'Síndrome torácica aguda',
      valor: preenche ? 'preenche' : 'não preenche',
      nota: infiltrado ? `${criterios.length} critério(s) além do infiltrado` : 'Sem infiltrado novo: a Tabela 3 não se aplica',
      estado: preenche ? 2 : 0,
      derivados: criterios.length ? [['Critérios marcados', criterios.join('; ')]] : [],
      cuidados: [
        'Mortalidade maior em adultos jovens que em crianças (p. 1053).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
