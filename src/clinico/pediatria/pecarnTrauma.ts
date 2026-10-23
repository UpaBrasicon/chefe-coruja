import { completo, escolha, type Escore, type Respostas } from '../escore.ts'

// PECARN de trauma contuso na criança (lacunas da Central, lote 1, 23/10/2026).
// Conferido no texto:
//   • coluna cervical (Leonard 2024): quatro fatores de alto risco (Glasgow 3–8
//     ou AVPU "não responde"; via aérea, respiração ou circulação alteradas;
//     déficit neurológico focal) e cinco de risco não desprezível (dor cervical;
//     alteração do estado mental; lesão substancial de tronco; lesão substancial
//     de cabeça; dor à palpação na linha média posterior do pescoço). No
//     algoritmo do estudo: alto risco → TC; só risco não desprezível →
//     radiografia; nenhum fator → liberação clínica sem imagem.
//   • lesão intra-abdominal (Holmes 2013, validada em 2024): sete achados; risco
//     muito baixo só com os sete ausentes. Regra positiva não obriga TC (o texto
//     da validação chama isso de uso inadequado da regra).
// ADR 0007: a tela dá a faixa de risco; o que o estudo faz com ela é referência.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const sim = (e: Escore, r: Respostas, id: string) => escolha(e, r, id)!.valor === 1
const REVISADO = '23/10/2026 (lacunas da Central, lote 1; fatores conferidos no texto da fonte)'

const ALTO = ['consciencia', 'abc', 'deficit']
const NAO_DESPREZIVEL = ['dorCervical', 'estadoMental', 'tronco', 'cabeca', 'linhaMedia']

export const pecarnCervical: Escore = {
  ficha: {
    id: 'ped-pecarn-coluna-cervical',
    titulo: 'PECARN — coluna cervical no trauma contuso (criança)',
    versao: '2026-10-23.1',
    publico: 'pediatrico',
    fontes: [
      { citacao: 'Leonard JC, Harding M, Cook LJ, et al. PECARN prediction rule for cervical spine imaging of children presenting to the emergency department with blunt trauma: a multicentre prospective observational study. Lancet Child Adolesc Health. 2024;8(7):482–490 (PMID 38843852): fatores, algoritmo e desempenho (sensibilidade 94,3%, VPN 99,9%).', url: 'https://doi.org/10.1016/S2352-4642(24)00104-4', pediatrica: true },
    ],
    revisadoEm: REVISADO,
  },
  descricao: 'Trauma contuso de 0 a 17 anos: quatro fatores de alto risco e cinco de risco não desprezível para lesão da coluna cervical.',
  itens: [
    { tipo: 'escolha', id: 'consciencia', rotulo: 'Alto risco — Glasgow de 3 a 8, ou não responde (AVPU)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'abc', rotulo: 'Alto risco — via aérea, respiração ou circulação alteradas', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'deficit', rotulo: 'Alto risco — déficit neurológico focal (parestesia, dormência ou fraqueza)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'dorCervical', rotulo: 'Dor cervical', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'estadoMental', rotulo: 'Alteração do estado mental', ajuda: 'Glasgow de 9 a 14, AVPU "verbal" ou "dor", ou outro sinal de alteração.', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'tronco', rotulo: 'Lesão substancial de tronco', ajuda: 'Substancial: que justificaria observação em internação ou cirurgia.', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'cabeca', rotulo: 'Lesão substancial de cabeça', ajuda: 'Substancial: que justificaria observação em internação ou cirurgia.', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'linhaMedia', rotulo: 'Dor à palpação na linha média posterior do pescoço', opcoes: NAO_SIM },
  ],
  calcular(r) {
    const e = pecarnCervical
    if (!completo(e, r)) return null
    const alto = ALTO.filter((id) => sim(e, r, id)).length
    const outros = NAO_DESPREZIVEL.filter((id) => sim(e, r, id)).length
    const faixa = alto ? 'Alto risco' : outros ? 'Risco não desprezível' : 'Sem fator de risco'
    return {
      rotulo: 'PECARN coluna cervical',
      valor: faixa,
      nota: alto
        ? 'no algoritmo do estudo, tomografia'
        : outros
          ? 'no algoritmo do estudo, radiografia simples'
          : 'no algoritmo do estudo, liberação clínica sem imagem',
      estado: alto ? 2 : outros ? 1 : 0,
      derivados: [
        ['Fatores de alto risco', `${alto} de 3 grupos`],
        ['Fatores de risco não desprezível', `${outros} de 5`],
        ['Desempenho na validação', 'sensibilidade 94,3%, VPN 99,9%'],
      ],
      alerta: alto ? 'No estudo, 12,7% das crianças com algum fator de alto risco tinham lesão da coluna cervical.' : undefined,
      cuidados: [
        'Validada em 18 prontos-socorros pediátricos dos Estados Unidos, de 0 a 17 anos; ainda sem validação fora da rede do estudo.',
        'Não avalia a necessidade de ressonância.',
      ],
    }
  },
}

