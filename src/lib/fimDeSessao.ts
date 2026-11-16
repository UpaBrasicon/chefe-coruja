// Fim da sessão no navegador (trilha de segurança, S7;
// docs/seguranca/S7-SESSAO-DIAGNOSTICO.md). Regras puras, testadas em
// fimDeSessao.test.ts; o AuthContext liga.
//
// C1. A sessão encerrada pelo servidor (SIGNED_OUT que não veio do "Sair")
//     faz a mesma limpeza do "Sair", e a tela de entrada explica.
// C2. As 12 horas do "Manter conectado" valem com a aba aberta: aviso 15
//     minutos antes e fim no prazo.
// C3. O token de "Confiar neste dispositivo" só fica no aparelho da pessoa
//     (com "Manter conectado"); sem isso, nem é gravado e o "Sair" o apaga.

/** Quanto "manter conectado" segura a sessão depois do login. */
export const MANTER_MAX_MS = 12 * 60 * 60 * 1000
/** Quanto antes do fim aparece o aviso. */
export const AVISO_ANTES_MS = 15 * 60 * 1000

export type PrazoDaSessao =
  | { tipo: 'sem-prazo' }
  | { tipo: 'ok'; fim: number }
  | { tipo: 'aviso'; fim: number }
  | { tipo: 'vencido' }

/**
 * Onde está a sessão em relação às 12 horas. Sem "Manter conectado" não há
 * prazo (a sessão acaba com a aba). Marcado sem a hora do login conta como
 * vencido, como na carga da página.
 */
export function prazoDaSessao(manter: boolean, desde: number | null, agora: number): PrazoDaSessao {
  if (!manter) return { tipo: 'sem-prazo' }
  if (!desde || !Number.isFinite(desde)) return { tipo: 'vencido' }
  const fim = desde + MANTER_MAX_MS
  if (agora >= fim) return { tipo: 'vencido' }
  if (fim - agora <= AVISO_ANTES_MS) return { tipo: 'aviso', fim }
  return { tipo: 'ok', fim }
}

/** O SIGNED_OUT veio do servidor (e não do "Sair" desta aba ou de outra)? */
export function fimPeloServidor(evento: string, saindoPorConta: boolean): boolean {
  return evento === 'SIGNED_OUT' && !saindoPorConta
}

export type MotivoDoFim = 'servidor' | 'prazo'
type Area = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined

const CHAVE_FIM = 'cc-fim-sessao'

/** Guarda o motivo para a tela de entrada mostrar. */
export function marcarFimDeSessao(area: Area, motivo: MotivoDoFim) {
  try { area?.setItem(CHAVE_FIM, motivo) } catch { /* sem armazenamento: só não explica */ }
}

/** Lê o motivo sem apagar. */
export function lerFimDeSessao(area: Area): MotivoDoFim | null {
  try {
    const v = area?.getItem(CHAVE_FIM) ?? null
    return v === 'servidor' || v === 'prazo' ? v : null
  } catch {
    return null
  }
}

/** Lê e apaga o motivo (a tela mostra uma vez). */
export function tirarFimDeSessao(area: Area): MotivoDoFim | null {
  try {
    const v = area?.getItem(CHAVE_FIM) ?? null
    area?.removeItem(CHAVE_FIM)
    return v === 'servidor' || v === 'prazo' ? v : null
  } catch {
    return null
  }
}

export function textoDoFim(motivo: MotivoDoFim): string {
  return motivo === 'prazo'
    ? 'As 12 horas do "Manter conectado" acabaram. Entre de novo.'
    : 'Sua sessão foi encerrada. Entre de novo.'
}

// ── C3. Dispositivo confiável ───────────────────────────────────────────────
export const CHAVE_DISPOSITIVO = 'cc_dispositivo_2fa'

/** "Confiar neste dispositivo" só no aparelho da pessoa ("Manter conectado"). */
export const podeConfiarNoAparelho = (manter: boolean) => manter

export function lerTokenDispositivo(area: Area): string | null {
  try { return area?.getItem(CHAVE_DISPOSITIVO) ?? null } catch { return null }
}

/** Grava o token só com "Manter conectado"; devolve se gravou. */
export function salvarTokenDispositivo(area: Area, token: string, manter: boolean): boolean {
  if (!podeConfiarNoAparelho(manter)) return false
  try { area?.setItem(CHAVE_DISPOSITIVO, token); return true } catch { return false }
}

export function limparTokenDispositivo(area: Area) {
  try { area?.removeItem(CHAVE_DISPOSITIVO) } catch { /* modo privado */ }
}

/** Ao sair: sem "Manter conectado" (computador compartilhado), o token sai. */
export function tokenDispositivoAoSair(area: Area, manter: boolean) {
  if (!manter) limparTokenDispositivo(area)
}
