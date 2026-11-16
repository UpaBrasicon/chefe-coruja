// Trilha de segurança, S8 (docs/seguranca/S8-HERMES-VPS-DIAGNOSTICO.md).
//
// D2. Argumentos de ferramenta chegam aqui já reidentificados. Hoje são
//     enumerações e ids, mas um valor escolhido pelo modelo poderia levar um
//     identificador para o log do contêiner ou para hermes_audit_log. O log
//     guarda só os nomes dos campos; a auditoria guarda id, data, número,
//     booleano e palavra de enumeração, e troca o resto pelo resumo sha256.
// D3. Notificações desidentificadas pela ferramenta usam outro prefixo
//     ([COLEGA_n]), que o gateway não reidentifica: o cofre da ferramenta e o
//     da conversa não disputam o mesmo [PESSOA_n].

import { createHash } from 'node:crypto'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATA = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/
const ENUM = /^[a-z][a-z0-9_]{0,39}$/

const resumo = (v: string) => `sha256:${createHash('sha256').update(v).digest('hex').slice(0, 16)}`

/** O valor pode ir para a auditoria como está? */
function valorSeguro(v: unknown): unknown {
  if (v === null || typeof v === 'boolean' || typeof v === 'number') return v
  if (typeof v === 'string') return UUID.test(v) || DATA.test(v) || ENUM.test(v) ? v : resumo(v)
  return resumo(JSON.stringify(v) ?? '')
}

/** Argumentos para hermes_audit_log: texto livre vira resumo. */
export function argsParaAuditoria(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).map(([k, v]) => [k, valorSeguro(v)]))
}

/** Argumentos para o log do contêiner: só os nomes dos campos. */
export function argsParaLog(args: Record<string, unknown>): string[] {
  return Object.keys(args)
}

/** [PESSOA_1] → [COLEGA_1]; outras categorias → [NOTIF_<CATEGORIA>_n]. */
export function prefixoDeNotificacao(texto: string): string {
  return texto.replace(/\[([A-Z]+)_(\d+)\]/g, (_, cat: string, n: string) =>
    cat === 'PESSOA' ? `[COLEGA_${n}]` : `[NOTIF_${cat}_${n}]`)
}
