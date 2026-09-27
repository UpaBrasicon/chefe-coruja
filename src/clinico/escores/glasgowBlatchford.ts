import { completo, escolha, numero, somar, type Escore } from '../escore.ts'

// Glasgow-Blatchford. Porte do protótipo (gastro/Glasgow-Blatchford, construído
// em 29/08/2026). Entrada de ureia em mg/dL, como no laudo brasileiro, com a
// conversão para mmol/L à vista (÷ 6,006). Saíram (ADR 0007) as notas de
// alta/internação/endoscopia, a linha "Limiar de alta vigente" e os cuidados de
// alta e de endoscopia urgente: ficam os pontos e as faixas.

const UREIA_MGDL_PARA_MMOL = 6.006
const ns = (pontos: number) => [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: pontos }]
const fmt = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',')
const FX_U = 'menos de 6,5 = 0 · 6,5 a 7,9 = 2 · 8 a 9,9 = 3 · 10 a 24,9 = 4 · 25 ou mais = 6 mmol/L'
const FX_H_M = '13 g/dL ou mais = 0 · 12 a 12,9 = 1 · 10 a 11,9 = 3 · menos de 10 = 6'
const FX_H_F = '12 g/dL ou mais = 0 · 10 a 11,9 = 1 · menos de 10 = 6'
const FX_P = '110 mmHg ou mais = 0 · 100 a 109 = 1 · 90 a 99 = 2 · menos de 90 = 3'
const CLINICOS = ['melena', 'sincope', 'hepatica', 'ic']

export const glasgowBlatchford: Escore = {
  ficha: {
    id: 'glasgow-blatchford',
    titulo: 'Glasgow-Blatchford — hemorragia digestiva alta',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Blatchford O, Murray WR, Blatchford M. A risk score to predict need for treatment for upper-gastrointestinal haemorrhage. Lancet. 2000;356(9238):1318–1321.', url: 'https://doi.org/10.1016/S0140-6736(00)02816-6' },
      { citacao: 'Laine L, Barkun AN, Saltzman JR, Martel M, Leontiadis GI. ACG Clinical Guideline: Upper Gastrointestinal and Ulcer Bleeding. Am J Gastroenterol. 2021;116(5):899–917.', url: 'https://doi.org/10.14309/ajg.0000000000001245' },
      { citacao: 'Stanley AJ, Laine L, Dalton HR, et al. Comparison of risk scoring systems for patients presenting with upper gastrointestinal bleeding. BMJ. 2017;356:i6432.', url: 'https://doi.org/10.1136/bmj.i6432' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Risco de necessidade de intervenção na hemorragia digestiva alta, com dados anteriores à endoscopia',
  itens: [
    { tipo: 'escolha', id: 'sexo', rotulo: 'Sexo', opcoes: [{ rotulo: 'Masculino', valor: 0 }, { rotulo: 'Feminino', valor: 1 }] },
    { tipo: 'numero', id: 'ureia', rotulo: 'Ureia', unidade: 'mg/dL', min: 1, max: 600, passo: 1, ajuda: 'Como vem no laudo brasileiro. A conversão para mmol/L aparece no resultado.' },
    { tipo: 'numero', id: 'hb', rotulo: 'Hemoglobina', unidade: 'g/dL', min: 1, max: 25, passo: 0.1 },
    { tipo: 'numero', id: 'pas', rotulo: 'Pressão sistólica', unidade: 'mmHg', min: 20, max: 300, passo: 1 },
    { tipo: 'numero', id: 'fc', rotulo: 'Frequência cardíaca', unidade: 'bpm', min: 20, max: 300, passo: 1 },
    { tipo: 'escolha', id: 'melena', rotulo: 'Melena', opcoes: ns(1) },
    { tipo: 'escolha', id: 'sincope', rotulo: 'Síncope', opcoes: ns(2) },
    { tipo: 'escolha', id: 'hepatica', rotulo: 'Doença hepática', opcoes: ns(2) },
    { tipo: 'escolha', id: 'ic', rotulo: 'Insuficiência cardíaca', opcoes: ns(2) },
  ],
  calcular(r) {
    if (!completo(glasgowBlatchford, r)) return null
    const ureia = numero(glasgowBlatchford, r, 'ureia')!
    const hb = numero(glasgowBlatchford, r, 'hb')!
    const pas = numero(glasgowBlatchford, r, 'pas')!
    const fc = numero(glasgowBlatchford, r, 'fc')!
    const homem = escolha(glasgowBlatchford, r, 'sexo')!.valor === 0
    const mmol = ureia / UREIA_MGDL_PARA_MMOL
    const pU = mmol >= 25 ? 6 : mmol >= 10 ? 4 : mmol >= 8 ? 3 : mmol >= 6.5 ? 2 : 0
    const pH = homem
      ? (hb < 10 ? 6 : hb < 12 ? 3 : hb < 13 ? 1 : 0)
      : (hb < 10 ? 6 : hb < 12 ? 1 : 0)
    const pP = pas < 90 ? 3 : pas < 100 ? 2 : pas < 110 ? 1 : 0
    const pF = fc >= 100 ? 1 : 0
    const pC = somar(glasgowBlatchford, r, CLINICOS)
    const total = pU + pH + pP + pF + pC
    const banda = total >= 6 ? 2 : total >= 2 ? 1 : 0
    return {
      rotulo: 'Blatchford',
      valor: String(total),
      unidade: 'de 23',
      nota: ['0 ou 1 ponto — baixo risco', 'risco intermediário', 'alto risco de intervenção'][banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Faixa', ['0 a 1 ponto', '2 a 5 pontos', '6 pontos ou mais'][banda]],
        ['Ureia convertida', fmt(mmol) + ' mmol/L (' + fmt(ureia) + ' mg/dL ÷ 6,006)'],
        ['Pontos por ureia', pU + ' · ' + FX_U],
        ['Pontos por hemoglobina', pH + ' · ' + (homem ? 'faixa masculina: ' + FX_H_M : 'faixa feminina: ' + FX_H_F)],
        ['Pontos por pressão sistólica', pP + ' · ' + FX_P],
        ['Ponto por frequência cardíaca', pF + ' · 100 bpm ou mais = 1'],
        ['Pontos por achado clínico', pC + ' · melena 1 · síncope 2 · doença hepática 2 · insuficiência cardíaca 2'],
      ],
      cuidados: [
        'O escore foi publicado com ureia em mmol/L; o laudo brasileiro vem em mg/dL. Esta tela recebe mg/dL e converte à vista.',
        'O escore mede necessidade de INTERVENÇÃO, não mortalidade, e não prevê ressangramento.',
        'Ureia elevada na HDA vem da absorção de sangue no intestino, e por isso pesa tanto na conta.',
        'Para prever MORTALIDADE, o AIMS65 e o Rockall vão melhor que o Blatchford (AUROC em torno de 0,77 contra 0,64). Nenhum dos três prevê ressangramento.',
      ],
    }
  },
}
