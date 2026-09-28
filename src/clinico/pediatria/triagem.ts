import { completo, escolha, numero, somar, type Escore, type Respostas } from '../escore.ts'
import { fichaP2 } from './fonteP2.ts'

// Escores de alerta da triagem pediátrica — livro do ICr, cap. 82 (p. 876–886):
// POPS (Tabela 4, p. 882) e PEWS (Figura 2, p. 883). São escores publicados; o
// sistema não sugere nem troca a cor da classificação de risco, que é da
// enfermagem (CLAUDE.md, ADR 0007). As escalas de cinco níveis do capítulo
// (PaedCTAS, Manchester, ESI) não viram ferramenta por isso.
//
// Errata do POPS conferida no PDF (p. 882), tratada sem inventar valor: onde a
// tabela deixa lacuna (ex.: pulso 80 bpm de 2 a 5 anos; SO2 de 95%) ou
// sobrepõe faixas (FR 26–35 ipm de 1 a 2 anos; FR 20 ipm de 13 a 16 anos), o
// parâmetro fica com as duas pontuações possíveis e o total sai como faixa.

// ── POPS ──

export type FaixaPops = '0-1' | '1-2' | '2-5' | '5-12' | '13-16'

export const FAIXAS_POPS: { id: FaixaPops; rotulo: string }[] = [
  { id: '0-1', rotulo: '0 a 1 ano' },
  { id: '1-2', rotulo: '1 a 2 anos' },
  { id: '2-5', rotulo: '2 a 5 anos' },
  { id: '5-12', rotulo: '5 a 12 anos' },
  { id: '13-16', rotulo: '13 a 16 anos' },
]

/** Faixa da tabela: limites inclusivos, ou abertos (< / >) nas pontas. */
export type Banda = { pontos: number; min?: number; max?: number; abaixoDe?: number; acimaDe?: number; rotulo: string }

const lt = (x: number, pontos: number): Banda => ({ pontos, abaixoDe: x, rotulo: `< ${x}` })
const gt = (x: number, pontos: number): Banda => ({ pontos, acimaDe: x, rotulo: `> ${x}` })
const ab = (a: number, b: number, pontos: number): Banda => ({ pontos, min: a, max: b, rotulo: `${a}–${b}` })

export const POPS_VITAIS: Record<FaixaPops, { pulso: Banda[]; fr: Banda[]; temp: Banda[] }> = {
  '0-1': {
    pulso: [lt(90, 2), ab(90, 109, 1), ab(110, 160, 0), ab(161, 180, 1), gt(180, 2)],
    fr: [lt(25, 2), ab(25, 29, 1), ab(30, 40, 0), ab(41, 50, 1), gt(50, 2)],
    temp: [lt(35, 2), ab(35, 35.9, 1), ab(36, 37.5, 0), ab(37.6, 39, 1), gt(39, 2)],
  },
  '1-2': {
    pulso: [lt(90, 2), ab(90, 99, 1), ab(100, 150, 0), ab(151, 170, 1), gt(170, 2)],
    fr: [lt(20, 2), ab(20, 24, 1), ab(25, 35, 0), ab(26, 50, 1), gt(50, 2)],
    temp: [lt(35, 2), ab(35, 35.9, 1), ab(36, 38.4, 0), ab(38.5, 40, 1), gt(40, 2)],
  },
  '2-5': {
    pulso: [lt(80, 2), ab(81, 94, 1), ab(95, 140, 0), ab(141, 160, 1), gt(160, 2)],
    fr: [lt(20, 2), ab(20, 24, 1), ab(25, 30, 0), ab(31, 40, 1), gt(40, 2)],
    temp: [lt(35, 2), ab(35, 35.9, 1), ab(36, 38.4, 0), ab(38.5, 40, 1), gt(40, 2)],
  },
  '5-12': {
    pulso: [lt(70, 2), ab(70, 79, 1), ab(80, 120, 0), ab(121, 150, 1), gt(150, 2)],
    fr: [lt(15, 2), ab(15, 19, 1), ab(20, 25, 0), ab(26, 40, 1), gt(40, 2)],
    temp: [lt(35, 2), ab(35, 35.9, 1), ab(36, 38.4, 0), ab(38.5, 40, 1), gt(40, 2)],
  },
  '13-16': {
    pulso: [lt(50, 2), ab(50, 59, 1), ab(60, 99, 0), ab(100, 110, 1), gt(110, 2)],
    fr: [lt(12, 2), ab(12, 14, 1), ab(15, 20, 0), ab(20, 25, 1), gt(25, 2)],
    temp: [lt(35, 2), ab(35, 35.9, 1), ab(36, 38.4, 0), ab(38.5, 40, 1), gt(40, 2)],
  },
}

