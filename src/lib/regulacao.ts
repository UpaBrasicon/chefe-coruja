// Solicitação de regulação (Fase 4, tarefa 1; decisões do RT de 10/10/2026,
// revistas em 11/10/2026 depois da pesquisa dos sistemas de regulação:
// produto/docs/pesquisa/regulacao-modelos-sistemas.md).
// Rótulos e a conferência do formulário antes de enviar; o banco confere de
// novo (migration 20261107000001_regulacao_solicitacao.sql). Todo pedido
// guarda os campos do MIRA (Portaria GM/MS 9.262/2025).

import { hora as horaBr } from './formato.ts'

export type TipoSolicitacao = 'consulta' | 'exame' | 'leito' | 'transferencia'
export type Carater = 'eletivo' | 'urgencia'
export type Prioridade = 'emergencia' | 'urgencia' | 'prioritaria' | 'eletiva' | 'nao_classificada'
export type DestinoTipo = 'rede' | 'externo' | 'a_definir'
export type StatusRegulacao = 'rascunho' | 'enviada' | 'em_analise' | 'pendencia' | 'devolvida' | 'aguardando_destino' | 'autorizada' | 'agendada'
  | 'em_transito' | 'realizada' | 'falta' | 'negada' | 'cancelada' | 'excluida'

export const TIPOS: Record<TipoSolicitacao, string> = {
  consulta: 'Consulta', exame: 'Exame', leito: 'Leito', transferencia: 'Transferência',
}

export const CARATER: Record<Carater, string> = { eletivo: 'Eletivo', urgencia: 'Urgência' }

/** Ordem de gravidade. Correspondência: SISREG vermelho/amarelo/verde/azul; e-SUS muito alta/alta/média/baixa. */
export const PRIORIDADES: Record<Prioridade, { rotulo: string; descricao: string; tom: 'critico' | 'atencao' | 'info' | 'neutro' }> = {
  emergencia: { rotulo: '1 · Emergência', descricao: 'Risco de vida imediato (SISREG vermelho, e-SUS muito alta)', tom: 'critico' },
  urgencia: { rotulo: '2 · Urgência', descricao: 'Resolução em horas (SISREG amarelo, e-SUS alta)', tom: 'atencao' },
  prioritaria: { rotulo: '3 · Prioritária', descricao: 'Não urgente, mas não pode esperar a fila comum (SISREG verde, e-SUS média)', tom: 'info' },
  eletiva: { rotulo: '4 · Eletiva', descricao: 'Pode aguardar a fila (SISREG azul, e-SUS baixa)', tom: 'neutro' },
  nao_classificada: { rotulo: 'Não classificada', descricao: 'O regulador da central classifica', tom: 'neutro' },
}

export const TIPOS_LEITO: Record<string, string> = {
  clinico: 'Clínico', cirurgico: 'Cirúrgico', pediatrico: 'Pediátrico', obstetrico: 'Obstétrico', psiquiatrico: 'Psiquiátrico',
  uti_adulto: 'UTI adulto', uti_pediatrica: 'UTI pediátrica', uti_neonatal: 'UTI neonatal',
  uci_adulto: 'UCI adulto', uci_pediatrica: 'UCI pediátrica', uci_neonatal: 'UCI neonatal',
  uti_queimados: 'UTI de queimados', unidade_coronariana: 'Unidade coronariana', outro: 'Outro',
}

export const INTERNACAO_PSIQUIATRICA: Record<string, string> = {
  voluntaria: 'Voluntária', involuntaria: 'Involuntária', compulsoria: 'Compulsória',
}

export const ISOLAMENTOS: Record<string, string> = { contato: 'Contato', goticula: 'Gotícula', aerossol: 'Aerossol' }

/** Portaria 2.048/2002: A sanitário, B básica, D avançada ("UTI móvel"), E aéreo, F embarcação. */
export const TRANSPORTES: Record<string, string> = {
  transporte_sanitario: 'Transporte sanitário (A)', ambulancia_basica: 'Ambulância básica — USB (B)',
  ambulancia_avancada: 'Ambulância avançada — USA / UTI móvel (D)', aereo: 'Aéreo (E)', embarcacao: 'Embarcação (F)',
  meios_proprios: 'Meios próprios',
}

