// A cor de identidade de cada seção da Central (P/index.html COR_SECAO; os
// tokens --color-secao-* moram em src/index.css). "A mesma matiz sempre na
// mesma seção, do jeito que o verde do ECG é sempre o ECG." As seções do app
// que o protótipo não tem pegam a matiz da vizinha mais próxima; nenhuma cor
// nova. As classes são escritas por extenso para o Tailwind enxergá-las.

export type CoresSecao = { texto: string; bloco: string; icone: string }

const C = {
  calculadoras: { texto: 'text-secao-calculadoras', bloco: 'border-secao-calculadoras/20 bg-secao-calculadoras/[0.08]', icone: 'bg-secao-calculadoras/15 text-secao-calculadoras' },
  pediatria: { texto: 'text-pediatria', bloco: 'border-pediatria/20 bg-pediatria/[0.08]', icone: 'bg-pediatria/15 text-pediatria' },
  trauma: { texto: 'text-secao-trauma', bloco: 'border-secao-trauma/20 bg-secao-trauma/[0.08]', icone: 'bg-secao-trauma/15 text-secao-trauma' },
  neurologia: { texto: 'text-secao-neurologia', bloco: 'border-secao-neurologia/20 bg-secao-neurologia/[0.08]', icone: 'bg-secao-neurologia/15 text-secao-neurologia' },
  protocolos: { texto: 'text-secao-protocolos', bloco: 'border-secao-protocolos/20 bg-secao-protocolos/[0.08]', icone: 'bg-secao-protocolos/15 text-secao-protocolos' },
  farmacia: { texto: 'text-secao-farmacia', bloco: 'border-secao-farmacia/20 bg-secao-farmacia/[0.08]', icone: 'bg-secao-farmacia/15 text-secao-farmacia' },
  gastro: { texto: 'text-secao-gastro', bloco: 'border-secao-gastro/20 bg-secao-gastro/[0.08]', icone: 'bg-secao-gastro/15 text-secao-gastro' },
  games: { texto: 'text-secao-games', bloco: 'border-secao-games/20 bg-secao-games/[0.08]', icone: 'bg-secao-games/15 text-secao-games' },
  ventilacao: { texto: 'text-secao-ventilacao', bloco: 'border-secao-ventilacao/20 bg-secao-ventilacao/[0.08]', icone: 'bg-secao-ventilacao/15 text-secao-ventilacao' },
  cardiologia: { texto: 'text-secao-cardiologia', bloco: 'border-secao-cardiologia/20 bg-secao-cardiologia/[0.08]', icone: 'bg-secao-cardiologia/15 text-secao-cardiologia' },
  terapiaIntensiva: { texto: 'text-secao-terapia-intensiva', bloco: 'border-secao-terapia-intensiva/20 bg-secao-terapia-intensiva/[0.08]', icone: 'bg-secao-terapia-intensiva/15 text-secao-terapia-intensiva' },
  toxicologia: { texto: 'text-secao-toxicologia', bloco: 'border-secao-toxicologia/20 bg-secao-toxicologia/[0.08]', icone: 'bg-secao-toxicologia/15 text-secao-toxicologia' },
  endocrinologia: { texto: 'text-secao-endocrinologia', bloco: 'border-secao-endocrinologia/20 bg-secao-endocrinologia/[0.08]', icone: 'bg-secao-endocrinologia/15 text-secao-endocrinologia' },
} satisfies Record<string, CoresSecao>

const POR_SECAO: Record<string, CoresSecao> = {
  calculadoras: C.calculadoras,
  'infusoes-adulto': C.calculadoras,
  pediatria: C.pediatria,
  'infusoes-pediatria': C.pediatria,
  emergencias: C.trauma,
  trauma: C.trauma,
  escores: C.neurologia,
  neurologia: C.neurologia,
  protocolos: C.protocolos,
  farmacia: C.farmacia,
  dengue: C.gastro,
  gastro: C.gastro,
  games: C.games,
  'ventilacao-mecanica': C.ventilacao,
  cardiologia: C.cardiologia,
  'terapia-intensiva': C.terapiaIntensiva,
  toxicologia: C.toxicologia,
  endocrinologia: C.endocrinologia,
}

export const coresDaSecao = (slug: string): CoresSecao => POR_SECAO[slug] ?? C.calculadoras
