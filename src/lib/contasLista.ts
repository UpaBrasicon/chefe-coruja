// Lista das contas do atendimento (revisão do perfil Faturamento, CT1, RT em
// 24/11/2026): etapa em caixa normal, plural certo, bloqueantes primeiro e,
// depois, a conta mais antiga; a idade da conta na linha.
import { ETAPA, type Conta, type EtapaConta } from './contas.ts'

/** "Aberta", "Em conferência"… (o ETAPA é minúsculo para caber no meio da frase). */
export const etapaNaTela = (e: EtapaConta) => ETAPA[e].charAt(0).toUpperCase() + ETAPA[e].slice(1)

/** "3 bloqueantes · 4 avisos", "1 bloqueante", "2 avisos" ou "" sem pendência. */
export function pendenciasNaTela(p: { bloqueantes: number; avisos: number } | null | undefined): string {
  if (!p) return ''
  return [
    p.bloqueantes > 0 && `${p.bloqueantes} ${p.bloqueantes === 1 ? 'bloqueante' : 'bloqueantes'}`,
    p.avisos > 0 && `${p.avisos} ${p.avisos === 1 ? 'aviso' : 'avisos'}`,
  ].filter(Boolean).join(' · ')
}

const DIA = 86_400_000
export function diasDesde(iso: string, agora: number = Date.now()): number {
  return Math.max(0, Math.floor((agora - new Date(iso).getTime()) / DIA))
}

/** "aberta hoje", "aberta há 1 dia", "aberta há 34 dias". */
export function abertaHa(iso: string, agora: number = Date.now()): string {
  const d = diasDesde(iso, agora)
  return d === 0 ? 'aberta hoje' : `aberta há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

/** Bloqueantes primeiro; em cada grupo, a conta aberta há mais tempo antes. */
export function ordenarContas<T extends Pick<Conta, 'aberta_em' | 'pendencias'>>(contas: T[]): T[] {
  const bloq = (c: T) => ((c.pendencias?.bloqueantes ?? 0) > 0 ? 0 : 1)
  return contas
    .map((c, i) => ({ c, i }))
    .sort((a, b) => bloq(a.c) - bloq(b.c) || Date.parse(a.c.aberta_em) - Date.parse(b.c.aberta_em) || a.i - b.i)
    .map((x) => x.c)
}
