// ─────────────────────────────────────────────────────────────────────────────
// Evolução do internado — dados e vocabulário (separado dos componentes para o
// fast refresh do Vite). Toda regra mora no banco
// (20261004000006_evolucao_estruturada.sql): a regra "uma por dia por
// profissional", o texto montado a partir do JSON, quem registra cada tipo.
// Aqui só se lê e se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { abrirProntuarioDaInternacao } from '@/lib/prontuario'
import type { Json } from '@/types/database'

// ── tipos do histórico (protótipo, EVOL_TIPOS, na ordem do manual 3.4) ──────
export type TipoRegistro =
  | 'evolucao'
  | 'evolucao_enfermagem'
  | 'anotacao_enfermagem'
  | 'evolucao_fisioterapia'
  | 'evolucao_nutricao'
  | 'evolucao_outros'
  | 'admissao_anamnese'

export const TIPOS_REGISTRO: { valor: TipoRegistro; rotulo: string }[] = [
  { valor: 'evolucao', rotulo: 'Evolução médica' },
  { valor: 'evolucao_enfermagem', rotulo: 'Evolução de enfermagem' },
  { valor: 'anotacao_enfermagem', rotulo: 'Anotação de enfermagem' },
  { valor: 'evolucao_fisioterapia', rotulo: 'Evolução de fisioterapia' },
  { valor: 'evolucao_nutricao', rotulo: 'Evolução de nutrição' },
  { valor: 'evolucao_outros', rotulo: 'Evolução de outros' },
  { valor: 'admissao_anamnese', rotulo: 'Admissão médica' },
]
export const rotuloTipo = (t: string) => TIPOS_REGISTRO.find((x) => x.valor === t)?.rotulo ?? t
export const ehMedico = (t: string) => t === 'evolucao' || t === 'admissao_anamnese'

// ── formulário da evolução médica estruturada (formato evolucao_medica_v1) ──
export type EstadoCid = 'hipotese' | 'confirmado'
export type AntimicrobianoManual = { nome: string; inicio: string }
export type FormEvolucao = {
  problemas: string
  antimicrobianosManuais: AntimicrobianoManual[]
  s: string
  sv: { pa: string; fc: string; fr: string; temp: string; spo2: string; glic: string; diurese: string; evacuacao: string; dieta: string }
  sv_condicao: '' | 'ar' | 'o2'
  o2_litros: string
  exame_fisico: { geral: string; acv: string; ar: string; abdome: string; extremidades: string; neuro: string }
  outros_achados: string
  exames: string
  a: string
  p: string
  cid: { codigo: string; descricao: string; estado: EstadoCid }
}

export const FORM_VAZIO: FormEvolucao = {
  problemas: '',
  antimicrobianosManuais: [],
  s: '',
  sv: { pa: '', fc: '', fr: '', temp: '', spo2: '', glic: '', diurese: '', evacuacao: '', dieta: '' },
  sv_condicao: '',
  o2_litros: '',
  exame_fisico: { geral: '', acv: '', ar: '', abdome: '', extremidades: '', neuro: '' },
  outros_achados: '',
  exames: '',
  a: '',
  p: '',
  cid: { codigo: '', descricao: '', estado: 'hipotese' },
}

/** Sinais vitais do formulário (protótipo: SV em evolExtra). */
export const CAMPOS_SV: { k: keyof FormEvolucao['sv']; rotulo: string; unidade?: string }[] = [
  { k: 'pa', rotulo: 'PA', unidade: 'mmHg' },
  { k: 'fc', rotulo: 'FC', unidade: 'bpm' },
  { k: 'fr', rotulo: 'FR', unidade: 'irpm' },
  { k: 'temp', rotulo: 'Temp.', unidade: '°C' },
  { k: 'spo2', rotulo: 'SpO₂', unidade: '%' },
  { k: 'glic', rotulo: 'Glicemia', unidade: 'mg/dL' },
  { k: 'diurese', rotulo: 'Diurese' },
  { k: 'evacuacao', rotulo: 'Evacuação' },
  { k: 'dieta', rotulo: 'Dieta' },
]
/** Exame físico por sistema (protótipo: EF). */
export const CAMPOS_EF: { k: keyof FormEvolucao['exame_fisico']; rotulo: string }[] = [
  { k: 'geral', rotulo: 'Geral' },
  { k: 'acv', rotulo: 'ACV' },
  { k: 'ar', rotulo: 'AR' },
  { k: 'abdome', rotulo: 'Abdome' },
  { k: 'extremidades', rotulo: 'Extremidades' },
  { k: 'neuro', rotulo: 'Neuro' },
]

