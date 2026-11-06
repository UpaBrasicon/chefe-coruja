import { completo, numero, somar, type Escore } from '../escore.ts'
import type { Fonte } from '../ficha.ts'

// GRACE (mortalidade hospitalar): idade, FC, PAS e creatinina por faixa, mais
// Killip, parada, desvio de ST e marcador. Porte do protótipo
// (cardiologia/GRACE, construído em 29/08/2026; o protótipo marca a tabela de
// pontos por faixa como pendente de revisão clínica). Saíram (ADR 0007) a
// linha "estratégia sugerida pela diretriz" e o cuidado "levam a cateterismo
// imediato": fica o total, a faixa e a mortalidade da faixa.

type Tabela = [number, number][]

/** Pontos da primeira faixa em que x fica abaixo do limite (como no protótipo). */
const faixa = (x: number, tab: Tabela) => {
  for (const [limite, pontos] of tab) if (x < limite) return pontos
  return tab[tab.length - 1][1]
}

const IDADE: Tabela = [[30, 0], [40, 8], [50, 25], [60, 41], [70, 58], [80, 75], [90, 91], [Infinity, 100]]
const FC: Tabela = [[50, 0], [70, 3], [90, 9], [110, 15], [150, 24], [200, 38], [Infinity, 46]]
const PAS: Tabela = [[80, 58], [100, 53], [120, 43], [140, 34], [160, 24], [200, 10], [Infinity, 0]]
const CR: Tabela = [[0.4, 1], [0.8, 4], [1.2, 7], [1.6, 10], [2, 13], [4, 21], [Infinity, 28]]

const NAO_SIM = (pontos: number) => [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: pontos }]

// Versão de 06/11/2026 (revisão PubMed, itens médios; RT, H15 = A): nota do
// GRACE 3.0, separado por sexo, com o endereço da calculadora oficial dos
// autores. O endereço foi conferido em 06/11/2026 nas páginas do Centro de
// Cardiologia Molecular da Universidade de Zurique (grupo de Wenzl e Lüscher) e
// do Zurich Heart House, que remetem à resposta dos autores na Lancet (PMID
// 36610768). Esta tela continua no modelo de 2003 e não calcula o GRACE 3.0.

export const URL_GRACE_3 = 'https://www.grace-3.com/'

export const WENZL_GRACE3_2022: Fonte = {
  citacao: 'Wenzl FA, Kraler S, Ambler G, et al. Sex-specific evaluation and redevelopment of the GRACE score in non-ST-segment elevation acute coronary syndromes in populations from the UK and Switzerland: a multinational analysis with external cohort validation. Lancet. 2022;400(10354):744–756 (PMID 36049493).',
  url: 'https://doi.org/10.1016/S0140-6736(22)01483-0',
}

export const WENZL_GRACE3_2025: Fonte = {
  citacao: 'Wenzl FA, Kofoed KF, Simonsson M, et al. Extension of the GRACE score for non-ST-elevation acute coronary syndrome: a development and validation study in ten countries. Lancet Digit Health. 2025;7(10):100907 (PMID 41107201).',
  url: 'https://doi.org/10.1016/j.landig.2025.100907',
}

export const CALCULADORA_GRACE3: Fonte = {
  citacao: 'Calculadora on-line oficial do GRACE 3.0, do grupo dos autores (Universidade de Zurique), divulgada na resposta dos autores: Wenzl FA, Lüscher TF. Application of a sex-specific GRACE score in practice — Authors\' reply. Lancet. 2023;401(10370):23 (PMID 36610768).',
  url: URL_GRACE_3,
}

export const NOTA_GRACE_3 =
  `GRACE 3.0 (Lancet 2022; SCA sem supra de ST): o GRACE 2.0 discriminou pior a morte hospitalar na mulher (AUC 0,82, contra 0,86 no homem) e subestimou o risco dela, deixando-a mais vezes no risco baixo a intermediário. O GRACE 3.0, com modelos separados por sexo, teve AUC de 0,91 no homem e 0,87 na mulher na validação externa e reclassificou mulheres para o alto risco; em 2025 a validação externa em 7 países europeus deu AUC de 0,90 para a morte hospitalar. A limitação foi medida no GRACE 2.0; esta tela usa o modelo de 2003 e não calcula o 3.0. Calculadora oficial do GRACE 3.0: ${URL_GRACE_3}`

