import { completo, somar, type Escore } from '../escore.ts'

// CHA₂DS₂-VA (ESC 2024): sem a categoria de sexo, faixas 0 · 1 · ≥ 2 iguais
// para todos. Porte do protótipo (escores/CHA₂DS₂-VASc, atualizado em
// 30/08/2026). As notas de indicação de anticoagulação saíram (ADR 0007).

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
// % de AVC por ano sem anticoagulação, coorte original do VASc (índice = total)
const RISCO_ANUAL = ['0,2', '0,6', '2,2', '3,2', '4,8', '7,2', '9,7', '11,2', '10,8', '12,2']

export const cha2ds2va: Escore = {
  ficha: {
    id: 'cha2ds2-va',
    titulo: 'CHA₂DS₂-VA — risco de AVC na fibrilação atrial',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Van Gelder IC, Rienstra M, Bunting KV, et al. 2024 ESC Guidelines for the management of atrial fibrillation. Eur Heart J. 2024;45(36):3314–3414.', url: 'https://doi.org/10.1093/eurheartj/ehae176' },
      { citacao: 'Yoshimura H, et al. Validation of the CHA₂DS₂-VA score without the sex category. Europace. 2024.', url: 'https://doi.org/10.1093/europace/euae189' },
      { citacao: 'Joglar JA, Chung MK, Armbruster AL, et al. 2023 ACC/AHA/ACCP/HRS Guideline for the diagnosis and management of atrial fibrillation. Circulation. 2024;149(1):e1–e156.', url: 'https://doi.org/10.1161/CIR.0000000000001193' },
      { citacao: 'Lip GYH, Nieuwlaat R, Pisters R, et al. Refining clinical risk stratification for predicting stroke and thromboembolism in atrial fibrillation using a novel risk factor-based approach. Chest. 2010;137(2):263–272.', url: 'https://doi.org/10.1378/chest.09-1584' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Risco de AVC na fibrilação atrial, sem a categoria de sexo (ESC 2024)',
  itens: [
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [
      { rotulo: 'Abaixo de 65 anos', valor: 0 }, { rotulo: '65 a 74 anos', valor: 1 }, { rotulo: '75 anos ou mais', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'ic', rotulo: 'Insuficiência cardíaca ou disfunção de VE', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'has', rotulo: 'Hipertensão arterial', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'dm', rotulo: 'Diabetes melito', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'avc', rotulo: 'AVC, AIT ou tromboembolismo prévio', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 2 }] },
    { tipo: 'escolha', id: 'vasc', rotulo: 'Doença vascular (IAM prévio, arteriopatia periférica, placa aórtica)', opcoes: NAO_SIM },
  ],
  calcular(r) {
    if (!completo(cha2ds2va, r)) return null
    const total = somar(cha2ds2va, r)
    const banda = total >= 2 ? 2 : total === 1 ? 1 : 0
    const risco = RISCO_ANUAL[Math.min(total, 9)] + '%'
    return {
      rotulo: 'CHA₂DS₂-VA',
      valor: String(total),
      unidade: total === 1 ? 'ponto' : 'pontos',
      nota: `AVC por ano sem anticoagulação ${risco}`,
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Escore lido', 'CHA₂DS₂-VA · ' + String(total) + (total === 1 ? ' ponto' : ' pontos')],
        ['Faixa ESC 2024', ['0 ponto', '1 ponto', '2 pontos ou mais'][banda] + ' · a mesma para homem e mulher'],
        ['Sexo na conta', 'não entra — o VA tirou a categoria de sexo'],
        ['AVC por ano, sem anticoagulação', risco],
      ],
      cuidados: [
        'Vale para fibrilação atrial NÃO valvar. Estenose mitral reumática e prótese valvar mecânica ficam fora do escore.',
        'A ESC 2024 tirou a categoria de sexo por três motivos declarados: o sexo feminino é modificador de risco dependente da idade e não fator independente; a decisão fica mais simples; e o escore passa a não excluir pessoas não binárias ou transgênero. Um estudo de validação de 2024 mostrou que remover o critério não prejudica a discriminação.',
        'A ACC/AHA 2023 mantém o CHA₂DS₂-VASc, com limiar de ≥ 2 no homem e ≥ 3 na mulher. Esta unidade adotou o VA — se você comunicar o número para um serviço que usa o VASc, diga qual escore usou.',
        'O escore diz o risco de AVC. O risco de sangramento é outra conta.',
        'Os percentuais anuais são da coorte original do VASc e variam entre populações.',
        'Validado exclusivamente em adultos com fibrilação atrial. Não há referência pediátrica declarada.',
      ],
    }
  },
}