const ABDOME = ['paredeAbdominal', 'glasgow', 'palpacao', 'paredeToracica', 'queixaDor', 'murmurio', 'vomitos']

export const pecarnAbdome: Escore = {
  ficha: {
    id: 'ped-pecarn-abdome',
    titulo: 'PECARN — lesão intra-abdominal no trauma contuso (criança)',
    versao: '2026-10-23.1',
    publico: 'pediatrico',
    fontes: [
      { citacao: 'Holmes JF, Lillis K, Monroe D, et al. Identifying children at very low risk of clinically important blunt abdominal injuries. Ann Emerg Med. 2013;62(2):107–116.e2 (PMID 23375510): os sete achados.', url: 'https://doi.org/10.1016/j.annemergmed.2012.11.009', pediatrica: true },
      { citacao: 'Holmes JF, Yen K, Ugalde IT, et al. PECARN prediction rules for CT imaging of children presenting to the emergency department with blunt abdominal or minor head trauma: a multicentre prospective validation study. Lancet Child Adolesc Health. 2024;8(5):339–347 (PMID 38609287): sensibilidade e VPN de 100%.', url: 'https://doi.org/10.1016/S2352-4642(24)00029-4', pediatrica: true },
    ],
    revisadoEm: REVISADO,
  },
  descricao: 'Trauma contuso de tronco abaixo de 18 anos: sete achados de história e exame; risco muito baixo só com os sete ausentes.',
  itens: [
    { tipo: 'escolha', id: 'paredeAbdominal', rotulo: 'Sinal de trauma na parede abdominal ou sinal do cinto', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'glasgow', rotulo: 'Glasgow de 13 ou menos', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'palpacao', rotulo: 'Dor à palpação abdominal', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'paredeToracica', rotulo: 'Sinal de trauma na parede torácica', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'queixaDor', rotulo: 'Queixa de dor abdominal', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'murmurio', rotulo: 'Murmúrio vesicular diminuído', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'vomitos', rotulo: 'Vômitos', opcoes: NAO_SIM },
  ],
  calcular(r) {
    const e = pecarnAbdome
    if (!completo(e, r)) return null
    const n = ABDOME.filter((id) => sim(e, r, id)).length
    return {
      rotulo: 'PECARN abdome',
      valor: n ? 'Risco não desprezível' : 'Risco muito baixo',
      nota: n ? `${n} de 7 achados presentes` : 'nenhum dos sete achados: risco muito baixo de lesão que exige intervenção',
      estado: n ? 1 : 0,
      derivados: [
        ['Achados presentes', `${n} de 7`],
        ['Desempenho na validação (2024)', 'sensibilidade 100% (145 de 145), VPN 100%'],
      ],
      cuidados: [
        'Regra positiva não obriga tomografia: no texto da validação, pedir TC para toda criança com regra positiva é uso inadequado da regra.',
        'Intervenção aguda, no estudo: laparotomia terapêutica, embolização, transfusão por hemorragia abdominal ou hidratação venosa por 2 noites ou mais por lesão de pâncreas ou do trato gastrointestinal.',
        'Validada abaixo de 18 anos em centros de trauma pediátrico dos Estados Unidos; excluídos gestantes, trauma penetrante e lesão com mais de 24 horas.',
      ],
    }
  },
}
