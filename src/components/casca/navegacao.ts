import {
  Activity,
  Bell,
  Building2,
  CalendarClock,
  Eye,
  Hospital,
  LayoutDashboard,
  LineChart,
  ShieldCheck,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'

import type { Papel } from '@/types/database'

export type ItemNav = {
  to: string
  rotulo: string
  /** Rótulo curto para a barra inferior do celular. */
  curto?: string
  icone: LucideIcon
  /** Casa só a rota exata (NavLink `end`). */
  exato?: boolean
}

// Navegação por papel (09-comum-casca §3). Só entram destinos que existem no
// app hoje; os demais itens do protótipo (Farmácia, Auditoria, Histórico,
// Protocolos do gestor; Pendências, Servidores, Plataformas do admin) chegam
// com as fases que criam as tabelas deles.
const POR_PAPEL: Record<Papel, ItemNav[]> = {
  plantonista: [
    { to: '/plantonista', rotulo: 'Central do Plantonista', curto: 'Central', icone: Stethoscope },
    { to: '/plantao', rotulo: 'Plantão', icone: Activity },
    { to: '/agenda', rotulo: 'Minha Agenda', curto: 'Agenda', icone: CalendarClock, exato: true },
    { to: '/notificacoes', rotulo: 'Avisos', icone: Bell, exato: true },
  ],
  gestor: [
    { to: '/unidade', rotulo: 'Unidade', icone: Building2, exato: true },
    { to: '/internacao', rotulo: 'Internação', icone: Hospital, exato: true },
    { to: '/observacao', rotulo: 'Observação', icone: Eye, exato: true },
    { to: '/escala', rotulo: 'Escala', icone: CalendarClock, exato: true },
    { to: '/indicadores', rotulo: 'Indicadores', icone: LineChart, exato: true },
  ],
  admin: [
    { to: '/painel', rotulo: 'Rede', icone: LayoutDashboard, exato: true },
    { to: '/escala', rotulo: 'Escala', icone: CalendarClock, exato: true },
    { to: '/gaviao', rotulo: 'Olho de Gavião', curto: 'Gavião', icone: ShieldCheck, exato: true },
  ],
}

/**
 * Itens do papel ativo. Um usuário pode ter mais de um papel na unidade
 * (ex.: gestor e plantonista); os itens se somam, sem repetir destino.
 */
export function itensDeNavegacao(papeis: Papel[]): ItemNav[] {
  const ordem: Papel[] = ['plantonista', 'gestor', 'admin']
  const itens = ordem.filter((p) => papeis.includes(p)).flatMap((p) => POR_PAPEL[p])
  const unicos = itens.filter((item, i) => itens.findIndex((x) => x.to === item.to) === i)
  return unicos.length ? unicos : POR_PAPEL.plantonista.slice(0, 1)
}
