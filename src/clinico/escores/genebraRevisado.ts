import { completo, somar, type Escore } from '../escore.ts'

// Genebra revisado: só itens objetivos, de 0 a 22. Porte do protótipo
// (pneumologia/Genebra revisado, construído em 30/08/2026). Saíram (ADR 0007)
// a linha "Conduta" e o cuidado "instabilidade não passa por escore". A versão
// SIMPLIFICADA do protótipo ficou FORA: ele dava no máximo 1 ponto à
// frequência cardíaca e anunciava "de 9", o que não fecha (7 itens + 1 = 8);
// na simplificada de Klok a FC de 95 ou mais vale 2.

const ns = (pontos: number) => [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: pontos }]
const NIVEL = ['baixa', 'intermediária', 'alta']

export const genebraRevisado: Escore = {
  ficha: {
    id: 'genebra-revisado',
    titulo: 'Genebra revisado — probabilidade de embolia pulmonar',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Le Gal G, Righini M, Roy PM, et al. Prediction of pulmonary embolism in the emergency department: the revised Geneva score. Ann Intern Med. 2006;144(3):165–171.', url: 'https://doi.org/10.7326/0003-4819-144-3-200602070-00004' },
      { citacao: 'Klok FA, Mos IC, Nijkeuter M, et al. Simplification of the revised Geneva score for assessing clinical probability of pulmonary embolism. Arch Intern Med. 2008;168(19):2131–2136.', url: 'https://doi.org/10.1001/archinte.168.19.2131' },
      { citacao: 'Etemadi A, Hosseini M, Rafiee H, et al. Comparative diagnostic accuracy of pre-test clinical probability scores for the risk stratification of patients with suspected pulmonary embolism. BMC Pulm Med. 2025.', url: 'https://doi.org/10.1186/s12890-025-03500-8' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Probabilidade pré-teste de embolia pulmonar só com itens objetivos',
  itens: [
    { tipo: 'escolha', id: 'fc', rotulo: 'Frequência cardíaca', opcoes: [
      { rotulo: 'Abaixo de 75 bpm', valor: 0 }, { rotulo: '75 a 94 bpm', valor: 3 }, { rotulo: '95 bpm ou mais', valor: 5 },
    ] },
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade acima de 65 anos', opcoes: ns(1) },
    { tipo: 'escolha', id: 'previo', rotulo: 'TVP ou TEP prévios', opcoes: ns(3) },
    { tipo: 'escolha', id: 'cirurgia', rotulo: 'Cirurgia sob anestesia geral ou fratura de membro inferior no último mês', opcoes: ns(2) },
    { tipo: 'escolha', id: 'neoplasia', rotulo: 'Neoplasia ativa, ou curada há menos de 1 ano', opcoes: ns(2) },
    { tipo: 'escolha', id: 'dorMembro', rotulo: 'Dor unilateral em membro inferior', opcoes: ns(3) },
    { tipo: 'escolha', id: 'hemoptise', rotulo: 'Hemoptise', opcoes: ns(2) },
    { tipo: 'escolha', id: 'palpacao', rotulo: 'Dor à palpação venosa profunda e edema unilateral', opcoes: ns(4) },
  ],
  calcular(r) {
    if (!completo(genebraRevisado, r)) return null
    const rev = somar(genebraRevisado, r)
    const pFc = somar(genebraRevisado, r, ['fc'])
    // Revisada: 0-3 baixa, 4-10 intermediária, 11 ou mais alta; não alta até 10.
    const t = rev <= 3 ? 0 : rev <= 10 ? 1 : 2
    return {
      rotulo: 'Genebra revisado',
      valor: String(rev),
      unidade: 'de 22',
      nota: 'probabilidade ' + NIVEL[t] + ' · ' + (rev > 10 ? 'ALTA na leitura de dois níveis' : 'não alta na leitura de dois níveis'),
      estado: t as 0 | 1 | 2,
      derivados: [
        ['Faixa', NIVEL[t] + ' · faixas 0 a 3, 4 a 10, 11 ou mais'],
        ['Dois níveis', rev > 10 ? 'alta' : 'não alta · corte em 10'],
        ['Pontos pela frequência cardíaca', String(pFc)],
      ],
      cuidados: [
        'A vantagem declarada sobre o Wells é não ter item subjetivo: todos os critérios aqui são verificáveis, o que reduz variação entre examinadores.',
        'A frequência cardíaca tem três estados na versão revisada: 75 a 94 já pontua.',
        'A diretriz americana de 2026 e a europeia mantêm Wells e Genebra revisado como intercambiáveis, sem preferência explícita.',
        'A metanálise em rede de 2025 mostrou razão de verossimilhança positiva de 6,65 para o Genebra de três níveis contra 5,59 para o Wells de três níveis.',
        'Sem validação pediátrica declarada.',
      ],
    }
  },
}
