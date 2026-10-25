import { completo, somar, type Escore } from '../escore.ts'

// CRB-65: o CURB-65 sem a ureia, para quando não há exame (lacunas da Central,
// lote 3, 25/10/2026). Critérios e faixas (0 baixo, 1–2 intermediário, 3–4 alto)
// conferidos no texto completo de McNally 2010 (PMC2944951); a mortalidade
// observada em 30 dias é a da Tabela 2 da mesma meta-análise, separada em
// hospital e comunidade.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]

/** Tabela 2 de McNally 2010: mortalidade observada por faixa (hospital, comunidade). */
const OBSERVADA: [string, string][] = [['2,4%', '0,0%'], ['13,3%', '1,6%'], ['34,3%', '18,5%']]
const FAIXA = ['baixo risco', 'risco intermediário', 'alto risco']

export const crb65: Escore = {
  ficha: {
    id: 'crb-65',
    titulo: 'CRB-65 — gravidade da pneumonia comunitária sem ureia',
    versao: '2026-10-25.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Lim WS, van der Eerden MM, Laing R, et al. Defining community acquired pneumonia severity on presentation to hospital: an international derivation and validation study. Thorax. 2003;58(5):377–382.', url: 'https://doi.org/10.1136/thorax.58.5.377' },
      { citacao: 'McNally M, Curtain J, O\'Brien KK, Dimitrov BD, Fahey T. Validity of British Thoracic Society guidance (the CRB-65 rule) for predicting the severity of pneumonia in general practice: systematic review and meta-analysis. Br J Gen Pract. 2010;60(579):e423–e433. Critérios e faixas na introdução; mortalidade observada na Tabela 2.', url: 'https://doi.org/10.3399/bjgp10X532422' },
    ],
    revisadoEm: '25/10/2026 (lacunas da Central, lote 3; aguarda aprovação do RT)',
  },
  descricao: 'Quatro critérios de 1 ponto, sem exame de laboratório; faixa de risco e mortalidade observada em 30 dias no hospital e na comunidade.',
  itens: [
    { tipo: 'escolha', id: 'c', rotulo: 'Confusão mental de início recente', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'r', rotulo: 'Frequência respiratória de 30 irpm ou mais', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'b', rotulo: 'Sistólica abaixo de 90 ou diastólica de 60 mmHg ou menos', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'i', rotulo: 'Idade de 65 anos ou mais', opcoes: NAO_SIM },
  ],
  calcular(r) {
    if (!completo(crb65, r)) return null
    const total = somar(crb65, r)
    const banda = total >= 3 ? 2 : total >= 1 ? 1 : 0
    const [hospital, comunidade] = OBSERVADA[banda]
    return {
      rotulo: 'CRB-65',
      valor: String(total),
      unidade: total === 1 ? 'ponto' : 'pontos',
      nota: `${FAIXA[banda]} · mortalidade observada em 30 dias ${hospital} no hospital`,
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Faixa', ['0 ponto', '1 ou 2 pontos', '3 ou 4 pontos'][banda]],
        ['Mortalidade observada em 30 dias — hospital', hospital],
        ['Mortalidade observada em 30 dias — comunidade', comunidade],
      ],
      cuidados: [
        'Na meta-análise, o CRB-65 estratificou bem no hospital e superestimou a mortalidade na comunidade, em todas as faixas.',
        'Com ureia disponível, o CURB-65 está na mesma seção.',
        'O escore mede gravidade, não etiologia, e não considera saturação de oxigênio, comorbidade descompensada nem suporte social.',
      ],
    }
  },
}