export const grace: Escore = {
  ficha: {
    id: 'grace',
    titulo: 'GRACE — risco na síndrome coronariana aguda',
    versao: '2026-11-06.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Granger CB, Goldberg RJ, Dabbous O, et al. Predictors of hospital mortality in the Global Registry of Acute Coronary Events. Arch Intern Med. 2003;163(19):2345–2353.', url: 'https://doi.org/10.1001/archinte.163.19.2345' },
      { citacao: 'Byrne RA, Rossello X, Coughlan JJ, et al. 2023 ESC Guidelines for the management of acute coronary syndromes. Eur Heart J. 2023;44(38):3720–3826.', url: 'https://doi.org/10.1093/eurheartj/ehad191' },
      WENZL_GRACE3_2022,
      WENZL_GRACE3_2025,
      CALCULADORA_GRACE3,
    ],
    revisadoEm: '06/11/2026 (nota do GRACE 3.0 com o endereço da calculadora oficial; revisão PubMed, itens médios; aviso das faixas da SCA sem supra em 28/09/2026)',
  },
  descricao: 'Mortalidade hospitalar na síndrome coronariana aguda por oito variáveis da admissão',
  itens: [
    { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 0, max: 130, passo: 1 },
    { tipo: 'numero', id: 'fc', rotulo: 'Frequência cardíaca', unidade: 'bpm', min: 0, max: 350, passo: 1 },
    { tipo: 'numero', id: 'pas', rotulo: 'Pressão sistólica', unidade: 'mmHg', min: 0, max: 350, passo: 1 },
    { tipo: 'numero', id: 'cr', rotulo: 'Creatinina', unidade: 'mg/dL', min: 0.05, max: 30, passo: 0.01, ajuda: 'A da admissão.' },
    { tipo: 'escolha', id: 'killip', rotulo: 'Classe de Killip', opcoes: [
      { rotulo: 'I — sem congestão', valor: 0 }, { rotulo: 'II — estertores ou terceira bulha', valor: 20 },
      { rotulo: 'III — edema agudo de pulmão', valor: 39 }, { rotulo: 'IV — choque cardiogênico', valor: 59 },
    ] },
    { tipo: 'escolha', id: 'parada', rotulo: 'Parada cardíaca na admissão', opcoes: NAO_SIM(39) },
    { tipo: 'escolha', id: 'st', rotulo: 'Desvio do segmento ST', opcoes: NAO_SIM(28) },
    { tipo: 'escolha', id: 'marcador', rotulo: 'Marcador de necrose elevado', opcoes: NAO_SIM(14) },
  ],
  calcular(r) {
    if (!completo(grace, r)) return null
    const pIdade = faixa(numero(grace, r, 'idade')!, IDADE)
    const pFc = faixa(numero(grace, r, 'fc')!, FC)
    const pPas = faixa(numero(grace, r, 'pas')!, PAS)
    const pCr = faixa(numero(grace, r, 'cr')!, CR)
    const pSel = somar(grace, r)
    const total = pIdade + pFc + pPas + pCr + pSel
    const banda = total > 140 ? 2 : total >= 109 ? 1 : 0
    return {
      rotulo: 'GRACE',
      valor: String(total),
      unidade: 'pontos',
      nota: ['baixo risco — mortalidade hospitalar abaixo de 1%', 'risco intermediário — mortalidade de 1 a 3%', 'alto risco — mortalidade acima de 3%'][banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Idade', pIdade + ' pontos'],
        ['Frequência cardíaca', pFc + ' pontos'],
        ['Pressão sistólica', pPas + ' pontos'],
        ['Creatinina', pCr + ' pontos'],
        ['Killip, parada, ST e marcador', pSel + ' pontos'],
        ['Faixa', ['até 108 pontos', '109 a 140 pontos', 'acima de 140 pontos'][banda]],
      ],
      cuidados: [
        'As faixas de 108 e 140 pontos são do modelo de mortalidade hospitalar na SCA SEM supra de ST. No IAM com supra de ST as faixas são outras, e esta tela não as mostra.',
        'O modelo de 6 meses tem outras faixas.',
        'Creatinina em mg/dL. O registro original usa a mesma unidade; conferir a do laboratório antes de digitar.',
        'O escore foi derivado dos valores de chegada: recalcular após a estabilização não é GRACE.',
        'É um modelo de mortalidade, não uma contagem de gravidade clínica: pressão sistólica baixa e parada na admissão pesam mais que o marcador elevado.',
        NOTA_GRACE_3,
      ],
    }
  },
}