export const STATUS: Record<StatusRegulacao, string> = {
  rascunho: 'Rascunho', enviada: 'Enviada', em_analise: 'Em análise', pendencia: 'Pendência', devolvida: 'Devolvida',
  aguardando_destino: 'Aguardando o destino', autorizada: 'Autorizada', agendada: 'Agendada', em_transito: 'Em trânsito', realizada: 'Realizada', falta: 'Falta',
  negada: 'Negada', cancelada: 'Cancelada', excluida: 'Excluída',
}

export type Formulario = {
  tipo: TipoSolicitacao
  procedimento: string
  especialidade: string
  cbo: string
  tipo_leito: string
  internacao_psiquiatrica: string
  isolamento: boolean
  isolamento_tipo: string
  transporte: string
  incubadora: '' | 'sim' | 'nao'
  destino_tipo: DestinoTipo
  destino_unidade_id: string
  destino_externo: string
  carater: Carater | ''
  prioridade: Prioridade | ''
  cid: string
  quadro_clinico: string
  tempo_evolucao: string
  sinais_vitais: string
  exames: string
  medicacoes: string
  hipotese: string
  telefone_contato: string
}

export const FORMULARIO_VAZIO: Formulario = {
  tipo: 'leito', procedimento: '', especialidade: '', cbo: '', tipo_leito: '', internacao_psiquiatrica: '',
  isolamento: false, isolamento_tipo: '', transporte: '', incubadora: '',
  destino_tipo: 'a_definir', destino_unidade_id: '', destino_externo: '', carater: '', prioridade: '', cid: '',
  quadro_clinico: '', tempo_evolucao: '', sinais_vitais: '', exames: '', medicacoes: '', hipotese: '', telefone_contato: '',
}

/** O que falta preencher, na ordem do formulário (vazio = pode enviar). */
export function faltasFormulario(f: Formulario, ctx: { neonato?: boolean; semDocumento?: boolean; naoIdentificado?: boolean } = {}): string[] {
  const faltas: string[] = []
  if (ctx.semDocumento && !ctx.naoIdentificado) faltas.push('CNS/CPF do paciente ou a marca de não identificado')
  if (!f.procedimento.trim()) faltas.push('procedimento do SIGTAP')
  if (f.tipo === 'consulta' && (!f.especialidade.trim() || !f.cbo.trim())) faltas.push('especialidade (CBO)')
  if (f.tipo === 'leito' && !f.tipo_leito) faltas.push('tipo de leito')
  if (f.tipo_leito === 'psiquiatrico' && !f.internacao_psiquiatrica) faltas.push('tipo de internação psiquiátrica')
  if (f.isolamento && !f.isolamento_tipo) faltas.push('tipo de isolamento')
  if (f.tipo === 'transferencia' && !f.transporte) faltas.push('transporte')
  if (f.tipo === 'transferencia' && ctx.neonato && !f.incubadora) faltas.push('incubadora (recém-nascido)')
  if (f.destino_tipo === 'rede' && !f.destino_unidade_id) faltas.push('unidade de destino')
  if (f.destino_tipo === 'externo' && f.destino_externo.trim().length < 3) faltas.push('serviço de destino')
  if (!f.carater) faltas.push('caráter')
  if (!f.prioridade) faltas.push('prioridade')
  if (!f.cid.trim()) faltas.push('CID-10')
  if (f.quadro_clinico.trim().length < 20) faltas.push('quadro clínico (mínimo de 20 letras)')
  return faltas
}

