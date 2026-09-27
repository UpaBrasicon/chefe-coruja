import { supabase } from '@/lib/supabase'

// Relógio do servidor no aparelho (ADR 0009). A cada contato guardamos a hora
// do servidor e o relógio monotônico da página (performance.now), que não
// muda quando alguém mexe no relógio do celular. Se a página for recarregada
// sem conexão, sobra a diferença para o relógio do aparelho — e o limite de
// 2 h continua valendo.

type Contexto = {
  servidor: number // ms, hora do servidor no último contato
  local: number // Date.now() no mesmo instante (só para recarga sem conexão)
  fimPlantao: number | null // ms
  toleranciaMs: number
  limiteMs: number
}

const CHAVE = 'cc-relogio-servidor'
let base: { servidor: number; perf: number } | null = null
let contexto: Contexto | null = ler()

function ler(): Contexto | null {
  try {
    const bruto = localStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Contexto) : null
  } catch {
    return null
  }
}

/** Atualiza hora do servidor e fim do plantão. Chamar sempre que houver conexão. */
export async function sincronizarRelogio(): Promise<void> {
  const antes = performance.now()
  const { data, error } = await supabase.rpc('contexto_sem_conexao')
  if (error || !data) throw error ?? new Error('Sem resposta do servidor.')
  const meio = (antes + performance.now()) / 2
  const d = data as { servidor: string; fim_plantao: string | null; tolerancia_min: number; limite_min: number }
  const servidor = Date.parse(d.servidor)
  base = { servidor, perf: meio }
  contexto = {
    servidor,
    local: Date.now(),
    fimPlantao: d.fim_plantao ? Date.parse(d.fim_plantao) : null,
    toleranciaMs: d.tolerancia_min * 60_000,
    limiteMs: d.limite_min * 60_000,
  }
  try {
    localStorage.setItem(CHAVE, JSON.stringify(contexto))
  } catch {
    // sem armazenamento: o relógio vale enquanto a página estiver aberta
  }
}

/** Hora do servidor agora (ms), ou null se nunca houve contato. */
export function agoraServidor(): number | null {
  if (base) return base.servidor + (performance.now() - base.perf)
  if (!contexto) return null
  const passou = Date.now() - contexto.local
  return passou < 0 ? null : contexto.servidor + passou // relógio do aparelho voltou: não confiar
}

export function ultimoContato(): number | null {
  return contexto?.servidor ?? null
}

/**
 * Pode registrar sem conexão? Só quem já estava em plantão neste aparelho,
 * até 2 h sem contato e até 15 min depois do fim do plantão.
 */
export function situacaoSemConexao(): { pode: true } | { pode: false; motivo: string } {
  const agora = agoraServidor()
  if (!contexto || agora === null) {
    return { pode: false, motivo: 'Este aparelho ainda não falou com o servidor neste plantão.' }
  }
  if (contexto.fimPlantao === null) {
    return { pode: false, motivo: 'Sem conexão, só continua quem já estava em plantão neste aparelho.' }
  }
  if (agora - contexto.servidor > contexto.limiteMs) {
    return { pode: false, motivo: 'Mais de 2 horas sem conexão: registre em papel até a conexão voltar.' }
  }
  if (agora > contexto.fimPlantao + contexto.toleranciaMs) {
    return { pode: false, motivo: 'O plantão terminou há mais de 15 minutos: o registro sem conexão fechou.' }
  }
  return { pode: true }
}
