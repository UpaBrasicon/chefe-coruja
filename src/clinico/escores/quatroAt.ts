import { completo, somar, type Escore } from '../escore.ts'

// 4AT — rastreio rápido de delirium no idoso (lacunas da Central, lote 1,
// 23/10/2026). Conferido no texto: alerta e mudança aguda/curso flutuante valem
// 0 ou 4; AMT4 vale 1 com um erro e 2 com dois ou mais ou se não testável; meses
// de trás para frente valem 1 se não completa 7 meses e 2 se não testável
// (Shenkin 2019). Leitura: 0 improvável; 1 a 3 possível comprometimento
// cognitivo; 4 ou mais possível delirium (Bellelli 2014). As quatro perguntas do
// AMT4 estão no formulário oficial e não foram conferidas em texto: não entram.

export const quatroAt: Escore = {
  ficha: {
    id: '4at-delirium',
    titulo: '4AT — rastreio de delirium no idoso',
    versao: '2026-10-23.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Bellelli G, Morandi A, Davis DH, et al. Validation of the 4AT, a new instrument for rapid delirium screening: a study in 234 hospitalised older people. Age Ageing. 2014;43(4):496–502 (PMID 24590568): leitura dos escores; sensibilidade 89,7%, especificidade 84,1%.', url: 'https://doi.org/10.1093/ageing/afu021' },
      { citacao: 'Shenkin SD, Fox C, Godfrey M, et al. Delirium detection in older acute medical inpatients: a multicentre prospective comparative diagnostic test accuracy study of the 4AT and the CAM. BMC Med. 2019;17(1):138 (PMID 31337404): pontuação de cada item.', url: 'https://doi.org/10.1186/s12916-019-1367-9' },
    ],
    revisadoEm: '23/10/2026 (lacunas da Central, lote 1; pontos conferidos no texto da fonte)',
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
