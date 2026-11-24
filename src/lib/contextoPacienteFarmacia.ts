// Contexto do paciente para a farmácia (revisão do perfil Farmacêutico, RT
// 24/11/2026). Só leitura e texto: nada aqui calcula dose, converte dose de
// adulto para criança ou decide conduta.
//
// VA1: idade e alergias na validação (public.contexto_paciente_farmacia,
//      migration 20270422000040). Pediatria vai até 13 anos, 11 meses e 29
//      dias (o corte é do servidor, private.pediatrico_em; aqui só se mostra).
// DI3: quem fica sem o medicamento em falta, com leito e próximo horário
//      aprazado (public.pacientes_das_faltas), o horário mais próximo primeiro.
import { dataIso, diaMes, hora } from './formato.ts'

export type PublicoFarmacia = 'adulto' | 'pediatrico' | 'desconhecida'
export type EstadoAlergia = 'tem' | 'nega' | 'desconhece' | 'nao_registrada'
export type GravidadeAlergia = 'leve' | 'moderada' | 'grave' | 'desconhecida'

export type AlergiaAtiva = { substancia: string; tipo: string | null; reacao: string | null; gravidade: GravidadeAlergia | null }

export type ContextoPacienteFarmacia = {
  idade: { texto: string; anos: number; meses: number; dias: number; total_dias: number } | null
  publico: PublicoFarmacia
  alergias: { estado: EstadoAlergia; ativas: AlergiaAtiva[] }
  peso_kg: number | null
  peso_em: string | null
}

const ESTADOS: EstadoAlergia[] = ['tem', 'nega', 'desconhece', 'nao_registrada']
const PUBLICOS: PublicoFarmacia[] = ['adulto', 'pediatrico', 'desconhecida']
const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const inteiro = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null)

/**
 * Lê a resposta da função sem confiar no formato. Resposta estranha devolve
 * null: a tela diz "não foi possível ler" e não afirma nada (nem "nega").
 */