/** Avisos antes de registrar (protótipo: evolAvisos). Não impedem o registro. */
export function avisosEvolucao(f: FormEvolucao): string[] {
  const A: string[] = []
  const vazio = (s: string) => !s.trim()
  const svF = (['pa', 'fc', 'fr', 'temp', 'spo2'] as const).filter((k) => vazio(f.sv[k])).map((k) => CAMPOS_SV.find((c) => c.k === k)!.rotulo)
  if (svF.length) A.push(`Sinais vitais em branco: ${svF.join(', ')}.`)
  if (!vazio(f.sv.spo2) && !f.sv_condicao) A.push('SpO₂ sem informar ar ambiente ou O₂.')
  const nomesEf: Record<string, string> = { geral: 'estado geral', acv: 'ACV', ar: 'AR', abdome: 'abdome', extremidades: 'extremidades', neuro: 'neurológico' }
  const efF = CAMPOS_EF.filter((c) => vazio(f.exame_fisico[c.k])).map((c) => nomesEf[c.k])
  if (efF.length) A.push(`Exame físico em branco: ${efF.join(', ')}.`)
  if (vazio(f.problemas)) A.push('Lista de problemas vazia.')
  const txt = [f.s, f.a, f.p, f.outros_achados, ...Object.values(f.exame_fisico)].join(' ')
  if ([/paciente bem/i, /quadro est[aá]vel/i, /sem altera[cç][oõ]es/i, /\bBEG\b/].some((r) => r.test(txt)))
    A.push('Termo vago no texto ("paciente bem", "quadro estável", "sem alterações", "BEG"). Descreva o achado objetivo.')
  return A
}

// ── leituras ────────────────────────────────────────────────────────────────
export type AntimicrobianoPrescrito = { item_id: string; nome: string; inicio: string; dia: number }
export type SvEnfermagem = {
  pa: string | null; fc: string | null; fr: string | null; temp: string | null; spo2: string | null; glic: string | null
  condicao: 'ar' | 'o2' | null; aferido_em: string; por: string | null
}
export type DadosEstruturados = Partial<{
  formato: string
  problemas: string
  antimicrobianos: { nome: string; inicio: string; origem?: string }[]
  s: string
  sv: Partial<FormEvolucao['sv']>
  sv_condicao: FormEvolucao['sv_condicao']
  o2_litros: string
  exame_fisico: Partial<FormEvolucao['exame_fisico']>
  outros_achados: string
  exames: string
  a: string
  p: string
  cid: Partial<FormEvolucao['cid']>
}>
export type ContextoEvolucao = {
  internacao_id: string
  paciente_id: string
  ativa: boolean
  data_admissao: string
  dih: number
  hoje: string
  cid_principal: string | null
  pode_registrar: boolean
  antimicrobianos: AntimicrobianoPrescrito[]
  dispositivos: string[]
  sv_enfermagem: SvEnfermagem | null
  minha_do_dia: { documento_id: string; raiz_id: string; criado_em: string; versao: number; estruturada: boolean; dados: DadosEstruturados } | null
  ultima_estruturada: { documento_id: string; criado_em: string; dados: DadosEstruturados } | null
}

export type AntibioticoResumo = {
  item_id: string; nome: string; inicio: string; suspenso_em: string | null; motivo_suspensao: string | null
  em_curso: boolean; dia: number; movimento: Movimento | null; motivo: string | null
}
export type Movimento = 'mantido' | 'escalonado' | 'descalonado'
export type ResumoClinicoDados = {
  sexo: string | null
  dih: number
  data_admissao: string
  ativa: boolean
  pode_registrar: boolean
  resumo: { id: string; texto: string; previsao_alta: string | null; criado_em: string; autor: string | null } | null
  antibioticos: AntibioticoResumo[]
  medicacoes: { item_id: string; nome: string; via: string; desde: string; reposicao: boolean }[]
  eletrolitos: { nome: string; valor: string; unidade: string | null; flag: 'L' | 'N' | 'H' | 'CRIT'; aferido_em: string }[]
  reposicoes: { item_id: string; nome: string; via: string; desde: string; suspenso_em: string | null }[]
  condutas: { texto: string; quando: string; quem: string | null }[]
}

export type RegistroHistorico = {
  id: string
  raiz_id: string
  tipo: TipoRegistro
  versao: number
  estado: 'ativo' | 'assinado' | 'cancelado'
  registrado_em: string
  corrigido_em: string | null
  motivo_correcao: string | null
  autor_id: string
  autor: string | null
  especialidade: string
  papel: 'do_dia' | 'complemento' | 'anotacao' | null
  estruturada: boolean
  texto: string
}

export const chaves = {
  contexto: (i: string) => ['evolucao-contexto', i] as const,
  resumo: (i: string) => ['resumo-clinico', i] as const,
  historico: (i: string) => ['historico-evolucoes', i] as const,
}

async function rpcJson<T>(nome: 'contexto_evolucao' | 'resumo_clinico' | 'historico_evolucoes', internacaoId: string): Promise<T> {
  // o log de acesso ao prontuário (a leitura fica registrada, como nas outras abas)
  await abrirProntuarioDaInternacao(internacaoId)
  const { data, error } = await supabase.rpc(nome, { p_internacao: internacaoId })
  if (error) throw error
  return data as unknown as T
}

