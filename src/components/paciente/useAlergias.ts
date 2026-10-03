// ─────────────────────────────────────────────────────────────────────────────
// Alergias e eventos adversos do paciente — dados e vocabulário.
// Separado dos componentes para o fast refresh do Vite.
//
// Estado em três valores (protótipo, D4): "tem" (alergia ativa), "nega"
// (registro explícito, com autor e hora) e "não registrada" (ninguém perguntou).
// Lista vazia NÃO é "nega". Toda regra mora no banco
// (20261003000002_alergias_eventos_adversos.sql); aqui só se lê e se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

// 4 estados (decisão do RT 03/10/2026): "tem" (alergia ativa), "nega" (registro
// explícito de ausência), "desconhece" (perguntou e não soube informar) e
// "não registrada" (ninguém perguntou). Lista vazia NÃO é "nega".
export type EstadoAlergia = 'tem' | 'nega' | 'desconhece' | 'nao_registrada'
export type TipoAlergia = 'medicamento' | 'alimento' | 'latex' | 'contraste' | 'outro'
export type GravidadeAlergia = 'leve' | 'moderada' | 'grave' | 'desconhecida'

export type AlergiaRegistro = {
  id: string
  substancia: string
  tipo: TipoAlergia
  gravidade: GravidadeAlergia
  reacao: string | null
  medicamento_id: string | null
  registrado_em: string
  autor: string | null
  inativada_em: string | null
  inativada_por: string | null
  motivo_inativacao: string | null
}
export type NegacaoRegistro = {
  id: string
  /** nega = ausência declarada; desconhece = perguntou e não soube informar. */
  tipo: 'nega' | 'desconhece'
  registrado_em: string
  autor: string | null
  encerrada_em: string | null
  encerrada_por: string | null
  motivo_encerramento: string | null
}
export type EventoAdverso = {
  id: string
  evento: string
  grau: number
  observacao: string | null
  prescricao_item_id: string | null
  item_descricao: string | null
  registrado_em: string
  autor: string | null
  grau_em: string
  inativado_em: string | null
  inativado_por: string | null
  motivo_inativacao: string | null
  graus: { grau: number; registrado_em: string; autor: string | null }[] | null
}
export type PainelAlergias = {
  estado: EstadoAlergia
  alergias: AlergiaRegistro[]
  negacoes: NegacaoRegistro[]
  eventos: EventoAdverso[]
}

export const TIPOS_ALERGIA: { valor: TipoAlergia; rotulo: string }[] = [
  { valor: 'medicamento', rotulo: 'Medicamento' },
  { valor: 'alimento', rotulo: 'Alimento' },
  { valor: 'latex', rotulo: 'Látex' },
  { valor: 'contraste', rotulo: 'Contraste' },
  { valor: 'outro', rotulo: 'Outro' },
]
export const GRAVIDADES: { valor: GravidadeAlergia; rotulo: string }[] = [
  { valor: 'leve', rotulo: 'Leve' },
  { valor: 'moderada', rotulo: 'Moderada' },
  { valor: 'grave', rotulo: 'Grave / anafilaxia' },
  { valor: 'desconhecida', rotulo: 'Desconhecida' },
]
/** Graus do evento adverso (protótipo, SEV_E): o índice + 1 é o grau gravado. */
export const GRAUS_EVENTO = ['Muito leve', 'Leve', 'Moderado', 'Grave', 'Risco de morte', 'Morte'] as const

export const rotuloTipo = (t: string) => TIPOS_ALERGIA.find((x) => x.valor === t)?.rotulo ?? t
export const rotuloGravidade = (g: string) => GRAVIDADES.find((x) => x.valor === g)?.rotulo ?? g
export const rotuloGrau = (g: number) => GRAUS_EVENTO[g - 1] ?? `grau ${g}`

/**
 * Catálogo de alergênios do protótipo (ALERGENOS), com o tipo de cada um.
 * A trava da prescrição (private.alergia_que_trava, migration 20261003000008)
 * vale pelo medicamento, pelo nome e pela CLASSE: "Penicilinas" trava todos os
 * princípios ativos do grupo ATC J01C. Reação cruzada entre classes não trava.
 */
