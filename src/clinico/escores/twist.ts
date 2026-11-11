import { somar, type Escore, type Item, type Resultado, type Respostas } from '../escore.ts'
import type { Fonte, Ficha } from '../ficha.ts'

// TWIST (Testicular Workup for Ischemia and Suspected Torsion): escores P2/P3,
// item P9; decisão A do RT em 11/11/2026, na pediatria e no adulto até 18 anos
// (diagnóstico em docs/clinico/ESCORES-P2-P3-DIAGNOSTICO.md). Pontos e cortes
// conferidos no resumo do Barbosa 2013 (PMID 23103800): edema testicular 2,
// testículo endurecido 2, reflexo cremastérico ausente 1, náusea ou vômito 1,
// testículo elevado 1; cortes de baixo e alto risco em 2 e 5. As faixas 0–2 e
// 5–7 são as da metanálise de Lewis 2025 (PMID 41261439, resumo). Sem dose
// (ADR 0007: a tela dá a faixa; o que o estudo faz com ela é referência).

const BARBOSA_2013: Fonte = {
  citacao: 'Barbosa JA, Tiseo BC, Barayan GA, et al. Development and initial validation of a scoring system to diagnose testicular torsion in children. J Urol. 2013;189(5):1859–1864 (PMID 23103800, resumo): pontos, cortes de 2 e 5 e ultrassom só no risco intermediário.',
  url: 'https://doi.org/10.1016/j.juro.2012.10.056',
  pediatrica: true,
}
const LEWIS_2025: Fonte = {
  citacao: 'Lewis S, Peeraully R, Ghazy E, et al. A systematic review and meta-analysis to inform the management of children and young people with acute testicular pain. BJU Int. 2026;137(3):417–429 (PMID 41261439, resumo): 10 estudos do TWIST; alto risco (5 a 7) contra baixo risco (0 a 2), sensibilidade 94,2% e especificidade 98%.',
  url: 'https://doi.org/10.1111/bju.70080',
  pediatrica: true,
}
const REVISADO = '11/11/2026 (escores P2/P3, item P9; pontos e cortes conferidos no resumo do Barbosa 2013 e da metanálise de 2025)'

const ITENS: Item[] = [
  { tipo: 'marca', id: 'edema', rotulo: 'Edema testicular', pontos: 2 },
  { tipo: 'marca', id: 'endurecido', rotulo: 'Testículo endurecido', pontos: 2 },
  { tipo: 'marca', id: 'cremaster', rotulo: 'Reflexo cremastérico ausente', pontos: 1 },
  { tipo: 'marca', id: 'nausea', rotulo: 'Náusea ou vômito', pontos: 1 },
  { tipo: 'marca', id: 'elevado', rotulo: 'Testículo elevado (alto na bolsa)', pontos: 1 },
]

function calcularTwist(e: Escore, r: Respostas, cuidadoFaixa: string): Resultado {
  const p = somar(e, r)
  const alto = p >= 5
  const baixo = p <= 2
  return {
    rotulo: 'TWIST',
    valor: `${p}`,
    unidade: 'pontos',
    nota: alto ? 'alto risco (5 a 7)' : baixo ? 'baixo risco (0 a 2)' : 'risco intermediário (3 a 4)',
    estado: alto ? 2 : baixo ? 0 : 1,
    derivados: [
      ['No estudo de derivação', alto ? 'alto risco, torção provável sem esperar o ultrassom (VPP de 100% no corte de 5)' : baixo ? 'baixo risco, sem ultrassom (VPN de 100% no corte de 2)' : 'ultrassom indicado só nesta faixa'],
      ['Desempenho nos extremos (metanálise)', 'sensibilidade 94,2%, especificidade 98%'],
    ],
    alerta: alto ? 'Torção provável: é emergência cirúrgica, e o tempo de dor pesa na viabilidade do testículo.' : undefined,
    cuidados: [
      'O escore vale nos extremos; a faixa intermediária não decide nada.',
      'Baixo risco não dispensa avaliação. Na UPA sem ultrassom, não use o baixo risco para deixar de transferir quando há suspeita clínica.',
      'Derivado em 338 pacientes (Boston); a validação inicial foi retrospectiva.',
      cuidadoFaixa,
    ],
  }
}

const fichaTwist = (id: string, publico: Ficha['publico'], titulo: string): Ficha => ({
  id, titulo, versao: '2026-11-11.1', publico, fontes: [BARBOSA_2013, LEWIS_2025], revisadoEm: REVISADO,
})

export const twistPed: Escore = {
  ficha: fichaTwist('ped-twist', 'pediatrico', 'TWIST — torção testicular (criança)'),
  descricao: 'Escroto agudo: cinco achados, de 0 a 7 pontos. Baixo risco 0 a 2, intermediário 3 a 4, alto 5 a 7.',
  itens: ITENS,
  calcular(r) {
    return calcularTwist(twistPed, r, 'Os estudos vão de 3 meses a 18 anos; o adolescente de 14 anos ou mais usa a tela do adulto.')
  },
}

export const twist: Escore = {
  ficha: fichaTwist('twist', 'adulto', 'TWIST — torção testicular (14 a 18 anos)'),
  descricao: 'Escroto agudo de 14 a 18 anos: cinco achados, de 0 a 7 pontos. Baixo risco 0 a 2, intermediário 3 a 4, alto 5 a 7.',
  itens: ITENS,
  calcular(r) {
    return calcularTwist(twist, r, 'Validado até 18 anos (a metanálise inclui até 25); acima disso, fora da faixa dos estudos.')
  },
}
