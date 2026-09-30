import {
  Activity,
  Bell,
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

import type { Papel } from '@/types/database'

/** Chave da nota numérica (contagem em âmbar ao lado do item). */
export type ChaveNota = 'avisos' | 'triagem' | 'farmacia' | 'pedidos' | 'tele' | 'revisao'

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
// Farmácia do gestor; Plataformas, Pendências e Servidores do administrador;
// Pronto Socorro, Notificações e Internação da enfermagem) chegam com as
// ondas do porte (produto/docs/PLANO-PORTE-FRONTEND.md).
const ITEM_PRONTUARIOS: ItemNav = { to: '/prontuarios', rotulo: 'Prontuários', icone: FolderSearch }
const ITEM_AVISOS: ItemNav = { to: '/notificacoes', rotulo: 'Avisos', icone: Bell, exato: true, nota: 'avisos' }

const POR_PAPEL: Record<Papel, ItemNav[]> = {
  plantonista: [
    { to: '/plantonista', rotulo: 'Central do Plantonista', curto: 'Central', icone: Stethoscope },
    { to: '/plantao', rotulo: 'Plantão', icone: Activity },
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
    { to: '/escala', rotulo: 'Escala', icone: CalendarClock, exato: true },
    { to: '/unidade', rotulo: 'Unidade', icone: Building2, exato: true },
    { to: '/internacao', rotulo: 'Internação', icone: Hospital, exato: true },
    { to: '/observacao', rotulo: 'Observação', icone: Eye, exato: true },
    { to: '/auditoria', rotulo: 'Auditoria', icone: ScrollText, exato: true, nota: 'pedidos' },
    { to: '/indicadores', rotulo: 'Indicadores', icone: LineChart, exato: true },
  ],
  // Enfermagem (P/index.html 32225–32230): o técnico não tem Triagem nem
  // Notificações; a tela inicial dele segue a escala (InicioEnfermagem).
  enfermeiro: [
    { to: '/triagem', rotulo: 'Triagem', icone: Activity, exato: true, nota: 'triagem' },
    { to: '/enfermagem/pronto-socorro', rotulo: 'Pronto Socorro', curto: 'PS', icone: Stethoscope, exato: true },
    { to: '/notificacao-compulsoria', rotulo: 'Notificações', icone: Shield, exato: true },
    { to: '/enfermagem/internacao', rotulo: 'Internação', icone: Users, exato: true },
    { to: '/checagem', rotulo: 'Checagem', icone: ClipboardCheck, exato: true },
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
  recepcao: [{ to: '/recepcao', rotulo: 'Nova ficha', icone: ClipboardList, exato: true, nota: 'triagem' }],
  farmaceutico: [
    { to: '/farmacia', rotulo: 'Central do Farmacêutico', curto: 'Farmácia', icone: FlaskConical, exato: true, nota: 'farmacia' },
    ITEM_PRONTUARIOS,
  ],
  telemedicina: [
    { to: '/teleinterconsulta', rotulo: 'Minha fila', curto: 'Fila', icone: MonitorSmartphone, exato: true, nota: 'tele' },
    ITEM_PRONTUARIOS,
  ],
  admin: [
    { to: '/painel', rotulo: 'Rede', icone: Building2, exato: true },
    { to: '/escala', rotulo: 'Escala', icone: CalendarClock, exato: true },
    { to: '/gaviao', rotulo: 'Olho de Gavião', curto: 'Gavião', icone: ShieldCheck, exato: true },
  ],
}

const ITEM_REVISAO_CLINICA: ItemNav = { to: '/revisao-clinica', rotulo: 'Revisão Clínica', curto: 'Revisão', icone: SquareCheckBig, exato: true, nota: 'revisao' }

/**
 * Itens do papel em foco. O responsável técnico (nomeação da rede, não papel
 * da unidade) ganha a Revisão Clínica em qualquer perfil.
 */
export function itensDeNavegacao(papel: Papel | null, responsavelTecnico = false): ItemNav[] {
  const itens = [...POR_PAPEL[papel ?? 'plantonista']]
  if (responsavelTecnico) itens.push(ITEM_REVISAO_CLINICA)
  return itens
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