export const ALERGENOS: { nome: string; sub: string; tipo: TipoAlergia; classe?: boolean }[] = [
  { nome: 'Penicilinas', sub: 'betalactâmico', tipo: 'medicamento', classe: true },
  { nome: 'Cefalosporinas', sub: 'betalactâmico', tipo: 'medicamento', classe: true },
  { nome: 'Carbapenêmicos', sub: 'betalactâmico', tipo: 'medicamento', classe: true },
  { nome: 'Sulfonamidas', sub: 'sulfa', tipo: 'medicamento', classe: true },
  { nome: 'Dipirona', sub: 'pirazolona', tipo: 'medicamento' },
  { nome: 'Anti-inflamatórios não esteroides', sub: 'AINE', tipo: 'medicamento', classe: true },
  { nome: 'Ácido acetilsalicílico', sub: 'AINE', tipo: 'medicamento' },
  { nome: 'Paracetamol', sub: 'analgésico', tipo: 'medicamento' },
  { nome: 'Opioides', sub: 'morfina, tramadol, codeína', tipo: 'medicamento', classe: true },
  { nome: 'Macrolídeos', sub: 'azitromicina, claritromicina', tipo: 'medicamento', classe: true },
  { nome: 'Quinolonas', sub: 'ciprofloxacino, levofloxacino', tipo: 'medicamento', classe: true },
  { nome: 'Aminoglicosídeos', sub: 'gentamicina, amicacina', tipo: 'medicamento', classe: true },
  { nome: 'Vancomicina', sub: 'glicopeptídeo', tipo: 'medicamento' },
  { nome: 'Anticonvulsivantes aromáticos', sub: 'fenitoína, carbamazepina', tipo: 'medicamento', classe: true },
  { nome: 'Contraste iodado', sub: 'iodo', tipo: 'contraste' },
  { nome: 'Látex', sub: 'material', tipo: 'latex' },
  { nome: 'Esparadrapo / adesivos', sub: 'material', tipo: 'outro' },
  { nome: 'Clorexidina', sub: 'antisséptico', tipo: 'outro' },
  { nome: 'Iodopovidona', sub: 'antisséptico', tipo: 'outro' },
  { nome: 'Heparina', sub: 'anticoagulante', tipo: 'medicamento' },
  { nome: 'Insulina', sub: 'hormônio', tipo: 'medicamento' },
  { nome: 'Bloqueadores neuromusculares', sub: 'succinilcolina, rocurônio', tipo: 'medicamento', classe: true },
  { nome: 'Anestésicos locais', sub: 'lidocaína', tipo: 'medicamento', classe: true },
  { nome: 'Ovo', sub: 'alimento', tipo: 'alimento' },
  { nome: 'Leite de vaca', sub: 'alimento', tipo: 'alimento' },
  { nome: 'Amendoim', sub: 'alimento', tipo: 'alimento' },
  { nome: 'Frutos do mar', sub: 'alimento', tipo: 'alimento' },
  { nome: 'Picada de inseto', sub: 'himenópteros', tipo: 'outro' },
]

/** Sugestões de evento (o protótipo guarda o catálogo da unidade; aqui, os mais comuns). */
export const EVENTOS_COMUNS = [
  'Exantema', 'Urticária', 'Prurido', 'Angioedema', 'Broncoespasmo', 'Hipotensão', 'Anafilaxia', 'Náusea', 'Vômito',
  'Diarreia', 'Cefaleia', 'Tontura', 'Flebite', 'Febre', 'Bradicardia', 'Taquicardia', 'Sonolência', 'Depressão respiratória',
]

export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const chaveAlergias = (pacienteId: string) => ['alergias', pacienteId] as const

/** O painel completo do paciente (estado, alergias, "nega" e eventos, com autores). */
export function useAlergias(pacienteId: string | null | undefined) {
  return useQuery({
    queryKey: chaveAlergias(pacienteId ?? ''),
    enabled: !!pacienteId,
    staleTime: 15_000,
    queryFn: async (): Promise<PainelAlergias> => {
      const { data, error } = await supabase.rpc('alergias_do_paciente', { p_paciente: pacienteId! })
      if (error) throw error
      const p = data as unknown as PainelAlergias
      return { estado: p.estado, alergias: p.alergias ?? [], negacoes: p.negacoes ?? [], eventos: p.eventos ?? [] }
    },
  })
}

/** Invalida o painel (e o que depende da alergia, como a prescrição). */
export function useRecarregarAlergias(pacienteId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: chaveAlergias(pacienteId) })
    void qc.invalidateQueries({ queryKey: ['prescricao-vigente', pacienteId] })
  }
}

export const ativas = (p?: PainelAlergias) => (p?.alergias ?? []).filter((a) => !a.inativada_em)
/** A declaração vigente (nega ou desconhece), se houver; no máximo uma. */
export const declaracaoVigente = (p?: PainelAlergias) => (p?.negacoes ?? []).find((n) => !n.encerrada_em) ?? null
/** Só a negação explícita vigente ("nega alergias"). */
export const negaVigente = (p?: PainelAlergias) => {
  const d = declaracaoVigente(p)
  return d && d.tipo === 'nega' ? d : null
}
