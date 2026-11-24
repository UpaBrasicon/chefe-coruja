// Avisos (revisão de tela do RT, 24/11/2026, M1 a M3): categoria pelo tipo,
// avisos repetidos agrupados numa linha e o que pede ação separado do que só
// informa. Tudo no cliente, sobre o que minhas_notificacoes devolve.
// node --experimental-strip-types --test src/lib/avisos.test.ts

import { categoriaCobranca } from './nir.ts'

export type Categoria = 'Turno' | 'Observação' | 'Triagem' | 'Prescrição' | 'Farmácia' | 'Leitos' | 'Escala' | 'Candidatura'
  | 'Mensagem' | 'Regulação' | 'Encaminhamento' | 'Retorno' | 'AIH' | 'APAC' | 'Exames' | 'RNDS' | 'Reunião' | 'Outros'

export type Aviso = { id: string; tipo: string; mensagem: string; lida: boolean; created_at: string }

export function categoria(tipo: string, mensagem = ''): Categoria {
  if (/^(noite|manha|tarde|turno)_/.test(tipo)) return 'Turno'
  if (tipo.startsWith('obs_')) return 'Observação'
  // piora reclassificada pela enfermagem na espera (correções do portão, tarefa 2)
  if (tipo.startsWith('triagem_')) return 'Triagem'
  // validade do item da prescrição (lacuna 6 do portão): vence e vencida
  if (tipo.startsWith('presc_') || /^prescrição (vencida|vence)/i.test(mensagem.trim())) return 'Prescrição'
  // item devolvido pela farmácia e leito liberado (correções do portão, tarefa 7)
  if (tipo.startsWith('farm_')) return 'Farmácia'
  if (tipo.startsWith('leito_')) return 'Leitos'
  if (tipo.startsWith('solic_') || tipo.startsWith('vaga_')) return 'Escala'
  if (tipo.startsWith('cand_')) return 'Candidatura'
  if (tipo.startsWith('chat_')) return 'Mensagem'
  if (tipo.startsWith('reg_')) return 'Regulação'
  // paciente enviado pela UBS à UPA, chegada ou não chegada (5A, tarefa 5)
  if (tipo.startsWith('ubs_upa_')) return 'Encaminhamento'
  // paciente da UBS que voltou da UPA ou do hospital (5A, tarefa 6)
  if (tipo.startsWith('ubs_retorno_')) return 'Retorno'
  // resultado de exame liberado ou crítico (Fase 5C, etapa 1.2)
  if (tipo.startsWith('exame_')) return 'Exames'
  // certificado, credencial e bloqueio da RNDS (Fase 5C, etapa 5.4)
  if (tipo.startsWith('rnds_')) return 'RNDS'
  // convite, mudança e cancelamento de reunião da agenda do administrador (RT, 24/11/2026)
  if (tipo.startsWith('reuniao_')) return 'Reunião'
  // cobranças do NIR (Fase 4, tarefa 11): a categoria é o assunto
  const nir = categoriaCobranca(tipo)
  if (nir) return nir
  return 'Outros'
}

/**
 * Pede ação de quem recebe (M2): prescrição vencendo ou vencida (a enfermagem
 * não administra), prazo da regulação (inclusive o risco de cancelamento),
 * pergunta da central, pedido da escala, piora na triagem e exame crítico.
 * O resto (vaga aberta, início de turno, leito liberado…) só informa.
 */
export function precisaAcao(tipo: string, mensagem = ''): boolean {
  if (categoria(tipo, mensagem) === 'Prescrição') return true
  return /^(reg_prazo_|reg_pendencia|solic_|triagem_|exame_critico_)/.test(tipo)
}

export type GrupoAvisos = {
  chave: string
  tipo: string
  mensagem: string
  categoria: Categoria
  acao: boolean
  ids: string[]
  naoLidos: string[]
  vezes: number
  primeiro: string
  ultimo: string
}

/**
 * Junta avisos repetidos (M1): mesmo tipo e mesmo texto viram uma linha,
 * "… · 8 vezes desde 17/11". O tipo já traz o número do pedido ou do item, então
 * o aviso diário da mesma regulação cai no mesmo grupo. Mais novo primeiro.
 */
export function agruparAvisos(lista: readonly Aviso[]): GrupoAvisos[] {
  const grupos = new Map<string, GrupoAvisos>()
  for (const n of lista) {
    const chave = `${n.tipo}|${n.mensagem.trim()}`
    let g = grupos.get(chave)
    if (!g) {
      g = {
        chave, tipo: n.tipo, mensagem: n.mensagem, categoria: categoria(n.tipo, n.mensagem), acao: precisaAcao(n.tipo, n.mensagem),
        ids: [], naoLidos: [], vezes: 0, primeiro: n.created_at, ultimo: n.created_at,
      }
      grupos.set(chave, g)
    }
    g.ids.push(n.id)
    if (!n.lida) g.naoLidos.push(n.id)
    g.vezes++
    if (n.created_at < g.primeiro) g.primeiro = n.created_at
    if (n.created_at > g.ultimo) g.ultimo = n.created_at
  }
  return [...grupos.values()].sort((a, b) => b.ultimo.localeCompare(a.ultimo))
}

/** O contador de não lidos conta grupos, não linhas repetidas (M1). */
export function contarNaoLidos(lista: readonly Aviso[]): number {
  return agruparAvisos(lista).filter((g) => g.naoLidos.length > 0).length
}
