import { completo, escolha, somar, type Escore } from '../escore.ts'

// FOUR Score: quatro domínios de 0 a 4. Porte do protótipo (neurologia/FOUR,
// construído em 29/08/2026). Não havia conduta a retirar.

const opcoes = (rotulos: string[]) => rotulos.map((rotulo, i) => ({ rotulo, valor: 4 - i }))

export const four: Escore = {
  ficha: {
    id: 'four',
    titulo: 'FOUR Score — consciência no paciente crítico',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Wijdicks EFM, Bamlet WR, Maramattom BV, et al. Validation of a new coma scale: the FOUR score. Ann Neurol. 2005;58(4):585–593.', url: 'https://doi.org/10.1002/ana.20611' },
      { citacao: 'Iyer VN, Mandrekar JN, Danielson RD, et al. Validity of the FOUR score coma scale in the medical intensive care unit. Mayo Clin Proc. 2009;84(8):694–701.', url: 'https://doi.org/10.1016/S0025-6196(11)60519-3' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Quatro domínios de 0 a 4, sem depender de resposta verbal',
  itens: [
    { tipo: 'escolha', id: 'olhos', rotulo: 'Resposta ocular', opcoes: opcoes([
      '4 — pálpebras abertas, acompanha ou pisca a comando',
      '3 — pálpebras abertas, não acompanha',
      '2 — abre ao chamado forte',
      '1 — abre à dor',
      '0 — não abre nem à dor',
    ]) },
    { tipo: 'escolha', id: 'motor', rotulo: 'Resposta motora', opcoes: opcoes([
      '4 — faz sinal com a mão a comando',
      '3 — localiza a dor',
      '2 — flexão à dor',
      '1 — extensão à dor',
      '0 — nenhuma, ou mioclonia generalizada',
    ]) },
    { tipo: 'escolha', id: 'tronco', rotulo: 'Reflexos de tronco', opcoes: opcoes([
      '4 — pupilar e corneano presentes',
      '3 — uma pupila fixa e dilatada',
      '2 — pupilar ou corneano ausente',
      '1 — pupilar e corneano ausentes',
      '0 — pupilar, corneano e tosse ausentes',
    ]) },
    { tipo: 'escolha', id: 'resp', rotulo: 'Respiração', opcoes: opcoes([
      '4 — não intubado, padrão regular',
      '3 — não intubado, padrão de Cheyne-Stokes',
      '2 — não intubado, padrão irregular',
      '1 — intubado, respira acima da frequência do ventilador',
      '0 — intubado, respira na frequência do ventilador ou apneia',
    ]) },
  ],
  calcular(r) {
    if (!completo(four, r)) return null
    const v = (id: string) => escolha(four, r, id)!.valor
    const total = somar(four, r)
    const banda = total <= 4 ? 2 : total <= 11 ? 1 : 0
    return {
      rotulo: 'FOUR',
      valor: String(total),
      unidade: 'de 16',
      nota: ['rebaixamento leve', 'rebaixamento importante', 'rebaixamento grave'][banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Ocular', v('olhos') + ' de 4'],
        ['Motor', v('motor') + ' de 4'],
        ['Tronco', v('tronco') + ' de 4'],
        ['Respiração', v('resp') + ' de 4'],
      ],
      alerta: v('olhos') === 0 && v('motor') === 0 && v('tronco') === 0
        ? 'Todos os domínios de exame em zero. Isso levanta a suspeita de morte encefálica — que se confirma pelo protocolo próprio, não por esta escala.'
        : undefined,
      cuidados: [
        'Motor 4 exige um gesto específico a comando — polegar, punho ou sinal de paz. Movimento inespecífico não conta.',
        'A resposta ocular 4 distingue síndrome do cativeiro de coma: o paciente acompanha ou pisca a comando com o resto do exame abolido.',
        'A pontuação respiratória depende de saber se o paciente está intubado e qual a frequência programada.',
        'Zero em todos os domínios não é diagnóstico de morte encefálica.',
      ],
    }
  },
}
