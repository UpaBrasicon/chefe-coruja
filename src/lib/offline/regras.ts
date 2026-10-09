// Regras do modo sem conexão (ADR 0009), sem rede nem armazenamento, para
// poderem ser testadas sozinhas (Fase 2, tarefa 7). O relógio (relogio.ts)
// guarda o contexto e chama estas funções.

export type ContextoRelogio = {
  servidor: number // ms, hora do servidor no último contato
  local: number // Date.now() no mesmo instante (só para recarga sem conexão)
  fimPlantao: number | null // ms
  toleranciaMs: number
  limiteMs: number
}

/**
 * Hora do servidor agora (ms). Com a página aberta desde o último contato,
 * usa o relógio monotônico (perfAgora); depois de recarregar, a diferença do
 * relógio do aparelho — e relógio que voltou para trás não vale (null).
 */
export function horaServidor(
  base: { servidor: number; perf: number } | null, contexto: ContextoRelogio | null, perfAgora: number, dataAgora: number,
): number | null {
  if (base) return base.servidor + (perfAgora - base.perf)
  if (!contexto) return null
  const passou = dataAgora - contexto.local
  return passou < 0 ? null : contexto.servidor + passou
}

/**
 * Pode registrar sem conexão? Só quem já estava em plantão neste aparelho, até
 * o limite sem contato (2 h) e até a tolerância depois do fim do plantão, que
 * vem do servidor (20 min, decisão do RT de 03/10/2026).
 */
export function avaliarSemConexao(contexto: ContextoRelogio | null, agora: number | null): { pode: true } | { pode: false; motivo: string } {
  if (!contexto || agora === null) {
    return { pode: false, motivo: 'Este aparelho ainda não falou com o servidor neste plantão.' }
  }
  if (contexto.fimPlantao === null) {
    return { pode: false, motivo: 'Sem conexão, só continua quem já estava em plantão neste aparelho.' }
  }
  if (agora - contexto.servidor > contexto.limiteMs) {
    return { pode: false, motivo: `Mais de ${Math.round(contexto.limiteMs / 3_600_000)} horas sem conexão: registre em papel até a conexão voltar.` }
  }
  if (agora > contexto.fimPlantao + contexto.toleranciaMs) {
    return { pode: false, motivo: `O plantão terminou há mais de ${Math.round(contexto.toleranciaMs / 60_000)} minutos: o registro sem conexão fechou.` }
  }
  return { pode: true }
}

/** Erro de rede (vai para a fila) ou erro do servidor (mostra na tela)? */
export function ehFalhaDeRede(online: boolean, error: { message?: string } | null): boolean {
  if (!online) return true
  return !!error && /fetch|network|rede|timeout/i.test(error.message ?? '')
}