/** Só os campos do tipo escolhido vão para o banco. */
export function dadosParaEnvio(f: Formulario, extra: { episodio_id?: string | null; internacao_id?: string | null;
  medico_assistente_id?: string | null; paciente_nao_identificado?: boolean }) {
  const leitoOuTransf = f.tipo === 'leito' || f.tipo === 'transferencia'
  const t = (v: string) => v.trim() || null
  return {
    tipo: f.tipo,
    procedimento: f.procedimento,
    especialidade: f.tipo === 'consulta' ? t(f.especialidade) : null,
    cbo: f.tipo === 'consulta' ? t(f.cbo) : null,
    tipo_leito: leitoOuTransf ? f.tipo_leito || null : null,
    internacao_psiquiatrica: leitoOuTransf && f.tipo_leito === 'psiquiatrico' ? f.internacao_psiquiatrica || null : null,
    isolamento: f.isolamento,
    isolamento_tipo: f.isolamento ? f.isolamento_tipo || null : null,
    transporte: f.tipo === 'transferencia' ? f.transporte : null,
    incubadora: f.tipo === 'transferencia' && f.incubadora ? f.incubadora === 'sim' : null,
    destino_tipo: f.destino_tipo,
    destino_unidade_id: f.destino_tipo === 'rede' ? f.destino_unidade_id : null,
    destino_externo: f.destino_tipo === 'externo' ? t(f.destino_externo) : null,
    carater: f.carater,
    prioridade: f.prioridade,
    cid: f.cid,
    quadro_clinico: f.quadro_clinico.trim(),
    tempo_evolucao: t(f.tempo_evolucao),
    sinais_vitais: t(f.sinais_vitais),
    exames: t(f.exames),
    medicacoes: t(f.medicacoes),
    hipotese: t(f.hipotese),
    telefone_contato: t(f.telefone_contato),
    episodio_id: extra.episodio_id ?? null,
    internacao_id: extra.internacao_id ?? null,
    medico_assistente_id: extra.medico_assistente_id ?? null,
    paciente_nao_identificado: extra.paciente_nao_identificado ?? false,
  }
}

/** "Leito · UTI adulto", "Exame · 0206010079 TOMOGRAFIA…", "Consulta · Cardiologia". */
export function resumoPedido(s: { tipo: TipoSolicitacao; especialidade?: string | null; procedimento?: string | null;
  procedimento_nome?: string | null; tipo_leito?: string | null; transporte?: string | null }): string {
  const det = s.tipo === 'consulta' ? s.especialidade
    : s.tipo === 'exame' ? [s.procedimento, s.procedimento_nome].filter(Boolean).join(' ')
    : s.tipo === 'leito' ? (s.tipo_leito ? TIPOS_LEITO[s.tipo_leito] ?? s.tipo_leito : null)
    : s.transporte ? TRANSPORTES[s.transporte] ?? s.transporte : null
  return det ? `${TIPOS[s.tipo]} · ${det}` : TIPOS[s.tipo]
}

/** Recém-nascido: até 27 dias de vida (a incubadora precisa ser informada na transferência). */
export function ehNeonato(nascimento: string | null | undefined, hoje: string): boolean {
  if (!nascimento) return false
  const dias = Math.round((Date.parse(hoje + 'T12:00:00Z') - Date.parse(nascimento + 'T12:00:00Z')) / 86_400_000)
  return dias >= 0 && dias < 28
}