export function useContextoEvolucao(internacaoId: string) {
  return useQuery({ queryKey: chaves.contexto(internacaoId), enabled: !!internacaoId, staleTime: 15_000,
    queryFn: () => rpcJson<ContextoEvolucao>('contexto_evolucao', internacaoId) })
}
export function useResumoClinico(internacaoId: string) {
  return useQuery({ queryKey: chaves.resumo(internacaoId), enabled: !!internacaoId, staleTime: 15_000,
    queryFn: () => rpcJson<ResumoClinicoDados>('resumo_clinico', internacaoId) })
}
export function useHistoricoEvolucoes(internacaoId: string) {
  return useQuery({ queryKey: chaves.historico(internacaoId), enabled: !!internacaoId, staleTime: 15_000,
    queryFn: async () => (await rpcJson<RegistroHistorico[]>('historico_evolucoes', internacaoId)) ?? [] })
}

/** Recarrega tudo o que depende de uma evolução nova (inclusive a lista antiga de documentos). */
export function useRecarregarEvolucao(internacaoId: string, pacienteId: string) {
  const qc = useQueryClient()
  return () => {
    for (const k of [chaves.contexto(internacaoId), chaves.resumo(internacaoId), chaves.historico(internacaoId)])
      void qc.invalidateQueries({ queryKey: k })
    void qc.invalidateQueries({ queryKey: ['documentos-clinicos', pacienteId] })
  }
}

// ── montar o JSON e voltar dele ─────────────────────────────────────────────
export function paraEstruturado(f: FormEvolucao, ctx: ContextoEvolucao, alergias: string): Json {
  return {
    formato: 'evolucao_medica_v1',
    dih: ctx.dih,
    alergias,
    problemas: f.problemas,
    antimicrobianos: [
      ...ctx.antimicrobianos.map((a) => ({ nome: a.nome, inicio: a.inicio, origem: 'prescricao' })),
      ...f.antimicrobianosManuais.map((a) => ({ nome: a.nome, inicio: a.inicio, origem: 'manual' })),
    ],
    dispositivos: ctx.dispositivos,
    s: f.s,
    sv: f.sv,
    sv_condicao: f.sv_condicao,
    o2_litros: f.sv_condicao === 'o2' ? f.o2_litros : '',
    exame_fisico: f.exame_fisico,
    outros_achados: f.outros_achados,
    exames: f.exames,
    a: f.a,
    p: f.p,
    cid: f.cid.codigo.trim() ? f.cid : { codigo: '', descricao: '', estado: f.cid.estado },
  }
}

/** Formulário a partir de uma evolução gravada (correção) — tudo volta. */
export function deEstruturado(d: DadosEstruturados): FormEvolucao {
  return {
    ...FORM_VAZIO,
    problemas: d.problemas ?? '',
    antimicrobianosManuais: (d.antimicrobianos ?? []).filter((a) => a.origem === 'manual').map((a) => ({ nome: a.nome, inicio: a.inicio })),
    s: d.s ?? '',
    sv: { ...FORM_VAZIO.sv, ...(d.sv ?? {}) },
    sv_condicao: d.sv_condicao ?? '',
    o2_litros: d.o2_litros ?? '',
    exame_fisico: { ...FORM_VAZIO.exame_fisico, ...(d.exame_fisico ?? {}) },
    outros_achados: d.outros_achados ?? '',
    exames: d.exames ?? '',
    a: d.a ?? '',
    p: d.p ?? '',
    cid: { ...FORM_VAZIO.cid, ...(d.cid ?? {}) },
  }
}

/** Nova evolução: lista de problemas, antimicrobianos incluídos à mão e CID seguem; o exame do dia recomeça (protótipo, "novo"). */
export function herdarDaUltima(d: DadosEstruturados | undefined): FormEvolucao {
  if (!d) return FORM_VAZIO
  return {
    ...FORM_VAZIO,
    problemas: d.problemas ?? '',
    antimicrobianosManuais: (d.antimicrobianos ?? []).filter((a) => a.origem === 'manual').map((a) => ({ nome: a.nome, inicio: a.inicio })),
    cid: { ...FORM_VAZIO.cid, ...(d.cid ?? {}) },
  }
}

// ── formatação ──────────────────────────────────────────────────────────────
const TZ = 'America/Sao_Paulo'
export const diaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: TZ }).replace(',', ' ·') : '—'
export const dataCurta = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ }) : '—'
export const dataLonga = (iso: string | null | undefined) =>
  iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR', { timeZone: TZ }) : '—'
/** Chave do dia (AAAA-MM-DD) no fuso da unidade. */
export const chaveDia = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: TZ })
export const mensagemErro = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
