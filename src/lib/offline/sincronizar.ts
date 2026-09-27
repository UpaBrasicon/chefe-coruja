import { supabase } from '@/lib/supabase'
import { aparelhoId, enfileirar, listar, marcarRecusado, remover, type ItemSync } from './fila'
import { agoraServidor, situacaoSemConexao, sincronizarRelogio, ultimoContato } from './relogio'

// Porta única de gravação dos registros que podem nascer sem conexão
// (ADR 0009). Com conexão, envia na hora; se a rede falhar, o mesmo item —
// com o mesmo id — vai para a fila e é reenviado depois. O servidor é
// idempotente, então um envio que "talvez tenha chegado" pode ser repetido.

type Resposta = { id: string; status: 'gravado' | 'ja_recebido' | 'recusado'; motivo?: string }

export type ResultadoGravacao = { gravados: number; naFila: number; recusados: string[] }

export const EVENTO_FILA = 'cc-fila-mudou'
const avisar = () => window.dispatchEvent(new Event(EVENTO_FILA))

function falhaDeRede(error: { message?: string } | null): boolean {
  if (!navigator.onLine) return true
  return !!error && /fetch|network|rede|timeout/i.test(error.message ?? '')
}

async function enviar(itens: ItemSync[]): Promise<Resposta[]> {
  const { data, error } = await supabase.rpc('sincronizar_registros', { p_itens: itens as never })
  if (error) throw error
  return (data ?? []) as unknown as Resposta[]
}

/** Novo registro: id e hora nascem aqui, do relógio do servidor. */
export function novoItem(tipo: ItemSync['tipo'], dados: Record<string, unknown>): ItemSync {
  const hora = agoraServidor() ?? Date.now()
  return {
    id: crypto.randomUUID(),
    tipo,
    hora: new Date(hora).toISOString(),
    sem_conexao: false,
    ultimo_contato: null,
    aparelho_id: aparelhoId(),
    dados,
  }
}

export async function gravarRegistros(perfil: string, itens: ItemSync[]): Promise<ResultadoGravacao> {
  if (itens.length === 0) return { gravados: 0, naFila: 0, recusados: [] }
  try {
    const respostas = await enviar(itens)
    const recusados = respostas.filter((r) => r.status === 'recusado').map((r) => r.motivo ?? 'recusado')
    return { gravados: respostas.length - recusados.length, naFila: 0, recusados }
  } catch (e) {
    if (!falhaDeRede(e as { message?: string })) throw e
  }

  // sem conexão
  const situacao = situacaoSemConexao()
  if (!situacao.pode) throw new Error(situacao.motivo)
  const contato = ultimoContato()
  const offline = itens.map((i) => ({
    ...i,
    sem_conexao: true,
    ultimo_contato: contato ? new Date(contato).toISOString() : null,
  }))
  await enfileirar(perfil, offline)
  avisar()
  return { gravados: 0, naFila: offline.length, recusados: [] }
}

let esvaziando = false

/** Envia a fila. Só apaga o que o servidor confirmou. */
export async function esvaziarFila(perfil: string): Promise<void> {
  if (esvaziando || !navigator.onLine) return
  esvaziando = true
  try {
    await sincronizarRelogio().catch(() => undefined)
    const pendentes = (await listar(perfil)).filter((i) => !i.recusado)
    for (let i = 0; i < pendentes.length; i += 200) {
      const lote: ItemSync[] = pendentes.slice(i, i + 200).map((p) => ({ ...p, recusado: undefined }))
      const respostas = await enviar(lote)
      await remover(respostas.filter((r) => r.status !== 'recusado').map((r) => r.id))
      for (const r of respostas.filter((x) => x.status === 'recusado')) {
        await marcarRecusado(r.id, r.motivo ?? 'recusado')
      }
    }
  } finally {
    esvaziando = false
    avisar()
  }
}

export async function resumoFila(perfil: string): Promise<{ pendentes: number; recusados: number }> {
  const itens = await listar(perfil)
  const recusados = itens.filter((i) => i.recusado).length
  return { pendentes: itens.length - recusados, recusados }
}
