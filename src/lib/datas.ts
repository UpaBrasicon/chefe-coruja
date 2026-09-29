// Datas no fuso da unidade (Brasília), para listas de auditoria e pedidos.
export const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
/** Data pura (YYYY-MM-DD), sem deslocar o dia pelo fuso. */
export const fmtData = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')
