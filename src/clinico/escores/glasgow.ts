import { completo, escolha, type Escore } from '../escore.ts'

// Glasgow com GCS-P (total menos pupilas não reativas, mínimo 1). Componente
// não testável entra com o mínimo por convenção e é registrado como NT.
// Porte do protótipo (neurologia/Glasgow, revisado em 29/08/2026).

export const glasgow: Escore = {
  ficha: {
    id: 'glasgow',
    titulo: 'Escala de Coma de Glasgow (GCS-P)',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Teasdale G, Jennett B. Assessment of coma and impaired consciousness. A practical scale. Lancet. 1974;2(7872):81–84.', url: 'https://doi.org/10.1016/S0140-6736(74)91639-0' },
      { citacao: 'Brennan PM, Murray GD, Teasdale GM. Simplifying the use of prognostic information in traumatic brain injury. Part 1: the GCS-Pupils score. J Neurosurg. 2018;128(6):1612–1620.', url: 'https://doi.org/10.3171/2017.12.JNS172780' },
      { citacao: 'Manley GT, et al. Best Practices in the Management of Traumatic Brain Injury. American College of Surgeons. 2024.' },
    ],
    revisadoEm: '27/09/2026 (porte da versão de 29/08/2026 do protótipo)',
  },
  descricao: 'Abertura ocular, resposta verbal e resposta motora, com o GCS-P pelas pupilas.',
  itens: [
    { tipo: 'escolha', id: 'ocular', rotulo: 'Abertura ocular', opcoes: [
      { rotulo: '4 — espontânea', valor: 4 }, { rotulo: '3 — ao chamado', valor: 3 }, { rotulo: '2 — à dor', valor: 2 },
      { rotulo: '1 — nenhuma', valor: 1 }, { rotulo: 'Não testável — órbita fechada, trauma facial', valor: 1, naoTestavel: true },
    ] },
    { tipo: 'escolha', id: 'verbal', rotulo: 'Resposta verbal', opcoes: [
      { rotulo: '5 — orientado', valor: 5 }, { rotulo: '4 — confuso', valor: 4 }, { rotulo: '3 — palavras desconexas', valor: 3 },
      { rotulo: '2 — sons incompreensíveis', valor: 2 }, { rotulo: '1 — nenhuma', valor: 1 }, { rotulo: 'Não testável — intubado (T)', valor: 1, naoTestavel: true },
    ] },
    { tipo: 'escolha', id: 'motora', rotulo: 'Resposta motora', opcoes: [
      { rotulo: '6 — obedece a comando', valor: 6 }, { rotulo: '5 — localiza a dor', valor: 5 }, { rotulo: '4 — retirada à dor', valor: 4 },
      { rotulo: '3 — flexão anormal', valor: 3 }, { rotulo: '2 — extensão anormal', valor: 2 }, { rotulo: '1 — nenhuma', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'pupilas', rotulo: 'Pupilas não reativas', opcoes: [
      { rotulo: 'Nenhuma — as duas reagem', valor: 0 }, { rotulo: 'Uma', valor: 1 }, { rotulo: 'Duas', valor: 2 },
    ] },
  ],
  calcular(r) {
    if (!completo(glasgow, r)) return null
    const o = escolha(glasgow, r, 'ocular')!
    const v = escolha(glasgow, r, 'verbal')!
    const m = escolha(glasgow, r, 'motora')!
    const pup = escolha(glasgow, r, 'pupilas')!.valor
    const total = o.valor + v.valor + m.valor
    const gcsP = Math.max(1, total - pup)
    const banda = total <= 8 ? 2 : total <= 12 ? 1 : 0
    const comp = `${o.naoTestavel ? 'O-NT' : 'O' + o.valor} ${v.naoTestavel ? 'V-NT' : 'V' + v.valor} M${m.valor}`
    const nt = o.naoTestavel || v.naoTestavel
    return {
      rotulo: 'Glasgow',
      valor: String(total) + (v.naoTestavel ? 'T' : ''),
      unidade: 'de 15',
      nota: ['trauma leve', 'trauma moderado', 'trauma grave'][banda] + (pup ? ` · GCS-P ${gcsP}` : ''),
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Componentes — registre assim', comp],
        ['GCS-P', pup ? `${gcsP} · ${total} menos ${pup} ${pup === 1 ? 'pupila não reativa' : 'pupilas não reativas'}` : `${total} · as duas pupilas reagem, sem subtração`],
        ['Faixa', ['13 a 15 pontos', '9 a 12 pontos', '3 a 8 pontos'][banda]],
      ],
      alerta: nt
        ? `Componente marcado como não testável. Ele entra na soma com o valor mínimo por convenção, mas o registro correto é "${comp}" — um total com componente não testável não é comparável a um total completo.`
        : pup === 2 && total === 3
          ? 'Glasgow 3 com as duas pupilas arreativas dá GCS-P 1, o extremo da escala — é para distinguir essa faixa que o GCS-P existe.'
          : undefined,
      cuidados: [
        'Registre os três componentes na evolução, não só o total — recomendação atual do American College of Surgeons.',
        'Escala de adulto. Para a criança pré-verbal existe o Glasgow pediátrico, que é outra escala — não é conversão, e esta tela não a faz.',
        'Em trauma, o escore vale depois de corrigir hipoxemia e hipotensão: as duas rebaixam o Glasgow sozinhas.',
        'O que importa é a tendência entre medidas, não o valor isolado.',
      ],
    }
  },
}
