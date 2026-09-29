import { completo, numero, somar, type Escore } from '../escore.ts'

// Wells para TEP: sete critérios, quatro deles de 1,5 ponto. Porte do protótipo
// (pneumologia/Wells para TEP, construído em 30/08/2026), com as leituras de
// três níveis e dicotomizada e o D-dímero ajustado pela idade. Saíram (ADR
// 0007) a linha "Conduta", o "provável vai à imagem" do alerta e o cuidado de
// instabilidade/trombólise. O YEARS do protótipo ficou FORA: ele usava
// "neoplasia" como terceiro critério, e no YEARS o terceiro critério é "TEP
// como diagnóstico mais provável" — diverge da fonte citada.

const ns = (pontos: number) => [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: pontos }]
const fmt = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',')
const TRES = ['baixa', 'moderada', 'alta']

export const wellsTep: Escore = {
  ficha: {
    id: 'wells-tep',
    titulo: 'Wells para TEP — probabilidade de embolia pulmonar',
    versao: '2026-09-28.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Wells PS, Anderson DR, Rodger M, et al. Derivation of a simple clinical model to categorize patients probability of pulmonary embolism. Thromb Haemost. 2000;83(3):416–420.', url: 'https://doi.org/10.1055/s-0037-1613830' },
      { citacao: 'Creager MA, Barnes GD, Giri J, et al. 2026 AHA/ACC/ACCP/ACEP/CHEST/SCAI/SHM/SIR/SVM/SVN Guideline for the evaluation and management of acute pulmonary embolism in adults. 2026.', url: 'https://doi.org/10.1161/CIR.0000000000001300' },
      { citacao: 'Kearon C, de Wit K, Parpia S, et al. Diagnosis of pulmonary embolism with d-dimer adjusted to clinical probability. N Engl J Med. 2019;381(22):2125–2134. Citado só para distinguir a variante de três níveis.', url: 'https://doi.org/10.1056/NEJMoa1909159' },
      { citacao: 'Righini M, Van Es J, Den Exter PL, et al. Age-adjusted D-dimer cutoff levels to rule out pulmonary embolism: the ADJUST-PE study. JAMA. 2014;311(11):1117–1124.', url: 'https://doi.org/10.1001/jama.2014.2135' },
    ],
    revisadoEm: '28/09/2026 (variante de três níveis explicitada)',
  },
  descricao: 'Probabilidade pré-teste de embolia pulmonar, nas leituras de três níveis e dicotomizada, com o limiar de D-dímero ajustado pela idade',
  itens: [
    { tipo: 'escolha', id: 'tvp', rotulo: 'Sinais clínicos de TVP — edema e dor à palpação', opcoes: ns(3) },
    { tipo: 'escolha', id: 'alternativo', rotulo: 'Diagnóstico alternativo menos provável que TEP', opcoes: ns(3) },
    { tipo: 'escolha', id: 'fc', rotulo: 'Frequência cardíaca acima de 100 bpm', opcoes: ns(1.5) },
    { tipo: 'escolha', id: 'imob', rotulo: 'Imobilização de 3 dias ou mais, ou cirurgia nas últimas 4 semanas', opcoes: ns(1.5) },
    { tipo: 'escolha', id: 'previo', rotulo: 'TVP ou TEP prévios', opcoes: ns(1.5) },
    { tipo: 'escolha', id: 'hemoptise', rotulo: 'Hemoptise', opcoes: ns(1) },
    { tipo: 'escolha', id: 'neoplasia', rotulo: 'Neoplasia em tratamento, tratada nos últimos 6 meses ou paliativa', opcoes: ns(1) },
    { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 14, max: 120, passo: 1, ajuda: 'Define o limiar de D-dímero ajustado pela idade.' },
  ],
  calcular(r) {
    if (!completo(wellsTep, r)) return null
    const total = somar(wellsTep, r)
    const anos = numero(wellsTep, r, 'idade')!
    // Três níveis: baixa abaixo de 2, moderada 2 a 6, alta acima de 6 (Wells
    // 2000). O protótipo cortava a baixa em "≤ 1" e deixava 1,5 em moderada,
    // contra o próprio rótulo "0 a 1 / 2 a 6"; aqui 1,5 fica em baixa.
    const tres = total < 2 ? 0 : total <= 6 ? 1 : 2
    const provavel = total > 4
    const idLimiar = anos > 50 ? Math.round(anos * 10) : 500
    return {
      rotulo: 'Wells',
      valor: fmt(total),
      unidade: 'de 12,5',
      nota: (provavel ? 'TEP PROVÁVEL' : 'TEP improvável') + ' · probabilidade ' + TRES[tres] + ' na leitura de três níveis',
      estado: tres as 0 | 1 | 2,
      derivados: [
        ['Leitura dicotomizada', (provavel ? 'provável' : 'improvável') + ' · corte em 4 pontos'],
        ['Leitura de três níveis', ['baixa · abaixo de 2', 'moderada · 2 a 6', 'alta · acima de 6'][tres]],
        ['D-dímero ajustado pela idade', idLimiar + ' µg/L' + (anos > 50 ? ' · ' + anos + ' × 10' : ' · limiar fixo até 50 anos')],
      ],
      alerta: provavel && total <= 6
        ? 'As duas leituras discordam: pelo corte dicotomizado este paciente é TEP PROVÁVEL, e pela leitura de três níveis é probabilidade MODERADA.'
        : undefined,
      cuidados: [
        'A diretriz de 2026 trata Wells, Genebra revisado e PERC como ferramentas de decisão clínica recomendadas, sem preferência única entre elas.',
        'O item “diagnóstico alternativo menos provável que TEP” é subjetivo e é a maior fonte de variação entre examinadores. A pontuação tem casas decimais, e arredondar muda a faixa.',
        'A leitura de três níveis desta tela é a de Wells 2000 (abaixo de 2, 2 a 6, acima de 6). O estudo PEGeD (Kearon, NEJM 2019) usou outra divisão em três níveis, com o D-dímero de 1000 na baixa probabilidade: não misturar as duas.',
        'O limiar ajustado pela idade só vale acima de 50 anos; abaixo disso o limiar segue 500.',
        'Na gestante o algoritmo é outro, e esta tela não o faz.',
        'Nem o Wells nem o D-dímero ajustado têm validação pediátrica declarada.',
      ],
    }
  },
}
