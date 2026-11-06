import { completo, escolha, type Escore } from '../escore.ts'
import type { Fonte } from '../ficha.ts'

// Canadian CT Head Rule: cinco critérios de alto risco e dois de risco médio.
// Porte do protótipo (trauma/Canadian CT Head, construído em 29/08/2026).
// No protótipo os critérios eram marcáveis; aqui são Não/Sim obrigatórios
// para que "regra negativa" só saia com os sete respondidos.
// Saíram (ADR 0007) o valor "Tomografia indicada", a linha "Conduta", o
// "avise a neurocirurgia", "nesses casos, tomografia direto" e "regra
// negativa não é alta imediata": fica regra positiva/negativa e o risco.
// Versão de 06/11/2026 (revisão PubMed, itens médios): nota da validação
// externa japonesa (2026), pelo resumo. Os critérios não mudam.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const ALTO = ['glasgow', 'fraturaAberta', 'fraturaBase', 'vomitos', 'idade65']
const MEDIO = ['amnesia', 'mecanismo']

export const KIMOTO_HELMET_2026: Fonte = {
  citacao: 'Kimoto K, Ogura T, Goto T, et al. External validation and extended application of four clinical decision rules in minor head injuries. Am J Emerg Med. 2026;104:34–39 (PMID 41791185).',
  url: 'https://doi.org/10.1016/j.ajem.2026.02.029',
}

export const NOTA_CCHR_JAPAO =
  'Validação externa no Japão (HELMET, 2026): estudo prospectivo em 5 centros, adultos com Glasgow de 13 a 15 até 24 h após trauma craniano contuso, numa coorte ampliada que inclui pacientes que ficariam fora da derivação original; 1.706 com dados completos, mediana de 71 anos. Para lesão intracraniana na TC, a regra teve sensibilidade de 91,1% e especificidade de 33,8%. Os autores concluem que ela não serve sozinha para dispensar a TC nessa população, só como apoio ao julgamento clínico.'

export const canadianCtHead: Escore = {
  ficha: {
    id: 'canadian-ct-head',
    titulo: 'Canadian CT Head Rule — TCE leve no adulto',
    versao: '2026-11-06.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Stiell IG, Wells GA, Vandemheen K, et al. The Canadian CT Head Rule for patients with minor head injury. Lancet. 2001;357(9266):1391–1396.', url: 'https://doi.org/10.1016/S0140-6736(00)04561-X' },
      { citacao: 'Stiell IG, Clement CM, Rowe BH, et al. Comparison of the Canadian CT Head Rule and the New Orleans Criteria in patients with minor head injury. JAMA. 2005;294(12):1511–1518.', url: 'https://doi.org/10.1001/jama.294.12.1511' },
      KIMOTO_HELMET_2026,
    ],
    revisadoEm: '06/11/2026 (nota da validação japonesa; revisão PubMed, itens médios; porte do protótipo em 27/09/2026)',
  },
  descricao: 'TCE leve no adulto: cinco critérios de alto risco e dois de risco médio',
  itens: [
    { tipo: 'escolha', id: 'glasgow', rotulo: 'Alto risco — Glasgow abaixo de 15 duas horas após o trauma', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'fraturaAberta', rotulo: 'Alto risco — suspeita de fratura de crânio aberta ou com afundamento', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'fraturaBase', rotulo: 'Alto risco — qualquer sinal de fratura de base de crânio', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'vomitos', rotulo: 'Alto risco — dois ou mais episódios de vômito', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'idade65', rotulo: 'Alto risco — idade de 65 anos ou mais', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'amnesia', rotulo: 'Risco médio — amnésia retrógrada de 30 minutos ou mais', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'mecanismo', rotulo: 'Risco médio — mecanismo perigoso', ajuda: 'Atropelamento, ejeção de veículo, queda de mais de um metro ou de cinco degraus.', opcoes: NAO_SIM },
  ],
  calcular(r) {
    if (!completo(canadianCtHead, r)) return null
    const conta = (ids: string[]) => ids.filter((id) => escolha(canadianCtHead, r, id)!.valor === 1).length
    const a = conta(ALTO)
    const b = conta(MEDIO)
    const positiva = a + b > 0
    const partes = [
      a ? a + (a === 1 ? ' critério de alto risco' : ' critérios de alto risco') : '',
      b ? b + (b === 1 ? ' de risco médio' : ' de risco médio') : '',
    ].filter(Boolean)
    return {
      rotulo: 'Canadian CT Head',
      valor: positiva ? 'Regra positiva' : 'Regra negativa',
      nota: positiva
        ? (a ? 'alto risco' : 'risco médio') + ' · ' + partes.join(' e ')
        : 'nenhum critério presente',
      estado: positiva ? (a ? 2 : 1) : 0,
      derivados: [
        ['Critérios de alto risco', a + ' de 5'],
        ['Critérios de risco médio', b + ' de 2'],
        ['Sensibilidade da regra', 'próxima de 100% para lesão que exige intervenção'],
      ],
      alerta: a
        ? 'Critério de alto risco presente. Na regra, os critérios de alto risco predizem necessidade de intervenção neurocirúrgica; os de risco médio predizem lesão cerebral na tomografia.'
        : undefined,
      cuidados: [
        'Vale para o traumatismo craniano leve do adulto: Glasgow de 13 a 15, com perda de consciência, amnésia ou desorientação testemunhadas. Os critérios de alto risco são avaliados duas horas após o trauma.',
        'Não se aplica abaixo de 16 anos, em anticoagulação ou distúrbio de coagulação, com fratura aberta evidente, ou após convulsão pós-traumática.',
        'Na criança a regra de referência é outra (PECARN).',
        NOTA_CCHR_JAPAO,
      ],
    }
  },
}
