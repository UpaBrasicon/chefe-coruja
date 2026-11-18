// Guia de parada e reanimação da criança (construído com o RT; protótipo
// aprovado em 18/11/2026, G1–G5 = A). Abas por situação; cada grupo lista doses
// do módulo ped-doses-fita (src/clinico/pediatria/dosesDaFita.ts) pelo id, ou os
// choques pelo peso. Nenhum número fica aqui: só a ordem da tela.

export type SituacaoParada = 'pcr' | 'bradicardia' | 'taquicardia' | 'intubacao' | 'dispositivos' | 'rcp'

export type GrupoParada = { titulo: string; choque: 'desfibrilacao' | 'cardioversao' } | { titulo: string; doses: string[] }

export const SITUACOES_PARADA: { id: SituacaoParada; nome: string; grupos: GrupoParada[] }[] = [
  {
    id: 'pcr', nome: 'Parada',
    grupos: [
      { titulo: 'Choque (FV ou TV sem pulso)', choque: 'desfibrilacao' },
      { titulo: 'Drogas da parada', doses: ['fita-epinefrina-iv', 'fita-amiodarona', 'fita-lidocaina'] },
      { titulo: 'Causas reversíveis', doses: ['fita-glicose', 'fita-cloreto-calcio', 'fita-gluconato-calcio', 'fita-bicarbonato', 'fita-magnesio-torsades'] },
    ],
  },
  {
    id: 'bradicardia', nome: 'Bradicardia',
    grupos: [{ titulo: 'Drogas', doses: ['fita-epinefrina-iv', 'fita-atropina'] }],
  },
  {
    id: 'taquicardia', nome: 'Taquicardia',
    grupos: [
      { titulo: 'Cardioversão sincronizada', choque: 'cardioversao' },
      { titulo: 'TSV', doses: ['fita-adenosina-1', 'fita-adenosina-2'] },
      { titulo: 'Torsades de pointes', doses: ['fita-magnesio-torsades'] },
    ],
  },
  {
    id: 'intubacao', nome: 'Intubação',
    grupos: [
      { titulo: 'Pré-medicação', doses: ['fita-atropina-iot'] },
      { titulo: 'Sedação', doses: ['fita-etomidato', 'fita-cetamina-iv', 'fita-cetamina-im', 'fita-propofol'] },
      {
        titulo: 'Bloqueio neuromuscular',
        doses: ['fita-succinilcolina-lactente', 'fita-succinilcolina-crianca', 'fita-succinilcolina-im-lactente', 'fita-succinilcolina-im-crianca', 'fita-rocuronio'],
      },
    ],
  },
  // G2 (DP1–DP6): dispositivos pela cor, do módulo ped-dispositivos-fita
  { id: 'dispositivos', nome: 'Dispositivos', grupos: [] },
  { id: 'rcp', nome: 'RCP', grupos: [] },
]

/** Ferramentas completas abertas pelo fim da tela (G4: neonatal continua separada). */
export const FERRAMENTAS_DA_PARADA = [
  { nome: 'Reanimação neonatal', rota: '/plantonista/pediatria/reanimacao-neonatal' },
  { nome: 'RCP pediátrica completa', rota: '/plantonista/pediatria/rcp-pediatrica' },
]