export function lerContexto(bruto: unknown): ContextoPacienteFarmacia | null {
  if (!bruto || typeof bruto !== 'object') return null
  const o = bruto as Record<string, unknown>
  const al = o.alergias as Record<string, unknown> | undefined
  const estado = al?.estado as EstadoAlergia
  if (!al || !ESTADOS.includes(estado)) return null
  const publico = PUBLICOS.includes(o.publico as PublicoFarmacia) ? (o.publico as PublicoFarmacia) : 'desconhecida'
  const i = o.idade as Record<string, unknown> | null | undefined
  const anos = inteiro(i?.anos), meses = inteiro(i?.meses), dias = inteiro(i?.dias), total = inteiro(i?.total_dias)
  const idade = i && texto(i.texto) && anos != null && meses != null && dias != null && total != null
    ? { texto: texto(i.texto)!, anos, meses, dias, total_dias: total }
    : null
  const ativas = (Array.isArray(al.ativas) ? al.ativas : [])
    .map((a) => a as Record<string, unknown>)
    .filter((a) => texto(a.substancia))
    .map((a): AlergiaAtiva => ({
      substancia: texto(a.substancia)!,
      tipo: texto(a.tipo),
      reacao: texto(a.reacao),
      gravidade: (['leve', 'moderada', 'grave', 'desconhecida'] as const).find((g) => g === a.gravidade) ?? null,
    }))
  const peso = typeof o.peso_kg === 'number' && o.peso_kg > 0 ? o.peso_kg : null
  return {
    idade,
    // sem idade não se afirma adulto
    publico: idade ? publico : 'desconhecida',
    // "tem" sem nenhuma substância legível não vira "nega": fica como tem, com a lista vazia
    alergias: { estado, ativas },
    peso_kg: peso,
    peso_em: peso ? texto(o.peso_em) : null,
  }
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** "13 anos, 11 meses e 29 dias", "8 meses e 3 dias", "12 dias" (partes zeradas saem). */
export function idadeDetalhada(i: { anos: number; meses: number; dias: number }): string {
  const partes = [
    i.anos > 0 ? plural(i.anos, 'ano', 'anos') : null,
    i.meses > 0 ? plural(i.meses, 'mês', 'meses') : null,
    i.dias > 0 || (i.anos === 0 && i.meses === 0) ? plural(i.dias, 'dia', 'dias') : null,
  ].filter((p): p is string => !!p)
  return partes.length > 1 ? `${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}` : partes[0]
}

/**
 * A idade na tela: no adulto, o texto curto do servidor ("34 anos"); na
 * pediatria, anos, meses e dias, porque a faixa decide a dose de referência.
 */
export function textoIdade(c: Pick<ContextoPacienteFarmacia, 'idade' | 'publico'>): { principal: string; faixa: string | null } {
  if (!c.idade) return { principal: 'Idade não registrada', faixa: 'sem data de nascimento: não trate como adulto' }
  if (c.publico === 'pediatrico') return { principal: idadeDetalhada(c.idade), faixa: 'Pediatria' }
  return { principal: c.idade.texto, faixa: null }
}

const GRAVIDADE: Record<GravidadeAlergia, string> = { leve: 'leve', moderada: 'moderada', grave: 'grave', desconhecida: 'gravidade não informada' }

export type TomAlergia = 'critico' | 'atencao' | 'neutro'

/**
 * Resumo da alergia nos quatro estados do app (tem, nega, desconhece, não
 * registrada). Alergia ativa é sempre crítica e vem com cada substância; "não
 * registrada" e "não soube informar" pedem atenção (lista vazia não é "nega").
 */
export function resumoAlergias(a: ContextoPacienteFarmacia['alergias']): {
  tom: TomAlergia; titulo: string; itens: { substancia: string; detalhe: string | null; grave: boolean }[]
} {
  if (a.estado === 'tem') {
    const itens = a.ativas.map((x) => ({
      substancia: x.substancia,
      detalhe: [x.gravidade ? GRAVIDADE[x.gravidade] : null, x.reacao].filter(Boolean).join(' · ') || null,
      grave: x.gravidade === 'grave',
    }))
    const titulo = itens.length === 0 ? 'Alergia registrada' : itens.length === 1 ? 'Alergia' : `${itens.length} alergias`
    return { tom: 'critico', titulo, itens }
  }
  if (a.estado === 'nega') return { tom: 'neutro', titulo: 'Nega alergias', itens: [] }
  if (a.estado === 'desconhece') return { tom: 'atencao', titulo: 'Alergia não informada (não soube)', itens: [] }
  return { tom: 'atencao', titulo: 'Alergia não registrada', itens: [] }
}

// ── DI3: quem fica sem o medicamento ────────────────────────────────────────

/** Uma linha de public.pacientes_das_faltas. */
export type HorarioFalta = {
  item_id: string; paciente_id: string; medicamento_id: string | null
  leito: string | null; setor: string | null; local: string | null
  se_necessario: boolean; aprazado: boolean; proximo_em: string | null; vencido: boolean
}

/** Lê a lista da função; o que não tiver item_id fica de fora. */
export function lerHorariosFalta(bruto: unknown): HorarioFalta[] {
  if (!Array.isArray(bruto)) return []
  return bruto
    .map((x) => x as Record<string, unknown>)
    .filter((x) => texto(x.item_id))
    .map((x) => ({
      item_id: String(x.item_id), paciente_id: String(x.paciente_id ?? ''), medicamento_id: texto(x.medicamento_id),
      leito: texto(x.leito), setor: texto(x.setor), local: texto(x.local) ?? texto(x.leito) ?? texto(x.setor),
      se_necessario: x.se_necessario === true, aprazado: x.aprazado === true,
      proximo_em: texto(x.proximo_em) && !Number.isNaN(Date.parse(String(x.proximo_em))) ? String(x.proximo_em) : null,
      vencido: x.vencido === true,
    }))
}

/**
 * Junta cada paciente da prescrição (nome, setor, dose) ao leito e ao próximo
 * horário pelo item, e ordena: o horário mais próximo primeiro; depois os sem
 * horário (se necessário, sem aprazamento, vencidos), pelo nome.
 */
export function ordenarQuemFicaSem<T extends { item_id: string; paciente: string }>(
  pacientes: T[], horarios: HorarioFalta[] | null | undefined,
): (T & { horario: HorarioFalta | null })[] {
  const porItem = new Map((horarios ?? []).map((h) => [h.item_id, h]))
  const vez = (h: HorarioFalta | null) => (h?.proximo_em ? Date.parse(h.proximo_em) : Number.POSITIVE_INFINITY)
  return pacientes
    .map((p) => ({ ...p, horario: porItem.get(p.item_id) ?? null }))
    .sort((a, b) => vez(a.horario) - vez(b.horario) || a.paciente.localeCompare(b.paciente, 'pt-BR'))
}

/**
 * "próxima dose hoje 14:00", "próxima dose amanhã 06:00", "se necessário",
 * "sem aprazamento", "prescrição vencida". Nulo quando não se leu o horário.
 */
export function textoProximoHorario(h: HorarioFalta | null, agora: number = Date.now()): string | null {
  if (!h) return null
  if (h.proximo_em) {
    const dia = dataIso(h.proximo_em)
    const quando = dia === dataIso(agora) ? 'hoje' : dia === dataIso(agora + 86_400_000) ? 'amanhã' : diaMes(h.proximo_em)
    return `próxima dose ${quando} ${hora(h.proximo_em)}`
  }
  if (h.vencido) return 'prescrição vencida'
  if (h.se_necessario) return 'se necessário'
  if (!h.aprazado) return 'sem aprazamento'
  return 'sem dose nas próximas 24 h'
}