const dentro = (b: Banda, v: number) =>
  (b.abaixoDe === undefined || v < b.abaixoDe) &&
  (b.acimaDe === undefined || v > b.acimaDe) &&
  (b.min === undefined || v >= b.min) &&
  (b.max === undefined || v <= b.max)

const baixo = (b: Banda) => b.min ?? (b.acimaDe !== undefined ? b.acimaDe : -Infinity)
const alto = (b: Banda) => b.max ?? (b.abaixoDe !== undefined ? b.abaixoDe : Infinity)

/**
 * Pontuação possível do valor nas faixas do livro. Normalmente uma; duas quando
 * as faixas se sobrepõem, ou quando o valor cai numa lacuna (vizinhas de baixo e de cima).
 */
export function pontosBanda(bandas: Banda[], v: number): { pontos: number[]; errata: boolean } {
  const em = bandas.filter((b) => dentro(b, v))
  if (em.length === 1) return { pontos: [em[0].pontos], errata: false }
  if (em.length > 1) return { pontos: [...new Set(em.map((b) => b.pontos))].sort(), errata: true }
  const antes = bandas.filter((b) => alto(b) < v || (b.abaixoDe !== undefined && b.abaixoDe <= v)).sort((a, b) => alto(b) - alto(a))[0]
  const depois = bandas.filter((b) => baixo(b) > v || (b.acimaDe !== undefined && b.acimaDe >= v)).sort((a, b) => baixo(a) - baixo(b))[0]
  const p = [antes, depois].filter(Boolean).map((b) => b!.pontos)
  return { pontos: [...new Set(p)].sort(), errata: true }
}

const esc = (id: string, rotulo: string, opcoes: [string, number][], ajuda?: string) => ({
  tipo: 'escolha' as const, id, rotulo, ajuda, opcoes: opcoes.map(([r, valor]) => ({ rotulo: r, valor })),
})

export const pops: Escore = {
  ficha: fichaP2('ped-pops-icr', 'POPS — Escore de Observação de Prioridade Pediátrica', 'cap. 82, p. 881–882 (Tabela 4)'),
  descricao: 'Sinais de alerta da Tabela 4 do cap. 82 (Roland et al., 2016): 0 a 2 pontos por parâmetro.',
  itens: [
    esc('faixa', 'Faixa etária da tabela', FAIXAS_POPS.map((f, i) => [f.rotulo, i]), 'Os rótulos são os do livro; entre 12 e 13 anos a tabela não tem linha.'),
    esc('so2', 'SO₂', [['> 95%', 0], ['90–94%', 1], ['< 90%', 2]], 'A tabela não tem faixa para 95% exatos (errata, p. 882).'),
    esc('respiracao', 'Respiração', [['Confortável', 0], ['Sibilos', 1], ['Tiragem leve', 1], ['Estridor', 2], ['Tiragem intensa', 2]]),
    esc('responsividade', 'Responsividade', [['Alerta', 0], ['Responde ao chamado', 1], ['Responde à dor', 2]]),
    esc('impressao', 'Impressão (preocupação de quem avalia)', [['Bem', 0], ['Algo pior', 1], ['Preocupante', 2], ['Doente', 2]]),
    esc('outros', 'Outros (condição de base)', [['Hígido', 0], ['Comorbidades', 1], ['Oncológico', 2], ['Cardiopatia', 2]]),
    { tipo: 'numero', id: 'pulso', rotulo: 'Pulso', unidade: 'bpm', min: 1, max: 350, passo: 1 },
    { tipo: 'numero', id: 'fr', rotulo: 'Frequência respiratória', unidade: 'ipm', min: 1, max: 150, passo: 1 },
    { tipo: 'numero', id: 'temp', rotulo: 'Temperatura', unidade: '°C', min: 25, max: 45, passo: 0.1 },
  ],
  calcular(r: Respostas) {
    if (!completo(pops, r)) return null
    const faixa = FAIXAS_POPS[escolha(pops, r, 'faixa')!.valor].id
    const tab = POPS_VITAIS[faixa]
    const fixos = somar(pops, r, ['so2', 'respiracao', 'responsividade', 'impressao', 'outros'])
    const vit = (['pulso', 'fr', 'temp'] as const).map((k) => ({ k, ...pontosBanda(tab[k], numero(pops, r, k)!) }))
    const min = fixos + vit.reduce((s, x) => s + Math.min(...x.pontos), 0)
    const max = fixos + vit.reduce((s, x) => s + Math.max(...x.pontos), 0)
    const nomes = { pulso: 'Pulso', fr: 'FR', temp: 'Temperatura' }
    const ambiguos = vit.filter((x) => x.errata)
    return {
      rotulo: 'POPS',
      valor: min === max ? String(min) : `${min} a ${max}`,
      unidade: 'pontos',
      nota: 'Referência do livro (p. 881): pontuação total acima de 8 — avaliação imediata na sala de emergência.',
      estado: max > 8 ? 1 : 0,
      derivados: [
        ['Parâmetros observacionais', `${fixos}`],
        ...vit.map((x) => [nomes[x.k], x.pontos.join(' ou ')] as [string, string]),
      ],
      alerta: ambiguos.length
        ? `${ambiguos.map((x) => nomes[x.k]).join(', ')}: o valor cai numa lacuna ou sobreposição da tabela impressa (errata, p. 882); o total mostra as duas pontuações possíveis.`
        : undefined,
      cuidados: [
        'A classificação de risco é da enfermagem; o escore não troca a cor.',
        'O POPS considera a condição de base do paciente e a preocupação de quem avalia.',
      ],
    }
  },
}

