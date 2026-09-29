import { completo, escolha, somar, type Escore } from '../escore.ts'

// HAS-BLED: nove critérios de 1 ponto. Porte do protótipo (escores/HAS-BLED,
// construído em 29/08/2026). "Reavaliar em intervalo curto" e "corrigir os
// fatores" saíram (ADR 0007): fica quais fatores modificáveis estão presentes.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
// % de sangramento maior por ano, coorte original (Pisters, 2010); índice = total
const SANGRAMENTO_ANUAL = ['1,13', '1,02', '1,88', '3,74', '8,70', '12,50', '12,50', '12,50', '12,50', '12,50']
const MODIFICAVEIS: [string, string][] = [['has', 'hipertensão não controlada'], ['inr', 'INR lábil'], ['drogas', 'antiplaquetário ou AINE'], ['alcool', 'álcool']]

export const hasBled: Escore = {
  ficha: {
    id: 'has-bled',
    titulo: 'HAS-BLED — risco de sangramento maior',
    versao: '2026-09-28.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Pisters R, Lane DA, Nieuwlaat R, et al. A novel user-friendly score (HAS-BLED) to assess 1-year risk of major bleeding in patients with atrial fibrillation. Chest. 2010;138(5):1093–1100.', url: 'https://doi.org/10.1378/chest.10-0134' },
      { citacao: 'Van Gelder IC, Rienstra M, Bunting KV, et al. 2024 ESC Guidelines for the management of atrial fibrillation. Eur Heart J. 2024;45(36):3314–3414 (o HAS-BLED identifica fatores modificáveis e não serve para negar anticoagulação).', url: 'https://doi.org/10.1093/eurheartj/ehae176' },
      { citacao: 'Cintra FD, et al. Diretriz Brasileira de Fibrilação Atrial – 2025 (SBC/SOBRAC). Arq Bras Cardiol. 2025;122(9):e20250618 (HAS-BLED para identificar fatores modificáveis, IIa B).', url: 'https://doi.org/10.36660/abc.20250618' },
      { citacao: 'Hindricks G, Potpara T, Dagres N, et al. 2020 ESC Guidelines for the diagnosis and management of atrial fibrillation. Eur Heart J. 2021;42(5):373–498 (citação anterior, substituída pela ESC 2024).', url: 'https://doi.org/10.1093/eurheartj/ehaa612' },
    ],
    revisadoEm: '28/09/2026 (citação atualizada para ESC 2024 e SBC 2025; itens inalterados)',
  },
  descricao: 'No paciente em anticoagulação oral por fibrilação atrial',
  itens: [
    { tipo: 'escolha', id: 'has', rotulo: 'Hipertensão não controlada (sistólica acima de 160 mmHg)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'renal', rotulo: 'Função renal alterada (diálise, transplante ou creatinina acima de 2,26 mg/dL)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'hepatica', rotulo: 'Função hepática alterada (cirrose, bilirrubina acima de 2× ou transaminases acima de 3×)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'avc', rotulo: 'AVC prévio', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'sangramento', rotulo: 'Sangramento prévio ou predisposição (anemia)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'inr', rotulo: 'INR lábil (tempo na faixa terapêutica abaixo de 60%)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade acima de 65 anos', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'drogas', rotulo: 'Antiplaquetário ou anti-inflamatório em uso', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'alcool', rotulo: 'Álcool: 8 doses ou mais por semana', opcoes: NAO_SIM },
  ],
  calcular(r) {
    if (!completo(hasBled, r)) return null
    const total = somar(hasBled, r)
    const banda = total >= 3 ? 2 : total === 2 ? 1 : 0
    const presentes = MODIFICAVEIS.filter(([id]) => escolha(hasBled, r, id)?.valor === 1).map(([, nome]) => nome)
    return {
      rotulo: 'HAS-BLED',
      valor: String(total),
      unidade: total === 1 ? 'ponto' : 'pontos',
      nota: ['risco baixo', 'risco intermediário', 'risco alto'][banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Fatores modificáveis presentes', presentes.length ? String(presentes.length) + ' de 4' : 'nenhum'],
        ['Quais', presentes.length ? presentes.join(', ') : '—'],
        ['Sangramento maior por ano', SANGRAMENTO_ANUAL[Math.min(total, 9)] + '%'],
      ],
      alerta: presentes.length
        ? (presentes.length === 1 ? 'Há 1 fator modificável presente: ' : `Há ${presentes.length} fatores modificáveis presentes: `) + presentes.join(', ') + '.'
        : undefined,
      cuidados: [
        'Escore alto não é, pela fonte, contraindicação à anticoagulação: ele aponta fatores de sangramento, alguns modificáveis. Quem tem HAS-BLED alto costuma ter CHA₂DS₂-VA alto.',
        'Os percentuais anuais são da coorte original (Pisters, 2010) e foram medidos sobretudo em varfarina.',
      ],
    }
  },
}
