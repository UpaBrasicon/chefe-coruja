import { completo, escolha, type Escore, type Respostas } from '../escore.ts'

// TEN-4-FACESp: hematomas suspeitos de maus-tratos na criança abaixo de 4 anos
// (escores P2/P3, item P8; decisão A do RT em 11/11/2026; diagnóstico em
// docs/clinico/ESCORES-P2-P3-DIAGNOSTICO.md). Regra conferida no texto completo
// do Pierce 2021 (PMC8047759): positiva com qualquer um dos componentes
//   • TEN: hematoma no tronco (tórax, abdome, dorso, nádegas, região genital),
//     na orelha ou no pescoço;
//   • FACES: frênulo, ângulo da mandíbula, bochecha (parte carnosa), pálpebra
//     ou hemorragia subconjuntival;
//   • 4: qualquer hematoma em lactente de 4,99 meses ou menos;
//   • p: hematoma com padrão.
// É rastreio, não diagnóstico (ADR 0007: a tela dá a regra; a conduta é do
// médico). Sem dose.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const sim = (e: Escore, r: Respostas, id: string) => escolha(e, r, id)!.valor === 1

const COMPONENTES: [string, string][] = [
  ['ten', 'TEN (tronco, orelha ou pescoço)'],
  ['faces', 'FACES (face)'],
  ['quatro', '4 (lactente de até 4,99 meses)'],
  ['padrao', 'p (hematoma com padrão)'],
]

export const ten4Facesp: Escore = {
  ficha: {
    id: 'ped-ten-4-facesp',
    titulo: 'TEN-4-FACESp — hematomas suspeitos de maus-tratos (criança abaixo de 4 anos)',
    versao: '2026-11-11.1',
    publico: 'pediatrico',
    fontes: [
      { citacao: 'Pierce MC, Kaczor K, Lorenz DJ, et al. Validation of a Clinical Decision Rule to Predict Abuse in Young Children Based on Bruising Characteristics. JAMA Netw Open. 2021;4(4):e215832 (PMID 33852003, texto completo): componentes da regra e desempenho (sensibilidade 95,6%, especificidade 87,1%, VPN 98,8%).', url: 'https://doi.org/10.1001/jamanetworkopen.2021.5832', pediatrica: true },
      { citacao: 'Raut A, Pierce MC, Kaczor K, et al. Single Bruise Characteristics Associated With Abusive vs Accidental Injury. Pediatrics. 2025 (PMID 39961331, só o resumo): com hematoma único, sensibilidade de 81,5%.', url: 'https://doi.org/10.1542/peds.2024-067932', pediatrica: true },
    ],
    revisadoEm: '11/11/2026 (escores P2/P3, item P8; regra conferida no texto completo do Pierce 2021)',
  },
  descricao: 'Criança abaixo de 4 anos com hematoma: regra positiva com hematoma no tronco, orelha, pescoço ou face, em lactente de até 4,99 meses, ou com padrão.',
  itens: [
    { tipo: 'escolha', id: 'aplica', rotulo: 'Criança abaixo de 4 anos com pelo menos um hematoma', ajuda: 'A regra não se aplica à criança sem hematoma.', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'ten', rotulo: 'TEN: hematoma no tronco, na orelha ou no pescoço', ajuda: 'Tronco: tórax, abdome, dorso, nádegas e região genital.', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'faces', rotulo: 'FACES: hematoma no frênulo, no ângulo da mandíbula, na bochecha (parte carnosa), na pálpebra, ou hemorragia subconjuntival', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'quatro', rotulo: '4: qualquer hematoma em lactente de 4,99 meses ou menos', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'padrao', rotulo: 'p: hematoma com padrão', ajuda: 'Por exemplo: mordida, alça, marca de mão ou de tapa, aperto ou preensão, várias linhas paralelas.', opcoes: NAO_SIM },
  ],
  calcular(r) {
    const e = ten4Facesp
    if (!completo(e, r)) return null
    const cuidados = [
      'Rastreio, não diagnóstico. Regra negativa não exclui maus-tratos, sobretudo com hematoma único (Raut 2025: sensibilidade de 81,5%).',
      'Validada em 5 prontos-socorros pediátricos dos Estados Unidos; sem validação no Brasil.',
      'Hematoma é mais difícil de ver em pele escura: examine com boa luz e por inteiro.',
    ]
    if (!sim(e, r, 'aplica')) {
      return { rotulo: 'TEN-4-FACESp', valor: 'Não se aplica', nota: 'a regra vale só para criança abaixo de 4 anos com hematoma', estado: 0, derivados: [], cuidados }
    }
    const presentes = COMPONENTES.filter(([id]) => sim(e, r, id)).map(([, rotulo]) => rotulo)
    const positiva = presentes.length > 0
    return {
      rotulo: 'TEN-4-FACESp',
      valor: positiva ? 'Regra positiva' : 'Regra negativa',
      nota: positiva ? 'hematoma suspeito: avaliar maus-tratos' : 'não exclui maus-tratos',
      estado: positiva ? 2 : 0,
      derivados: [
        ['Componentes presentes', positiva ? presentes.join('; ') : 'nenhum'],
        ['Desempenho na validação', 'sensibilidade 95,6%, especificidade 87,1%'],
      ],
      alerta: positiva
        ? 'Suspeita de violência contra a criança: veja a notificação "Violência doméstica e/ou outras violências" na lista de notificação compulsória.'
        : undefined,
      cuidados,
    }
  },
}