// ── PEWS (Figura 2, p. 883) ──

export const pews: Escore = {
  ficha: fichaP2('ped-pews-icr', 'PEWS — Escore de Alerta Precoce Pediátrico', 'cap. 82, p. 882–883 (Figura 2)'),
  descricao: 'Comportamento, cardiovascular e respiratório (0 a 3 cada), +2 em oxigenoterapia — Figura 2 do cap. 82.',
  itens: [
    esc('comportamento', 'Comportamento', [['Normal, ativo', 0], ['Dormindo', 1], ['Irritado', 2], ['Letárgico, confuso', 3]], 'Iniciar o preenchimento pelo pior parâmetro.'),
    esc('cardio', 'Cardiovascular', [['Corado ou TEC 1–2 s', 0], ['Pálido ou TEC 3 s', 1], ['Cinza ou cianótico, ou TEC 4 s, ou taquicardia', 2], ['Cinza ou cianótico e moteado, TEC > 5 s ou bradicardia', 3]]),
    esc('resp', 'Respiratório', [['Normal, sem desconforto', 0], ['FR > 10 ipm acima da basal, desconforto leve, FiO₂ > 30%', 1], ['FR > 20 ipm acima da basal, tiragens, FiO₂ > 30%', 2], ['FR > 5 abaixo da basal, tiragens ou gemência, FiO₂ 50%', 3]],
      'A figura repete "FiO₂ > 30%" nas pontuações 1 e 2 (errata, p. 883).'),
    { tipo: 'marca', id: 'oxigenio', rotulo: 'Em oxigenoterapia', pontos: 2 },
  ],
  calcular(r: Respostas) {
    if (!completo(pews, r)) return null
    const total = somar(pews, r)
    return {
      rotulo: 'PEWS',
      valor: String(total),
      unidade: 'pontos',
      nota: 'O livro não traz ponto de corte para o PEWS.',
      estado: 0,
      derivados: [
        ['Comportamento', String(escolha(pews, r, 'comportamento')!.valor)],
        ['Cardiovascular', String(escolha(pews, r, 'cardio')!.valor)],
        ['Respiratório', String(escolha(pews, r, 'resp')!.valor)],
        ['Oxigenoterapia', r.oxigenio === true ? '+2' : '0'],
      ],
      cuidados: [
        'Divergência no livro: o texto (p. 882) fala em escala de 13 pontos, com pontos adicionais para vômitos persistentes e nebulização contínua, sem dar os valores; a Figura 2 traz só o +2 da oxigenoterapia. Aqui vale a figura.',
        'A classificação de risco é da enfermagem; o escore não troca a cor.',
      ],
    }
  },
}
