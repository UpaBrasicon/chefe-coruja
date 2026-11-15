import { completo, somar, type Escore } from '../escore.ts'
import type { Fonte } from '../ficha.ts'

// 4AT — rastreio rápido de delirium no idoso (lacunas da Central, lote 1,
// 23/10/2026). Conferido no texto: alerta e mudança aguda/curso flutuante valem
// 0 ou 4; AMT4 vale 1 com um erro e 2 com dois ou mais ou se não testável; meses
// de trás para frente valem 1 se não completa 7 meses e 2 se não testável
// (Shenkin 2019). Leitura: 0 improvável; 1 a 3 possível comprometimento
// cognitivo; 4 ou mais possível delirium (Bellelli 2014). As quatro perguntas do
// AMT4 estão no formulário oficial e não foram conferidas em texto: não entram.

// Lote 7 da revisão do HCFMUSP (Q2 = A, decisão do RT de 14/11/2026): as
// diretrizes geriátricas de PS 2.0 (2025), parte de delirium, pelo resumo, ao lado
// do cap. 8 do manual do HC (p. 130–139, conferido no PDF).
export const GED_DELIRIUM_2025: Fonte = {
  citacao: 'Lee S, Khoujah D, Eagles D, et al. GRADE-Based Clinical Practice Guidelines for Emergency Department Delirium Risk Stratification, Screening, and Brain Imaging in Older Patients With Suspected Delirium. Acad Emerg Med. 2025;33(2):e70167 (PMID 41146403; PMC12875304). Geriatric ED Guidelines 2.0; resumo lido; todas as recomendações são condicionais, com certeza muito baixa.',
  url: 'https://doi.org/10.1111/acem.70167',
}

const GRAU_GED = 'condicional, certeza muito baixa'

/** Diretrizes geriátricas de PS 2.0 (2025) ao lado do cap. 8 do manual do HC. */
export const DIRETRIZ_DELIRIUM_2025: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Quem rastrear', diretriz: 'Para não rastrear todos, o Delirium Risk Score pode identificar o idoso de baixo risco de delirium', grau: GRAU_GED, fonte: 'GED 2.0 2025', livro: 'fatores predisponentes (Tabela 1) e desencadeantes (Tabela 2) (cap. 8, p. 130–131)' },
  { tema: 'Idoso em observação', diretriz: 'Acima de 65 anos internado em unidade de observação do PS: a ferramenta de Zucchelli (corte ≥ 4) pode estratificar o risco', grau: GRAU_GED, fonte: 'GED 2.0 2025', livro: 'o cap. 8 não trata do ponto' },
  { tema: 'Acima de 75 anos', diretriz: 'O escore REDEEM pode identificar baixo ou alto risco', grau: GRAU_GED, fonte: 'GED 2.0 2025', livro: 'o cap. 8 não trata do ponto' },
  { tema: 'Diagnóstico', diretriz: '4AT, bCAM, CAM-ICU, mCAM, AMT-4 ou RASS podem confirmar ou afastar o delirium', grau: GRAU_GED, fonte: 'GED 2.0 2025', livro: 'CAM: mudança aguda com curso flutuante e desatenção, mais pensamento desorganizado ou alteração do nível de consciência (Tabela 3, cap. 8, p. 132)' },
  { tema: 'Delirium Triage Screen', diretriz: 'O DTS pode afastar, mas não confirmar, o delirium', grau: GRAU_GED, fonte: 'GED 2.0 2025', livro: 'o cap. 8 não trata do ponto' },
  { tema: 'TC de crânio', diretriz: 'Não há evidência suficiente para recomendar a favor ou contra a TC de crânio na avaliação do idoso com delirium no PS', grau: GRAU_GED, fonte: 'GED 2.0 2025', livro: 'exames conforme a suspeita; TC ou liquor quando indicados para afastar outros diagnósticos de rebaixamento da consciência (cap. 8, p. 134)' },
]

export const quatroAt: Escore = {
  ficha: {
    id: '4at-delirium',
    titulo: '4AT — rastreio de delirium no idoso',
    versao: '2026-11-14.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Bellelli G, Morandi A, Davis DH, et al. Validation of the 4AT, a new instrument for rapid delirium screening: a study in 234 hospitalised older people. Age Ageing. 2014;43(4):496–502 (PMID 24590568): leitura dos escores; sensibilidade 89,7%, especificidade 84,1%.', url: 'https://doi.org/10.1093/ageing/afu021' },
      { citacao: 'Shenkin SD, Fox C, Godfrey M, et al. Delirium detection in older acute medical inpatients: a multicentre prospective comparative diagnostic test accuracy study of the 4AT and the CAM. BMC Med. 2019;17(1):138 (PMID 31337404): pontuação de cada item.', url: 'https://doi.org/10.1186/s12916-019-1367-9' },
      GED_DELIRIUM_2025,
    ],
    revisadoEm: '14/11/2026 (diretrizes geriátricas de PS 2.0, delirium, ao lado do manual, pelo resumo; lote 7 da revisão do HCFMUSP; aguarda aprovação do RT); 23/10/2026 (lacunas da Central, lote 1; pontos conferidos no texto da fonte)',
  },
  descricao: 'Idoso no pronto-socorro: alerta, AMT4, meses de trás para frente e mudança aguda ou curso flutuante.',
  itens: [
    { tipo: 'escolha', id: 'alerta', rotulo: '1. Alerta', opcoes: [{ rotulo: 'Normal', valor: 0 }, { rotulo: 'Alterado', valor: 4 }] },
    { tipo: 'escolha', id: 'amt4', rotulo: '2. AMT4 (teste mental abreviado de quatro perguntas)', opcoes: [{ rotulo: 'Sem erro', valor: 0 }, { rotulo: '1 erro', valor: 1 }, { rotulo: '2 ou mais erros, ou não testável', valor: 2 }] },
    { tipo: 'escolha', id: 'meses', rotulo: '3. Meses do ano de trás para frente', opcoes: [{ rotulo: 'Diz 7 meses ou mais corretamente', valor: 0 }, { rotulo: 'Não completa 7 meses', valor: 1 }, { rotulo: 'Não testável', valor: 2 }] },
    { tipo: 'escolha', id: 'aguda', rotulo: '4. Mudança aguda ou curso flutuante', opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 4 }] },
  ],
  calcular(r) {
    if (!completo(quatroAt, r)) return null
    const v = somar(quatroAt, r)
    return {
      rotulo: '4AT',
      valor: String(v),
      unidade: 'de 12',
      nota: v >= 4 ? '4 ou mais: possível delirium' : v >= 1 ? '1 a 3: possível comprometimento cognitivo' : '0: delirium e comprometimento cognitivo moderado a grave improváveis',
      estado: v >= 4 ? 2 : v >= 1 ? 1 : 0,
      derivados: [],
      cuidados: [
        'É rastreio, não diagnóstico: o diagnóstico de delirium pede avaliação clínica.',
        'Demência avançada pode somar 4 só pelos itens cognitivos.',
        'Não é para criança.',
      ],
    }
  },
}
