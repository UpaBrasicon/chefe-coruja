import { completo, escolha, somar, type Escore } from '../escore.ts'

// 4T para HIT: quatro domínios de 0 a 2. Porte do protótipo (hematologia/4T
// para HIT, construído em 02/09/2026). Saíram (ADR 0007) os grupos "o que a
// probabilidade intermediária ou alta obriga" e "agentes não heparínicos", a
// linha "Heparina — suspender agora", o alerta de conduta e os cuidados sobre
// agente e nomograma: fica o total, a banda e a probabilidade da casuística.

const PROB = ['abaixo de 5%', 'em torno de 14%', 'em torno de 64%']

export const quatroT: Escore = {
  ficha: {
    id: '4t-hit',
    titulo: '4T — probabilidade de trombocitopenia induzida por heparina',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Lo GK, Juhl D, Warkentin TE, et al. Evaluation of pretest clinical score (4 Ts) for the diagnosis of heparin-induced thrombocytopenia. J Thromb Haemost. 2006;4(4):759–765.', url: 'https://doi.org/10.1111/j.1538-7836.2006.01787.x' },
      { citacao: 'Cuker A, Arepally GM, Chong BH, et al. American Society of Hematology 2018 guidelines for management of venous thromboembolism: heparin-induced thrombocytopenia. Blood Adv. 2018;2(22):3360–3392.', url: 'https://doi.org/10.1182/bloodadvances.2018024489' },
      { citacao: 'Cuker A, Gimotty PA, Crowther MA, Warkentin TE. Predictive value of the 4Ts scoring system for heparin-induced thrombocytopenia: a systematic review and meta-analysis. Blood. 2012;120(20):4160–4167.', url: 'https://doi.org/10.1182/blood-2012-07-443051' },
      { citacao: 'UpToDate. Clinical presentation and diagnosis of heparin-induced thrombocytopenia. (referência de escopo autorizada pelo usuário em 02/09/2026)', url: 'https://www.uptodate.com' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Probabilidade pré-teste de trombocitopenia induzida por heparina, de 0 a 8 pontos',
  itens: [
    { tipo: 'escolha', id: 'trombo', rotulo: 'Trombocitopenia — queda e nadir', opcoes: [
      { rotulo: 'Queda maior que 50% e nadir de 20 mil ou mais', valor: 2 },
      { rotulo: 'Queda de 30 a 50%, ou nadir de 10 a 19 mil', valor: 1 },
      { rotulo: 'Queda menor que 30%, ou nadir abaixo de 10 mil', valor: 0 },
    ] },
    { tipo: 'escolha', id: 'tempo', rotulo: 'Tempo entre a heparina e a queda', opcoes: [
      { rotulo: 'Entre 5 e 10 dias, ou em 1 dia com heparina nos últimos 30 dias', valor: 2 },
      { rotulo: 'Depois de 10 dias, tempo incerto, ou em 1 dia com heparina de 30 a 100 dias atrás', valor: 1 },
      { rotulo: 'Antes de 4 dias, sem exposição recente', valor: 0 },
    ] },
    { tipo: 'escolha', id: 'trombose', rotulo: 'Trombose ou outra sequela', opcoes: [
      { rotulo: 'Trombose nova confirmada, necrose de pele, ou reação sistêmica aguda após bólus', valor: 2 },
      { rotulo: 'Trombose progressiva ou recorrente, lesão eritematosa de pele, ou suspeita não confirmada', valor: 1 },
      { rotulo: 'Nenhuma', valor: 0 },
    ] },
    { tipo: 'escolha', id: 'outras', rotulo: 'ouTras causas de trombocitopenia', opcoes: [
      { rotulo: 'Nenhuma aparente', valor: 2 },
      { rotulo: 'Possível', valor: 1 },
      { rotulo: 'Definida', valor: 0 },
    ] },
  ],
  calcular(r) {
    if (!completo(quatroT, r)) return null
    const total = somar(quatroT, r)
    const banda = total >= 6 ? 2 : total >= 4 ? 1 : 0
    return {
      rotulo: '4T',
      valor: String(total),
      unidade: total === 1 ? 'ponto' : 'pontos',
      nota: ['probabilidade baixa', 'probabilidade intermediária', 'probabilidade alta'][banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Probabilidade de HIT na casuística original', PROB[banda]],
        ['Banda', ['0 a 3 — baixa', '4 e 5 — intermediária', '6 a 8 — alta'][banda]],
        ['0 a 3 pontos — baixa', 'abaixo de 5%; valor preditivo negativo alto'],
        ['4 e 5 pontos — intermediária', 'em torno de 14%; não afasta'],
        ['6 a 8 pontos — alta', 'em torno de 64%'],
      ],
      alerta: banda === 0 && escolha(quatroT, r, 'trombose')!.valor === 2
        ? 'Escore baixo, mas com trombose confirmada, necrose de pele ou reação sistêmica após bólus marcada. Confira o domínio de outras causas.'
        : undefined,
      cuidados: [
        'O escore é pré-teste: dá sentido ao anti-PF4, que tem sensibilidade alta e especificidade baixa e por isso produz resultado positivo enganoso quando o pré-teste é baixo.',
        'Qualquer heparina conta na exposição: baixo peso, flush de cateter, cateter revestido e a profilaxia subcutânea. A pergunta do domínio de tempo é sobre exposição, não sobre dose plena.',
        'Trombose nova sob heparina, com plaqueta ainda normal, também é HIT possível. A queda de plaqueta pode não ter acontecido ainda.',
      ],
    }
  },
}
