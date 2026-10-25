import { completo, somar, type Escore } from '../escore.ts'

// sPESI (PESI simplificado), lacunas da Central, lote 3 (25/10/2026). O manual do
// HC só traz o PESI completo (Tabela 10, p. 445–446); o sPESI vem do artigo
// original (Jiménez 2010), com as seis variáveis conferidas no texto completo de
// Bonsu 2026. A mortalidade em 30 dias é a do resumo de Jiménez 2010.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]

export const spesi: Escore = {
  ficha: {
    id: 'spesi',
    titulo: 'sPESI — PESI simplificado no TEP (adulto)',
    versao: '2026-10-25.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Jiménez D, Aujesky D, Moores L, et al. Simplification of the pulmonary embolism severity index for prognostication in patients with acute symptomatic pulmonary embolism. Arch Intern Med. 2010;170(15):1383–1389. Resumo: mortalidade em 30 dias de 1,0% (derivação) e 1,1% (RIETE) no sPESI 0; 10,9% e 8,9% no sPESI ≥ 1.', url: 'https://doi.org/10.1001/archinternmed.2010.199' },
      { citacao: 'Bonsu KO, Young SW, Lee TA, et al. Optimizing sPESI with heart rate threshold adjustments for risk stratification in acute pulmonary embolism: a retrospective cohort study. Vasc Med. 2026;31(3):299–309. Seis variáveis do sPESI e um ponto para cada (texto completo, PMC13254130).', url: 'https://doi.org/10.1177/1358863X261420329' },
    ],
    revisadoEm: '25/10/2026 (lacunas da Central, lote 3; aguarda aprovação do RT)',
  },
  descricao: 'Seis variáveis de 1 ponto no TEP confirmado: 0 ponto é baixo risco; 1 ou mais é alto risco de morte em 30 dias.',
  itens: [
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade acima de 80 anos', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'cancer', rotulo: 'Câncer', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'cardiopulmonar', rotulo: 'Doença cardiopulmonar crônica (insuficiência cardíaca ou doença pulmonar crônica)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'fc', rotulo: 'Frequência cardíaca de 110 bpm ou mais', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'pas', rotulo: 'Pressão sistólica abaixo de 100 mmHg', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'sat', rotulo: 'Saturação de O2 abaixo de 90%', opcoes: NAO_SIM },
  ],
  calcular(r) {
    if (!completo(spesi, r)) return null
    const total = somar(spesi, r)
    const baixo = total === 0
    return {
      rotulo: 'sPESI',
      valor: String(total),
      unidade: total === 1 ? 'ponto' : 'pontos',
      nota: baixo ? 'baixo risco · mortalidade em 30 dias 1,0% na derivação' : 'alto risco · mortalidade em 30 dias 10,9% na derivação',
      estado: baixo ? 0 : 2,
      derivados: [
        ['Mortalidade em 30 dias (derivação)', baixo ? '1,0%' : '10,9%'],
        ['Mortalidade em 30 dias (validação no RIETE)', baixo ? '1,1%' : '8,9%'],
      ],
      cuidados: [
        'O escore vale para TEP já confirmado; não é escore de probabilidade diagnóstica.',
        'O sPESI não inclui troponina, BNP nem disfunção de VD. O manual do HC usa o PESI completo (Tabela 10 e Figura 4, p. 445–447).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