/** Tempo de espera na fila: "agora", "12 min", "2 h 05 min", "3 d 4 h". */
export function formatarEspera(segundos: number): string {
  const min = Math.max(0, Math.floor(segundos / 60))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h ${String(min % 60).padStart(2, '0')} min`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}

export type FiltrosFila = {
  tipo?: TipoSolicitacao; prioridade?: Prioridade; unidade_origem_id?: string; status?: StatusRegulacao[]
  carater?: Carater; tipo_leito?: string; isolamento?: boolean; busca?: string
}

/** Só os filtros preenchidos vão para o banco (vazio = padrão: em aberto na central). */
export function filtrosParaEnvio(f: FiltrosFila): Record<string, unknown> {
  const saida: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) continue
    if (k === 'busca' && typeof v === 'string') { if (v.trim()) saida.busca = v.trim(); continue }
    saida[k] = v
  }
  return saida
}

/** Ids que chegaram desde a última leitura (para destacar na fila). */
export function novosDesde(anteriores: Set<string> | null, atuais: string[]): Set<string> {
  if (!anteriores) return new Set()
  return new Set(atuais.filter((id) => !anteriores.has(id)))
}

// ── priorização clínica (Fase 4, tarefa 3) ──────────────────────────────────
export type Vulnerabilidade = 'gestante' | 'idoso' | 'crianca' | 'pcd' | 'situacao_rua' | 'oncologico' | 'judicializado'

/** Selos, sem pontuação (Portaria GM/MS 9.262/2025: risco, tempo e vulnerabilidade). */
export const VULNERABILIDADES: Record<Vulnerabilidade, string> = {
  gestante: 'Gestante', idoso: 'Idoso (60+)', crianca: 'Criança', pcd: 'Pessoa com deficiência',
  situacao_rua: 'Situação de rua', oncologico: 'Oncológico', judicializado: 'Judicializado',
}

/** Prioridade que vale na fila: a do regulador, se houver; senão a proposta. */
export function prioridadeEfetiva(s: { prioridade: Prioridade; prioridade_regulador?: Prioridade | null }): Prioridade {
  return s.prioridade_regulador ?? s.prioridade
}

/**
 * Marcadores que a idade já indica, para vir marcados (o solicitante pode
 * desmarcar): idoso a partir de 60 anos; criança até 13 anos, 11 meses e 29
 * dias (definição pediátrica da unidade).
 */
export function marcadoresPelaIdade(nascimento: string | null | undefined, hoje: string): Vulnerabilidade[] {
  if (!nascimento) return []
  const [a, m, d] = nascimento.split('-').map(Number)
  const [ha, hm, hd] = hoje.split('-').map(Number)
  const anos = ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0)
  if (anos >= 60) return ['idoso']
  if (anos < 14 && anos >= 0) return ['crianca']
  return []
}

// ── decisão do regulador (Fase 4, tarefa 4) ─────────────────────────────────
export type MotivoNegacao = 'sem_indicacao' | 'sem_oferta' | 'fora_escopo' | 'duplicidade' | 'ja_atendido_obito' | 'outro'

export const MOTIVOS_NEGACAO: Record<MotivoNegacao, string> = {
  sem_indicacao: 'Sem indicação clínica', sem_oferta: 'Sem oferta na rede', fora_escopo: 'Fora do escopo da central',
  duplicidade: 'Duplicidade', ja_atendido_obito: 'Paciente já atendido ou óbito', outro: 'Outro',
}

/** Pedido em que o regulador ainda decide (na fila da central). */
export function emDecisao(status: StatusRegulacao): boolean {
  return status === 'enviada' || status === 'em_analise' || status === 'pendencia'
}

/** 'aaaa-mm-ddThh:mm' do campo datetime-local → ISO com o fuso de quem preenche (vazio → null). */
export function dataHoraLocalParaIso(v: string): string | null {
  if (!v) return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// ── anexos (Fase 4, tarefa 6) ───────────────────────────────────────────────
export const ANEXO_TIPOS = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const ANEXO_LIMITE_BYTES = 10 * 1024 * 1024

/** Confere o arquivo antes de enviar (o banco e o armazenamento conferem de novo). */
// Sem teto de anexos por pedido (decisão do RT, 11/10/2026); o limite é por arquivo.
export function erroArquivo(f: { type: string; size: number }): string | null {
  if (!(ANEXO_TIPOS as readonly string[]).includes(f.type)) return 'Envie PDF, JPG ou PNG.'
  if (f.size <= 0 || f.size > ANEXO_LIMITE_BYTES) return 'O arquivo vai até 10 MB.'
  return null
}

/** Caminho no armazenamento: a pasta é o pedido; o nome sem acento nem espaço. */
export function caminhoAnexo(solicitacaoId: string, nome: string, agora: number): string {
  const seguro = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-120)
  return `${solicitacaoId}/${agora}-${seguro}`
}

// ── prazos (SLA) da regulação (Fase 4, tarefa 7) ────────────────────────────
export type Sla = {
  fila: { prazo_min: number | null; central_seg: number; correndo: boolean; atrasado: boolean }
  pendencia: { desde: string; prazo_h: number; vence_em: string; atrasada: boolean } | null
  evolucao: { ultima_em: string; prazo_h: number; vence_em: string; atrasada: boolean; limite_h: number; risco_cancelamento: boolean } | null
  atrasado_central: boolean
  atrasado_origem: boolean
  /** Tarefa 9: espera pelo aceite do destino. Ausente em respostas antigas. */
  destino?: { desde: string; prazo_h: number; vence_em: string; atrasado: boolean } | null
  atrasado_destino?: boolean
}
export type NivelFila = 'emergencia' | 'urgencia' | 'prioritaria' | 'eletiva'
export const NIVEIS_FILA: NivelFila[] = ['emergencia', 'urgencia', 'prioritaria', 'eletiva']
export type Prazos = {
  central_id: string; fila: Record<NivelFila, number | null>
  evolucao_h: number; pendencia_h: number; sem_evolucao_h: number; destino_h: number
  ajustado: boolean; atualizado_em: string | null; atualizado_por: string | null
}
/** Formulário dos prazos: texto, como digitado. Fila vazia = sem prazo. */
export type FormPrazos = { fila: Record<NivelFila, string>; evolucao_h: string; pendencia_h: string; sem_evolucao_h: string; destino_h: string }

export function prazosParaForm(p: Prazos): FormPrazos {
  const fila = Object.fromEntries(NIVEIS_FILA.map((k) => [k, p.fila[k] == null ? '' : String(p.fila[k])])) as Record<NivelFila, string>
  return {
    fila, evolucao_h: String(p.evolucao_h), pendencia_h: String(p.pendencia_h), sem_evolucao_h: String(p.sem_evolucao_h),
    destino_h: String(p.destino_h ?? 24),
  }
}

const inteiro = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v.trim()) : NaN)

/** Mesmas regras do banco (regulacao_definir_prazos). */
export function errosPrazos(f: FormPrazos): string[] {
  const erros: string[] = []
  for (const k of NIVEIS_FILA) {
    const v = f.fila[k].trim()
    if (v && !(inteiro(v) >= 1 && inteiro(v) <= 43200)) erros.push(`Fila (${PRIORIDADES[k].rotulo}): de 1 minuto a 30 dias, ou vazio.`)
  }
  const evol = inteiro(f.evolucao_h), pend = inteiro(f.pendencia_h), sem = inteiro(f.sem_evolucao_h)
  if (!(evol >= 1 && evol <= 168)) erros.push('Evolução: de 1 a 168 horas.')
  if (!(pend >= 1 && pend <= 72)) erros.push('Resposta à pendência: de 1 a 72 horas.')
  if (!(sem >= 2 && sem <= 720) || !(sem > evol)) erros.push('Sem evolução: até 720 horas e maior que o prazo da evolução.')
  const dest = inteiro(f.destino_h)
  if (!(dest >= 1 && dest <= 168)) erros.push('Resposta do destino: de 1 a 168 horas.')
  return erros
}

export function prazosParaEnvio(f: FormPrazos) {
  return {
    fila: Object.fromEntries(NIVEIS_FILA.map((k) => [k, f.fila[k].trim() ? inteiro(f.fila[k]) : null])),
    evolucao_h: inteiro(f.evolucao_h), pendencia_h: inteiro(f.pendencia_h), sem_evolucao_h: inteiro(f.sem_evolucao_h),
    destino_h: inteiro(f.destino_h),
  }
}

export type AlertaSla = { texto: string; tom: 'critico' | 'atencao' | 'neutro' }

/**
 * Selos dos relógios de um pedido. A central vê o prazo da fila e o que a
 * origem deve; a origem vê os relógios dela e, se houver, o atraso da central.
 */
export function alertasSla(sla: Sla | null | undefined, agoraMs: number): AlertaSla[] {
  if (!sla) return []
  const a: AlertaSla[] = []
  const hora = (iso: string) => horaBr(iso)
  const fila = sla.fila
  if (fila.prazo_min != null) {
    const usado = `${formatarEspera(fila.central_seg)} de ${formatarEspera(fila.prazo_min * 60)}`
    if (fila.atrasado) a.push({ texto: `Fila: prazo vencido (${usado})${fila.correndo ? '' : ', pausado'}`, tom: fila.correndo ? 'critico' : 'neutro' })
    else a.push({ texto: `Fila: ${usado}${fila.correndo ? '' : ' (pausado)'}`, tom: 'neutro' })
  }
  if (sla.pendencia) {
    a.push(sla.pendencia.atrasada
      ? { texto: `Resposta à central vencida (${sla.pendencia.prazo_h} h)`, tom: 'critico' }
      : { texto: `Responder à central até ${hora(sla.pendencia.vence_em)}`, tom: 'atencao' })
  }
  if (sla.destino) {
    a.push(sla.destino.atrasado
      ? { texto: `Destino sem resposta (${sla.destino.prazo_h} h)`, tom: 'critico' }
      : { texto: `Destino responde até ${hora(sla.destino.vence_em)}`, tom: 'neutro' })
  }
  if (sla.evolucao) {
    const e = sla.evolucao
    if (e.risco_cancelamento) a.push({ texto: `${e.limite_h} h sem evolução: risco de cancelamento`, tom: 'critico' })
    else if (e.atrasada) a.push({ texto: `Evolução vencida (${e.prazo_h} h)`, tom: 'critico' })
    else if (new Date(e.vence_em).getTime() - agoraMs <= 2 * 3600_000) a.push({ texto: `Evolução até ${hora(e.vence_em)}`, tom: 'atencao' })
  }
  return a
}

// ── mapa de vagas (Fase 4, tarefa 8) ────────────────────────────────────────
export type TipoServico = 'exame' | 'consulta' | 'procedimento' | 'cirurgia' | 'outro'
export const TIPOS_SERVICO: Record<TipoServico, string> = {
  exame: 'Exame', consulta: 'Consulta', procedimento: 'Procedimento', cirurgia: 'Cirurgia', outro: 'Outro',
}
export type SituacaoServico = 'disponivel' | 'restrito' | 'indisponivel'
export const SITUACOES_SERVICO: Record<SituacaoServico, { rotulo: string; tom: 'sucesso' | 'atencao' | 'critico' }> = {
  disponivel: { rotulo: 'Disponível', tom: 'sucesso' },
  restrito: { rotulo: 'Restrito', tom: 'atencao' },
  indisponivel: { rotulo: 'Indisponível', tom: 'critico' },
}
export type FormServico = {
  nome: string; tipo: TipoServico | ''; procedimento: string; situacao: SituacaoServico | ''; vagas: string; observacao: string
}
export const SERVICO_VAZIO: FormServico = { nome: '', tipo: '', procedimento: '', situacao: '', vagas: '', observacao: '' }

/** Mesmas regras do banco (regulacao_salvar_servico), menos a existência do SIGTAP. */
export function errosServico(f: FormServico): string[] {
  const e: string[] = []
  if (f.nome.trim().length < 3) e.push('Escreva o nome do serviço.')
  if (!f.tipo) e.push('Escolha o tipo.')
  if (!f.situacao) e.push('Escolha a situação.')
  if (f.procedimento.trim() && !/^\d{10}$/.test(f.procedimento.trim())) e.push('Procedimento SIGTAP: 10 dígitos.')
  if (f.vagas.trim() && !/^\d{1,4}$/.test(f.vagas.trim())) e.push('Vagas: número de 0 a 9999, ou vazio.')
  return e
}

export function servicoParaEnvio(f: FormServico) {
  return {
    nome: f.nome.trim(), tipo: f.tipo, situacao: f.situacao, procedimento: f.procedimento.trim() || null,
    vagas: f.vagas.trim() || null, observacao: f.observacao.trim() || null,
  }
}

// ── aceite pela unidade destino (Fase 4, tarefa 9) ──────────────────────────
export type MotivoRecusaDestino = 'sem_vaga' | 'sem_recurso' | 'perfil_incompativel' | 'outro'
export const MOTIVOS_RECUSA_DESTINO: Record<MotivoRecusaDestino, string> = {
  sem_vaga: 'Sem leito ou vaga', sem_recurso: 'Sem o recurso ou a especialidade',
  perfil_incompativel: 'Perfil clínico fora do serviço', outro: 'Outro',
}
export type MeioConfirmacao = 'telefone' | 'sistema_externo' | 'presencial' | 'outro'
export const MEIOS_CONFIRMACAO: Record<MeioConfirmacao, string> = {
  telefone: 'Telefone', sistema_externo: 'Sistema externo', presencial: 'Presencial', outro: 'Outro',
}
/** O pedido está com o destino: esperando aceite ou esperando a chegada. */
export function esperandoChegada(status: StatusRegulacao): boolean {
  return status === 'autorizada' || status === 'agendada' || status === 'em_transito'
}
