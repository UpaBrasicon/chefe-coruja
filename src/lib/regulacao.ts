// Solicitação de regulação (Fase 4, tarefa 1; decisões do RT de 10/10/2026,
// revistas em 11/10/2026 depois da pesquisa dos sistemas de regulação:
// produto/docs/pesquisa/regulacao-modelos-sistemas.md).
// Rótulos e a conferência do formulário antes de enviar; o banco confere de
// novo (migration 20261107000001_regulacao_solicitacao.sql). Todo pedido
// guarda os campos do MIRA (Portaria GM/MS 9.262/2025).

export type TipoSolicitacao = 'consulta' | 'exame' | 'leito' | 'transferencia'
export type Carater = 'eletivo' | 'urgencia'
export type Prioridade = 'emergencia' | 'urgencia' | 'prioritaria' | 'eletiva' | 'nao_classificada'
export type DestinoTipo = 'rede' | 'externo' | 'a_definir'
export type StatusRegulacao = 'rascunho' | 'enviada' | 'em_analise' | 'pendencia' | 'devolvida' | 'autorizada' | 'agendada'
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
  autorizada: 'Autorizada', agendada: 'Agendada', em_transito: 'Em trânsito', realizada: 'Realizada', falta: 'Falta',
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
