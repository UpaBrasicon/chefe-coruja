import {
  Activity,
  Bell,
  Bird,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  DoorOpen,
  Eye,
  FlaskConical,
  FolderSearch,
  Hospital,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  MonitorSmartphone,
  ScrollText,
  Shield,
  ShieldCheck,
  SquareCheckBig,
  Stethoscope,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { ClipboardPlus, Gauge, Hourglass, Monitor, TriangleAlert } from 'lucide-react'
import { FileCheck, FileDown, FileText, History, KeyRound, Receipt, Rocket, Video, Waypoints } from 'lucide-react'
import { FileWarning, GitMerge, LifeBuoy, Network, Pill, ShieldAlert, Siren } from 'lucide-react'

import type { Papel } from '@/types/database'

/** Chave da nota numérica (contagem em âmbar ao lado do item). */
export type ChaveNota = 'avisos' | 'triagem' | 'farmacia' | 'pedidos' | 'tele' | 'revisao' | 'fila_medica' | 'plataformas' | 'chamados'

export type ItemNav = {
  to: string
  rotulo: string
  /** Rótulo curto para a barra inferior do celular. */
  curto?: string
  icone: LucideIcon
  /** Casa só a rota exata (NavLink `end`). */
  exato?: boolean
  /** A nota do item: pendências que moram naquela tela. */
  nota?: ChaveNota
}

// Navegação por papel (P/index.html ~32220). Um papel por vez: quem tem mais
// de um na unidade troca pelo menu do usuário. Só entram destinos que existem
// no app; os que o protótipo tem e o app ainda não (Histórico, Protocolos e
// Farmácia do gestor; Pronto Socorro, Notificações e Internação da enfermagem) chegam com as
// ondas do porte (produto/docs/PLANO-PORTE-FRONTEND.md).
const ITEM_PRONTUARIOS: ItemNav = { to: '/prontuarios', rotulo: 'Prontuários', icone: FolderSearch }
const ITEM_AVISOS: ItemNav = { to: '/notificacoes', rotulo: 'Avisos', icone: Bell, exato: true, nota: 'avisos' }

const POR_PAPEL: Record<Papel, ItemNav[]> = {
  plantonista: [
    { to: '/plantonista', rotulo: 'Central do Plantonista', curto: 'Central', icone: Stethoscope },
    { to: '/plantao', rotulo: 'Plantão', icone: Activity },
    { to: '/contingencia', rotulo: 'Contingência', icone: FileWarning, exato: true },
    { to: '/atendimento', rotulo: 'Atendimento', icone: DoorOpen, exato: true },
    { to: '/teleinterconsulta', rotulo: 'Telemedicina', curto: 'Tele', icone: MonitorSmartphone, exato: true, nota: 'tele' },
    { to: '/pareceres', rotulo: 'Pareceres', icone: MessageSquare, exato: true },
    { to: '/notificacao-compulsoria', rotulo: 'Notificação compulsória', curto: 'Notificação', icone: Shield, exato: true },
    { to: '/plantonista/farmacia', rotulo: 'Farmácia', icone: FlaskConical },
    { to: '/agenda', rotulo: 'Minha Agenda', curto: 'Agenda', icone: CalendarClock, exato: true },
    ITEM_AVISOS,
    ITEM_PRONTUARIOS,
  ],
  gestor: [
    { to: '/gestao', rotulo: 'Painel', icone: LayoutDashboard, exato: true },
    { to: '/gestao/porta', rotulo: 'Porta', icone: DoorOpen, exato: true },
    { to: '/gestao/intercorrencias', rotulo: 'Intercorrências', curto: 'Intercorr.', icone: Siren, exato: true },
    { to: '/cadastros-duplicados', rotulo: 'Cadastros duplicados', curto: 'Duplicados', icone: GitMerge, exato: true },
    { to: '/gestao/gaviao', rotulo: 'Olho de Gavião', curto: 'Gavião', icone: Bird, exato: true },
    { to: '/escala', rotulo: 'Escala', icone: CalendarClock, exato: true },
    { to: '/gestao/farmacia', rotulo: 'Farmácia', icone: FlaskConical, exato: true },
    { to: '/alta-vigilancia', rotulo: 'Alta vigilância', curto: 'Alta vig.', icone: ShieldAlert, exato: true },
    { to: '/interacoes', rotulo: 'Interações críticas', curto: 'Interações', icone: Pill, exato: true },
    { to: '/unidade', rotulo: 'Unidade', icone: Building2, exato: true },
    { to: '/internacao', rotulo: 'Internação', icone: Hospital, exato: true },
    // Fase 3: o gestor acompanha as AIHs; quem decide é o médico regulador
    { to: '/aih', rotulo: 'AIH', icone: FileText, exato: true },
    { to: '/faturamento', rotulo: 'Faturamento (BPA)', curto: 'BPA', icone: Receipt, exato: true },
    { to: '/apac', rotulo: 'APAC', icone: FileCheck, exato: true },
    { to: '/observacao', rotulo: 'Observação', icone: Eye, exato: true },
    { to: '/auditoria', rotulo: 'Auditoria', icone: ScrollText, exato: true, nota: 'pedidos' },
    { to: '/gestao/protocolos', rotulo: 'Protocolos', icone: ClipboardPlus, exato: true },
    // o gestor acompanha a revisão; quem decide é o responsável técnico
    { to: '/revisao-clinica', rotulo: 'Revisão Clínica', curto: 'Revisão', icone: SquareCheckBig, exato: true },
    { to: '/indicadores', rotulo: 'Indicadores', icone: LineChart, exato: true },
    // Fase 4, tarefa 11: o gestor acompanha o painel do NIR
    { to: '/nir', rotulo: 'Pendências (NIR)', curto: 'NIR', icone: ClipboardList, exato: true },
    // 30/09/2026: chamado técnico da unidade (a administração da rede atende)
    { to: '/gestao/chamados', rotulo: 'Chamados técnicos', curto: 'Chamados', icone: LifeBuoy, exato: true },
  ],
  // Enfermagem (P/index.html 32225–32230): o técnico não tem Triagem nem
  // Notificações; a tela inicial dele segue a escala (InicioEnfermagem).
  enfermeiro: [
    { to: '/triagem', rotulo: 'Triagem', icone: Activity, exato: true, nota: 'triagem' },
    { to: '/enfermagem/pronto-socorro', rotulo: 'Pronto Socorro', curto: 'PS', icone: Stethoscope, exato: true },
    { to: '/notificacao-compulsoria', rotulo: 'Notificações', icone: Shield, exato: true },
    { to: '/enfermagem/internacao', rotulo: 'Internação', icone: Users, exato: true },
    { to: '/checagem', rotulo: 'Checagem', icone: ClipboardCheck, exato: true },
    { to: '/alta-vigilancia', rotulo: 'Alta vigilância', curto: 'Alta vig.', icone: ShieldAlert, exato: true },
    { to: '/contingencia', rotulo: 'Contingência', icone: FileWarning, exato: true },
    ITEM_AVISOS,
    ITEM_PRONTUARIOS,
  ],
  tecnico_enfermagem: [
    { to: '/enfermagem/pronto-socorro', rotulo: 'Pronto Socorro', curto: 'PS', icone: Stethoscope, exato: true },
    { to: '/enfermagem/internacao', rotulo: 'Internação', icone: Users, exato: true },
    { to: '/checagem', rotulo: 'Checagem', icone: ClipboardCheck, exato: true },
    ITEM_AVISOS,
    ITEM_PRONTUARIOS,
  ],
  // Recepção (P/index.html 32220–32224): as quatro telas na lateral, com a
  // contagem das duas filas.
  recepcao: [
    { to: '/recepcao', rotulo: 'Nova ficha', curto: 'Ficha', icone: ClipboardPlus, exato: true },
    { to: '/recepcao/fila-triagem', rotulo: 'Fila da triagem', curto: 'Triagem', icone: Hourglass, exato: true, nota: 'triagem' },
    { to: '/recepcao/fila-medica', rotulo: 'Fila médica', curto: 'Médica', icone: Stethoscope, exato: true, nota: 'fila_medica' },
    { to: '/recepcao/painel', rotulo: 'Painel de chamada', curto: 'Painel', icone: Monitor, exato: true },
    { to: '/cadastros-duplicados', rotulo: 'Cadastros duplicados', curto: 'Duplicados', icone: GitMerge, exato: true },
  ],
  // Fase 3, tarefa 1: médico regulador — decide a AIH (aprova com número e
  // competência, ou rejeita com motivo)
  regulador: [
    { to: '/aih', rotulo: 'Pedidos de AIH', curto: 'AIH', icone: FileText, exato: true },
    { to: '/apac', rotulo: 'Pedidos de APAC', curto: 'APAC', icone: FileCheck, exato: true },
  ],
  // Fase 3, tarefa 3: faturamento (sem escala) — conferência e fechamento do
  // BPA, lançamento de procedimentos e códigos SIGTAP da unidade
  faturamento: [
    { to: '/faturamento', rotulo: 'BPA', icone: Receipt, exato: true },
    { to: '/apac', rotulo: 'APAC', icone: FileCheck, exato: true },
  ],
  farmaceutico: [
    { to: '/farmacia', rotulo: 'Central do Farmacêutico', curto: 'Farmácia', icone: FlaskConical, exato: true, nota: 'farmacia' },
    { to: '/alta-vigilancia', rotulo: 'Alta vigilância', curto: 'Alta vig.', icone: ShieldAlert, exato: true },
    { to: '/interacoes', rotulo: 'Interações críticas', curto: 'Interações', icone: Pill, exato: true },
    ITEM_PRONTUARIOS,
  ],
  telemedicina: [
    { to: '/teleinterconsulta', rotulo: 'Minha fila', curto: 'Fila', icone: Hourglass, exato: true, nota: 'tele' },
    { to: '/telemedicina/salas', rotulo: 'Salas em andamento', curto: 'Salas', icone: Video, exato: true },
    { to: '/telemedicina/agenda', rotulo: 'Minha agenda', curto: 'Agenda', icone: CalendarClock, exato: true },
    { to: '/telemedicina/telemonitoramento', rotulo: 'Telemonitoramento', curto: 'Monitor', icone: Activity, exato: true },
    { to: '/telemedicina/assinaturas', rotulo: 'Assinaturas pendentes', curto: 'Assinar', icone: FileText, exato: true },
    { to: '/telemedicina/historico', rotulo: 'Histórico e auditoria', curto: 'Histórico', icone: History, exato: true },
    { to: '/telemedicina/credenciais', rotulo: 'Unidades e credenciais', curto: 'Credenciais', icone: ShieldCheck, exato: true },
    ITEM_PRONTUARIOS,
  ],
  // Administrador (P/index.html 32242–32246): Rede, Plataformas, Pendências e
  // Servidores; Escala e Olho de Gavião continuam do app.
  // Fase 4, tarefa 12: papéis de rede (Secretaria), escalados na unidade Secretaria
  secretaria: [{ to: '/rede', rotulo: 'Rede', icone: Network, exato: true }, ITEM_AVISOS],
  regulacao_regional: [{ to: '/rede', rotulo: 'Rede', icone: Network, exato: true }, ITEM_AVISOS],
  faturamento_rede: [{ to: '/rede', rotulo: 'Rede', icone: Network, exato: true }],
  // Fase 4, tarefa 11: NIR — pendências da unidade e a regulação (sem ato médico)
  nir: [
    { to: '/nir', rotulo: 'Pendências', icone: ClipboardList, exato: true },
    { to: '/regulacao', rotulo: 'Regulação', icone: Waypoints, exato: true },
    ITEM_AVISOS,
  ],
  admin: [
    { to: '/painel', rotulo: 'Rede', icone: Building2, exato: true },
    { to: '/plataformas', rotulo: 'Plataformas', icone: LayoutDashboard, exato: true, nota: 'plataformas' },
    { to: '/pendencias-tecnicas', rotulo: 'Pendências', icone: ClipboardList, exato: true, nota: 'chamados' },
    { to: '/servidores', rotulo: 'Servidores', icone: Gauge, exato: true },
    { to: '/escala', rotulo: 'Escala', icone: CalendarClock, exato: true },
    { to: '/gaviao', rotulo: 'Olho de Gavião', curto: 'Gavião', icone: ShieldCheck, exato: true },
  ],
}

const ITEM_REVISAO_CLINICA: ItemNav = { to: '/revisao-clinica', rotulo: 'Revisão Clínica', curto: 'Revisão', icone: SquareCheckBig, exato: true, nota: 'revisao' }

// "Erros e alertas" é do administrador geral (RequireSuperAdmin em App.tsx):
// o administrador da organização que não é super admin não vê o item
const ITEM_ERROS_E_ALERTAS: ItemNav = { to: '/erros-e-alertas', rotulo: 'Erros e alertas', icone: TriangleAlert, exato: true }
// Fase 3, tarefa 7: chaves da API para integradores (o super admin cria; o gestor vê e revoga)
const ITEM_INTEGRACOES: ItemNav = { to: '/integracoes', rotulo: 'Integrações (API)', curto: 'API', icone: KeyRound, exato: true }
// Fase 3, tarefa 9: exportação estruturada (gestor e super admin)
const ITEM_EXPORTAR: ItemNav = { to: '/exportar', rotulo: 'Exportar dados', curto: 'Exportar', icone: FileDown, exato: true }
// Fase 3, tarefa 10: implantação da unidade (implantador e gestor)
const ITEM_IMPLANTACAO: ItemNav = { to: '/implantacao', rotulo: 'Implantação', icone: Rocket, exato: true }
// Fase 4, tarefa 1: regulação da rede (origem, central e super admin)
const ITEM_REGULACAO: ItemNav = { to: '/regulacao', rotulo: 'Regulação', icone: Waypoints, exato: true }
// Fase 4, tarefa 12: módulo de papéis de rede (o super admin liga por organização)
const ITEM_MODULO_REDE: ItemNav = { to: '/rede', rotulo: 'Papéis de rede', curto: 'Rede', icone: Network, exato: true }

/**
 * Itens do papel em foco. O responsável técnico (nomeação da rede, não papel
 * da unidade) ganha a Revisão Clínica em qualquer perfil; o super admin ganha
 * "Erros e alertas" no perfil de administrador.
 */
export function itensDeNavegacao(papel: Papel | null, responsavelTecnico = false, superAdmin = false): ItemNav[] {
  const itens = [...POR_PAPEL[papel ?? 'plantonista']]
  if (papel === 'admin' && superAdmin) {
    const i = itens.findIndex((x) => x.to === '/servidores')
    itens.splice(i >= 0 ? i + 1 : itens.length, 0, ITEM_ERROS_E_ALERTAS, ITEM_INTEGRACOES, ITEM_EXPORTAR, ITEM_IMPLANTACAO, ITEM_REGULACAO, ITEM_MODULO_REDE)
  }
  if (papel === 'gestor') itens.push(ITEM_INTEGRACOES, ITEM_EXPORTAR, ITEM_IMPLANTACAO, ITEM_REGULACAO)
  if (papel === 'plantonista' || papel === 'regulador') itens.push(ITEM_REGULACAO)
  if (responsavelTecnico) {
    // o gestor já tem o item; o responsável técnico o ganha com a nota da fila
    const i = itens.findIndex((x) => x.to === ITEM_REVISAO_CLINICA.to)
    if (i >= 0) itens[i] = ITEM_REVISAO_CLINICA
    else itens.push(ITEM_REVISAO_CLINICA)
  }
  return itens
}

/**
 * Barra inferior do celular (correções do portão, tarefa 8): no máximo cinco
 * posições. Com mais itens, quatro fixos e o "Mais", que abre a lista do resto.
 * Os fixos seguem a ordem do menu, salvo o papel que tem os seus (decisão do
 * RT: no enfermeiro, Triagem e Pronto Socorro fazem a mesma função, e
 * Internação e Checagem também — fica um de cada, mais Notificações e Alta
 * vigilância).
 */
export const MAX_BARRA_CELULAR = 5
const FIXOS_CELULAR: Partial<Record<Papel, string[]>> = {
  enfermeiro: ['/triagem', '/enfermagem/internacao', '/notificacao-compulsoria', '/alta-vigilancia'],
}
export function dividirBarraCelular(papel: Papel | null, itens: ItemNav[]): { fixos: ItemNav[]; mais: ItemNav[] } {
  if (itens.length <= MAX_BARRA_CELULAR) return { fixos: itens, mais: [] }
  const preferidos = ((papel && FIXOS_CELULAR[papel]) || [])
    .map((to) => itens.find((i) => i.to === to))
    .filter((i): i is ItemNav => !!i)
  const fixos = [...preferidos, ...itens.filter((i) => !preferidos.includes(i))].slice(0, MAX_BARRA_CELULAR - 1)
  return { fixos, mais: itens.filter((i) => !fixos.includes(i)) }
}

/**
 * As quatro abas do plantonista abaixo de 1024px (P/index.html, "DUAS abas no
 * celular" que viraram quatro em 29/08): ícone em cima do rótulo, e sobra
 * largura para o numeral da pendência.
 */
export const ABAS_ESTREITAS_PLANTONISTA: ItemNav[] = [
  { to: '/plantonista', rotulo: 'Ferramentas', icone: Stethoscope },
  { to: '/plantao/internacao/pacientes', rotulo: 'Leitos', icone: Users },
  { to: '/prontuarios', rotulo: 'Prontuário', icone: BookOpen },
  { to: '/agenda', rotulo: 'Escala', icone: CalendarClock },
]

/** Página inicial do papel: o logotipo leva a ela. */
export function inicioDoPapel(papel: Papel | null): string {
  return itensDeNavegacao(papel)[0]?.to ?? '/'
}

