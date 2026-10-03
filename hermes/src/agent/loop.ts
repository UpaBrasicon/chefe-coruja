// ─────────────────────────────────────────────────────────────────────────────
// HERMES — agent/loop.ts
// Loop do agente: LLM → tool_call → executa tool → devolve resultado → repete
// (máx. 5 iterações) → resposta final ao usuário.
//
// Formato de tools: OpenAI-compatible (confirmado na doc do DeepSeek).
// ─────────────────────────────────────────────────────────────────────────────
import type { MensagemLLM, ToolDefLLM, ToolCallLLM } from '../lib/llm.js'
import {
  chamarIA, ChamadaBloqueada, DesidentificacaoIndisponivel, nomesEmResultado,
  MSG_CHAMADA_BLOQUEADA, MSG_DESIDENTIFICACAO_INDISPONIVEL, type ContextoGateway, type DependenciasGateway,
} from '../gateway/gateway.js'
import { criarCofre } from '../gateway/desidentificacao.js'
import { logger } from '../logger.js'
import { executarTool } from './tools.js'
import type { IdentidadeHermes } from './identidade.js'

const MAX_ITERACOES = 5

export const TOOLS_DISPONIVEIS: ToolDefLLM[] = [
  // Gavião é apenas SENTINELA (fiscal) — as tools de escala foram movidas para
  // a skill do Nous (chefe-coruja-operacional). Aqui ficam só as do Cérbero.
  {
    type: 'function',
    function: {
      name: 'listar_quarentena',
      description:
        'Lista itens em quarentena (URLs/anexos reprovados). Exclusivo super_admin — outros papéis recebem resposta genérica.',
      parameters: { type: 'object', properties: { status: { type: 'string' } } },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_incidentes',
      description:
        'Lista incidentes de segurança/integridade registrados pelo Cérbero. Exclusivo super_admin.',
      parameters: {
        type: 'object',
        properties: {
          patrulha: { type: 'string', enum: ['dados', 'conteudo', 'hermes'] },
          severidade: { type: 'string', enum: ['critico', 'atencao', 'informativo'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'liberar_quarentena',
      description:
        'Libera um item em quarentena (única escrita do Cérbero). Exclusivo super_admin e SEMPRE exige confirmação explícita do admin na conversa antes de executar.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'ID do item em quarentena' } },
        required: ['id'],
      },
    },
  },
]

function mensagemDoTool(tc: ToolCallLLM): MensagemLLM {
  return {
    role: 'assistant',
    content: '',
    tool_calls: [
      {
        id: tc.id,
        type: 'function',
        function: { name: tc.function.name, arguments: tc.function.arguments },
      },
    ],
  }
}

function mensagemResultado(tc: ToolCallLLM, conteudo: string): MensagemLLM {
  return { role: 'tool', tool_call_id: tc.id, content: conteudo }
}

/**
 * Executa o loop completo e retorna a resposta final em texto.
 * Em falha de LLM (primário + fallback), retorna a mensagem de instabilidade
 * (nunca silêncio).
 */
export async function executarLoopAgente(
  identidade: IdentidadeHermes,
  waId: string,
  systemPrompt: string,
  historico: MensagemLLM[],
  mensagemUsuario: string,
  /** Só para teste: troca modelo/NER/registro do gateway. */
  depsGateway: Partial<DependenciasGateway> = {}
): Promise<{ texto: string; ok: boolean }> {
  const mensagens: MensagemLLM[] = [...historico, { role: 'user', content: mensagemUsuario }]
  let iteracoes = 0

  // ADR 0006: a conversa inteira passa pelo gateway. O cofre vive só nesta
  // chamada, no servidor; o modelo nunca vê o nome do usuário nem os nomes
  // que as ferramentas devolvem.
  const ctx: ContextoGateway = {
    cofre: criarCofre(),
    conhecidos: identidade.nome ? [{ valor: identidade.nome, categoria: 'PESSOA' }] : [],
    origem: 'hermes:whatsapp',
    perfilId: identidade.perfilId,
  }

  try {
    while (iteracoes < MAX_ITERACOES) {
      iteracoes++
      const resposta = await chamarIA({
        mensagens: [{ role: 'system', content: systemPrompt }, ...mensagens],
        tools: TOOLS_DISPONIVEIS,
        toolChoice: 'auto',
        maxTokens: 512,
      }, ctx, depsGateway)

      // Sem tool calls → resposta final.
      if (resposta.toolCalls.length === 0) {
        return { texto: resposta.conteudo || 'Não consegui processar sua solicitação.', ok: true }
      }

      // Executa cada tool chamada e anexa os resultados ao histórico.
      for (const tc of resposta.toolCalls) {
        if (tc.type !== 'function') continue
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(tc.function.arguments || '{}')
        } catch {
          args = {}
        }

        logger.info({ tool: tc.function.name, args }, '[loop] executando tool')
        const exec = await executarTool(identidade, waId, tc.function.name, args)
        if (exec.resultado.ok) ctx.conhecidos.push(...nomesEmResultado(exec.resultado.dados))
        const resumo = exec.resultado.ok
          ? JSON.stringify(exec.resultado.dados)
          : `ERRO: ${exec.resultado.erro}`

        mensagens.push(mensagemDoTool(tc), mensagemResultado(tc, resumo))
      }
    }

    return { texto: 'Limite de etapas atingido. Refine sua pergunta, por favor.', ok: true }
  } catch (err) {
    if (err instanceof ChamadaBloqueada) {
      logger.warn({ residuos: err.residuos.length }, '[loop] gateway bloqueou a chamada')
      return { texto: MSG_CHAMADA_BLOQUEADA, ok: true }
    }
    // NER fora do ar / sem configuração: nada foi ao modelo. A recusa vai ao
    // usuário como texto (ok: true), senão o pipeline trocaria por
    // "instabilidade" e a pessoa não saberia o motivo.
    if (err instanceof DesidentificacaoIndisponivel) {
      return { texto: MSG_DESIDENTIFICACAO_INDISPONIVEL, ok: true }
    }
    logger.error({ err: (err as Error).message }, '[loop] falha no LLM')
    return {
      texto: 'Estou com instabilidade agora. Tente de novo em alguns minutos.',
      ok: false,
    }
  }
}
