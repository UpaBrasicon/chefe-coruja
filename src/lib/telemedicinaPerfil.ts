// Regras puras da revisão do perfil Telemedicina (RT, 24/11/2026): o parecer
// em três campos (SA2), a trilha só com eventos da telemedicina (CH3/HI1) e a
// sigla do setor nas fichas da escala (ES2). Sem import: roda no teste do Node.

// ── parecer em três campos (SA2) ────────────────────────────────────────────
export type CamposParecer = { hipoteses: string; sugestao: string; reavaliar: string }

export const PARECER_VAZIO: CamposParecer = { hipoteses: '', sugestao: '', reavaliar: '' }

/** O mesmo mínimo de antes (20 caracteres), contado no que foi escrito, sem os rótulos. */
export const MINIMO_PARECER = 20

const ROTULOS: [keyof CamposParecer, string][] = [['hipoteses', 'Hipóteses'], ['sugestao', 'Sugestão'], ['reavaliar', 'Reavaliar se']]

/** O texto único que vai para responder_teleinterconsulta: um campo por linha, só os preenchidos. */
export function juntarParecer(c: CamposParecer): string {
  return ROTULOS.map(([k, r]) => [r, c[k].trim()] as const).filter(([, v]) => v).map(([r, v]) => `${r}: ${v}`).join('\n')
}

/** Quantos caracteres foram escritos nos três campos (sem rótulos nem espaços das pontas). */
export const tamanhoParecer = (c: CamposParecer) => c.hipoteses.trim().length + c.sugestao.trim().length + c.reavaliar.trim().length

export const parecerPronto = (c: CamposParecer) => tamanhoParecer(c) >= MINIMO_PARECER

// ── trilha da telemedicina (CH3, HI1) ───────────────────────────────────────
export type ConsultaTrilha = { paciente: string; unidade: string; aceita_em: string | null; respondida_em: string | null }
export type EventoTrilha = { em: string; acao: string; paciente: string; unidade: string; por: string }
export type GrupoAcao = 'pedido' | 'aceite' | 'parecer' | 'cancelamento' | 'abertura' | 'impressao'

const GRUPO: Record<string, GrupoAcao> = {
  solicitar_teleinterconsulta: 'pedido',
  aceitar_teleinterconsulta: 'aceite',
  responder_teleinterconsulta: 'parecer',
  cancelar_teleinterconsulta: 'cancelamento',
  leitura_prontuario: 'abertura',
  leitura_documento: 'abertura',
  impressao: 'impressao',
  exportacao: 'impressao',
}
export const grupoDaAcao = (acao: string): GrupoAcao | null => GRUPO[acao] ?? null

export const ROTULO_ACAO: Record<string, string> = {
  solicitar_teleinterconsulta: 'Pedido aberto',
  aceitar_teleinterconsulta: 'Aceite',
  responder_teleinterconsulta: 'Parecer emitido',
  cancelar_teleinterconsulta: 'Pedido cancelado',
  leitura_prontuario: 'Abertura do prontuário',
  leitura_documento: 'Abertura de documento',
  impressao: 'Impressão',
  exportacao: 'Exportação',
}

/** Leitura pela teleinterconsulta: do aceite até 24 h depois do parecer (ou até agora, sem parecer). */
export const JANELA_LEITURA_MS = 24 * 3_600_000

/**
 * A trilha só com eventos da telemedicina. Os eventos do pedido (log_auditoria
 * da teleinterconsulta) ficam todos. A abertura e a impressão do prontuário
 * (log_acesso_prontuario, que não diz por onde se entrou) ficam só quando caem
 * na janela de leitura de uma teleinterconsulta minha do mesmo paciente e da
 * mesma unidade; as feitas como Médico saem. O casamento é pelo nome do
 * paciente e da unidade, que é o que a RPC devolve.
 */
export function trilhaDaTelemedicina(trilha: EventoTrilha[], consultas: ConsultaTrilha[], agora = Date.now()): EventoTrilha[] {
  return trilha.filter((e) => {
    const g = grupoDaAcao(e.acao)
    if (g === null) return false
    if (g !== 'abertura' && g !== 'impressao') return true
    const t = new Date(e.em).getTime()
    return consultas.some((c) => c.paciente === e.paciente && c.unidade === e.unidade && c.aceita_em
      && new Date(c.aceita_em).getTime() <= t
      && t <= (c.respondida_em ? new Date(c.respondida_em).getTime() + JANELA_LEITURA_MS : agora))
  })
}

/** Grupos consecutivos pelo dia (a chave vem de quem chama, no fuso de Brasília). */
export function agruparPorDia<T>(lista: T[], dia: (x: T) => string): { dia: string; itens: T[] }[] {
  const grupos: { dia: string; itens: T[] }[] = []
  for (const x of lista) {
    const d = dia(x)
    const ult = grupos[grupos.length - 1]
    if (ult && ult.dia === d) ult.itens.push(x)
    else grupos.push({ dia: d, itens: [x] })
  }
  return grupos
}

/** "8 min", "1 h 05", "2 d 3 h": a distância entre dois instantes. */
export function duracaoLegivel(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h${min % 60 ? ` ${String(min % 60).padStart(2, '0')}` : ''}`
  const d = Math.floor(h / 24)
  return `${d} d${h % 24 ? ` ${h % 24} h` : ''}`
}

// ── escala (ES2) ────────────────────────────────────────────────────────────
const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/**
 * Sigla curta do setor para a ficha do calendário, que não corta: "Pronto
 * Socorro" → "PS", "Clínica Médica" → "CM", "Observação" → "Obs.", "UTI" → "UTI".
 * O nome inteiro fica no painel do dia.
 */
export function siglaSetor(nome: string): string {
  const palavras = nome.trim().split(/\s+/).filter((p) => p && !MINUSCULAS.has(p.toLowerCase()))
  if (palavras.length === 0) return ''
  if (palavras.length === 1) {
    const p = palavras[0]
    return p.length <= 5 ? p : `${p.slice(0, 3)}.`
  }
  return palavras.map((p) => (/^\d+$/.test(p) ? p : p[0].toUpperCase())).join('')
}

/** Contador do filtro de remotos (ES1): "3 remotos de 15". */
export const contagemRemotos = (remotos: number, total: number) => `${remotos} ${remotos === 1 ? 'remoto' : 'remotos'} de ${total}`
