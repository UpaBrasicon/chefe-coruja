import { completo, somar, type Escore } from '../escore.ts'

// TIMI do IAM com supradesnivelamento de ST (Morrow 2000, coorte InTIME II de
// fibrinólise). O manual do HC traz só o TIMI-NSTEMI (timi.ts); este entra pela
// referência primária, como o HEART e o GRACE. Mortalidade em 30 dias por
// pontuação é a da Figura do artigo original.

const MORTALIDADE_30D = ['0,8%', '1,6%', '2,2%', '4,4%', '7,3%', '12,4%', '16,1%', '23,4%', '26,8%', '35,9%']

export const timiIamcsst: Escore = {
  ficha: {
    id: 'timi-iamcsst',
    titulo: 'TIMI IAMCSST — risco no IAM com supra de ST (adulto)',
    versao: '2026-09-30.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Morrow DA, Antman EM, Charlesworth A, et al. TIMI risk score for ST-elevation myocardial infarction: a convenient, bedside, clinical score for risk assessment at presentation. An intravenous nPA for treatment of infarcting myocardium early II trial substudy. Circulation. 2000;102(17):2031–2037.', url: 'https://doi.org/10.1161/01.CIR.102.17.2031' },
    ],
    revisadoEm: '30/09/2026 (referência primária; aguarda aprovação do RT)',
  },
  descricao: 'Oito variáveis da admissão, de 0 a 14 pontos, com a mortalidade em 30 dias da coorte do artigo original.',
  itens: [
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [
      { rotulo: 'Abaixo de 65 anos', valor: 0 }, { rotulo: '65 a 74 anos — 2 pontos', valor: 2 }, { rotulo: '75 anos ou mais — 3 pontos', valor: 3 },
    ] },
    { tipo: 'marca', id: 'hist', rotulo: 'Diabetes, hipertensão ou angina prévia', pontos: 1 },
    { tipo: 'marca', id: 'pas', rotulo: 'PAS < 100 mmHg', pontos: 3 },
    { tipo: 'marca', id: 'fc', rotulo: 'FC > 100 bpm', pontos: 2 },
    { tipo: 'marca', id: 'killip', rotulo: 'Killip II a IV', pontos: 2 },
    { tipo: 'marca', id: 'peso', rotulo: 'Peso < 67 kg', pontos: 1 },
    { tipo: 'marca', id: 'anterior', rotulo: 'Supra de ST anterior ou BRE', pontos: 1 },
    { tipo: 'marca', id: 'tempo', rotulo: 'Tempo até o tratamento > 4 h', pontos: 1 },
  ],
  calcular(r) {
    if (!completo(timiIamcsst, r)) return null
    const total = somar(timiIamcsst, r)
    const mort = MORTALIDADE_30D[Math.min(total, 9)]
    return {
      rotulo: 'TIMI IAMCSST',
      valor: String(total),
      unidade: 'de 14',
      nota: `mortalidade em 30 dias na coorte original: ${total > 8 ? 'acima de 8 pontos, ' : ''}${mort}`,
      estado: 0,
      derivados: [['Mortalidade em 30 dias (InTIME II)', total > 8 ? `${mort} (mais de 8 pontos)` : mort]],
      cuidados: [
        'Coorte de pacientes elegíveis para fibrinólise (InTIME II); em angioplastia primária os percentuais podem ser outros.',
        'O manual do HC não traz este escore; ele entra pela referência primária.',
        'O artigo não define faixas de risco: a tela mostra a mortalidade por ponto, sem cor.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
