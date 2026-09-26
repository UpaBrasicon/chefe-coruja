// ─────────────────────────────────────────────────────────────────────────────
// GATEWAY DE IA (JEV) — gateway/gateway.ts
// ADR 0006: TODA chamada a modelo passa por aqui. Nenhum outro módulo importa
// `completar` direto.
//
//   saída   → desidentifica cada mensagem; resíduo bloqueia (falha fechada)
//   modelo  → lib/llm.ts (provider-agnóstico; hoje DeepSeek, fora do Brasil)
//   entrada → reidentifica resposta e argumentos de ferramenta; pseudônimo
//             inventado pelo modelo é descartado
//   registro→ ia_gateway_log: contagens, provedor, latência, hash — nunca texto
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'

import { completar, type ChamadaLLM, type MensagemLLM, type RespostaLLM, type ToolCallLLM } from '../lib/llm.js'
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'
import {
  desidentificar, reidentificar, residuos,
  type Cofre, type Conhecido, type Contagem, type Residuo,
} from './desidentificacao.js'

export { nomesEmResultado } from './desidentificacao.js'

export class ChamadaBloqueada extends Error {
  readonly residuos: Residuo[]
  constructor(achados: Residuo[]) {
    super(`gateway: ${achados.length} possível(is) identificador(es) no texto; chamada não enviada`)
    this.name = 'ChamadaBloqueada'
    this.residuos = achados
  }
}

export type ContextoGateway = {
  /** Cofre da conversa: o mesmo valor recebe o mesmo pseudônimo em todas as voltas. */
  cofre: Cofre
  /** Identificadores que o servidor já conhece (nome do usuário, nomes vindos de ferramentas). */
  conhecidos: Conhecido[]
  /** De onde veio a chamada — vai para o registro. */
  origem: string
  perfilId?: string | null
}

function somar(total: Contagem, parcial: Contagem) {
  for (const [k, n] of Object.entries(parcial) as [keyof Contagem, number][]) total[k] = (total[k] ?? 0) + n
}

function limparMensagem(m: MensagemLLM, ctx: ContextoGateway, total: Contagem, achados: Residuo[]): MensagemLLM {
  const { texto, contagem } = desidentificar(m.content ?? '', ctx.cofre, ctx.conhecidos)
  somar(total, contagem)
  achados.push(...residuos(texto))
  const tool_calls = m.tool_calls?.map((tc) => {
    const r = desidentificar(tc.function.arguments, ctx.cofre, ctx.conhecidos)
    somar(total, r.contagem)
    achados.push(...residuos(r.texto))
    return { ...tc, function: { ...tc.function, arguments: r.texto } }
  })
  return { ...m, content: texto, ...(tool_calls ? { tool_calls } : {}) }
}

function reidentificarChamadas(tcs: ToolCallLLM[], cofre: Cofre): ToolCallLLM[] {
  return tcs.map((tc) => ({ ...tc, function: { ...tc.function, arguments: reidentificar(tc.function.arguments, cofre) } }))
}

async function registrar(ctx: ContextoGateway, dados: {
  bloqueado: boolean; contagem: Contagem; residuos: number; hashEntrada: string;
  provedor?: string; modelo?: string; latenciaMs?: number; erro?: string
}) {
  const { error } = await supabase.from('ia_gateway_log').insert({
    origem: ctx.origem,
    perfil_id: ctx.perfilId ?? null,
    bloqueado: dados.bloqueado,
    substituicoes: dados.contagem,
    residuos: dados.residuos,
    hash_entrada: dados.hashEntrada,
    provedor: dados.provedor ?? null,
    modelo: dados.modelo ?? null,
    latencia_ms: dados.latenciaMs ?? null,
    erro: dados.erro ? dados.erro.slice(0, 200) : null,
  })
  // O registro nunca derruba a conversa — mas a falha fica no log técnico.
  if (error) logger.warn({ err: error.message }, '[gateway] falha ao registrar chamada')
}

/**
 * A única porta para o modelo. Lança ChamadaBloqueada se, depois da limpeza,
 * sobrar algo com cara de identificador.
 */
export async function chamarIA(body: ChamadaLLM, ctx: ContextoGateway): Promise<RespostaLLM> {
  const hashEntrada = createHash('sha256').update(JSON.stringify(body.mensagens)).digest('hex')
  const contagem: Contagem = {}
  const achados: Residuo[] = []
  const mensagens = body.mensagens.map((m) => limparMensagem(m, ctx, contagem, achados))

  if (achados.length) {
    await registrar(ctx, { bloqueado: true, contagem, residuos: achados.length, hashEntrada })
    throw new ChamadaBloqueada(achados)
  }

  try {
    const r = await completar({ ...body, mensagens })
    await registrar(ctx, {
      bloqueado: false, contagem, residuos: 0, hashEntrada,
      provedor: r.provedor, modelo: r.modelo, latenciaMs: r.latenciaMs,
    })
    return { ...r, conteudo: reidentificar(r.conteudo, ctx.cofre), toolCalls: reidentificarChamadas(r.toolCalls, ctx.cofre) }
  } catch (err) {
    await registrar(ctx, { bloqueado: false, contagem, residuos: 0, hashEntrada, erro: (err as Error).message })
    throw err
  }
}
