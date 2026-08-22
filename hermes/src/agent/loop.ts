// ─────────────────────────────────────────────────────────────────────────────
// HERMES — agent/loop.ts
// Loop do agente: LLM → tool_call → executa tool → devolve resultado → repete
// (máx. 5 iterações) → resposta final ao usuário.
//
// Formato de tools: OpenAI-compatible (confirmado na doc do DeepSeek).
// ─────────────────────────────────────────────────────────────────────────────
import { completar, type MensagemLLM, type ToolDefLLM, type ToolCallLLM } from '../lib/llm.js'
import { logger } from '../logger.js'
import { executarTool } from './tools.js'
import type { IdentidadeHermes } from './identidade.js'

const MAX_ITERACOES = 5

export const TOOLS_DISPONIVEIS: ToolDefLLM[] = [
  {
    type: 'function',
    function: {
      name: 'get_meus_plantoes',
      description:
        'Lista os plantões do usuário autenticado. Use quando perguntarem sobre a própria escala/plantões do usuário.',
      parameters: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            enum: ['hoje', 'semana', 'mes'],
            description: 'Período a consultar (default: semana).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_plantao_do_dia',
      description:
        'Escala completa da unidade em uma data (apenas gestor/admin). Use quando perguntarem quem está de plantão ou a escala da unidade.',
      parameters: {
        type: 'object',
        properties: {
          data: {
            type: 'string',
            description: 'Data no formato AAAA-MM-DD (default: hoje).',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analisar_padrao_escala',
      description:
        'Métricas de escala de um médico vs. mediana da unidade (repasses, faltas, trocas, cancelamentos tardios, concentração de destino). Gestor/admin podem pedir de qualquer médico; plantonista recebe apenas os próprios dados.',
      parameters: {
        type: 'object',
        properties: {
          medico_id: {
            type: 'string',
            description: 'ID do médico (apenas gestor/admin; plantonista é ignorado).',
          },
          janela: {
            type: 'string',
            enum: ['30d', '90d'],
            description: 'Janela de análise (default: 30d).',
          },
        },
      },
    },
  },
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
  mensagemUsuario: string
): Promise<{ texto: string; ok: boolean }> {
  const mensagens: MensagemLLM[] = [...historico, { role: 'user', content: mensagemUsuario }]
  let iteracoes = 0

  try {
    while (iteracoes < MAX_ITERACOES) {
      iteracoes++
      const resposta = await completar({
        mensagens: [{ role: 'system', content: systemPrompt }, ...mensagens],
        tools: TOOLS_DISPONIVEIS,
        toolChoice: 'auto',
        maxTokens: 512,
      })

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
        const resumo = exec.resultado.ok
          ? JSON.stringify(exec.resultado.dados)
          : `ERRO: ${exec.resultado.erro}`

        mensagens.push(mensagemDoTool(tc), mensagemResultado(tc, resumo))
      }
    }

    return { texto: 'Limite de etapas atingido. Refine sua pergunta, por favor.', ok: true }
  } catch (err) {
    logger.error({ err: (err as Error).message }, '[loop] falha no LLM')
    return {
      texto: 'Estou com instabilidade agora. Tente de novo em alguns minutos.',
      ok: false,
    }
  }
}
