import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTrocasPendentes } from '../hooks/useTrocasPendentes'
import { useDesistenciasAbertas } from '../hooks/useDesistenciasAbertas'
import { CalendarDays, ClipboardList, Wallet, ShieldCheck, LogOut, Settings, KeyRound } from 'lucide-react'
import ModalAlterarSenha from './ModalAlterarSenha'
import ModalConfiguracoes from './ModalConfiguracoes'

const SIDEBAR_BG = 'linear-gradient(180deg, #0a5a56 0%, #0c7470 45%, #0d9488 100%)'
const FLYOUT_STYLE = {
  background: 'rgba(8,72,68,0.97)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: '6px 4px 28px rgba(0,0,0,0.35)',
}

function FlyoutItem({ label, icone, onClick, badge, emBreve }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors"
      style={{ background: hov ? 'rgba(255,255,255,0.09)' : 'transparent', color: '#fff' }}
    >
      <span className="text-base leading-none">{icone}</span>
      <span className="flex-1 text-sm">{label}</span>
      {emBreve && (
        <span className="text-xs px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: '10px' }}>
          em breve
        </span>
      )}
      {badge > 0 && (
        <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: '#f59e0b', color: '#fff', fontSize: '10px' }}>
          {badge}
        </span>
      )}
    </button>
  )
}

function NavItem({ item, active, onNavigate }) {
  const [hov, setHov] = useState(false)
  const Icon = item.icon

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <button
        onClick={() => item.rota && onNavigate(item.rota)}
        className="relative flex flex-col items-center justify-center gap-0.5 w-full rounded-xl py-2.5 transition-all duration-150"
        style={{
          background: active ? 'rgba(0,0,0,0.28)' : hov ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: '#fff',
        }}
        title={item.label}
      >
        <div className="relative">
          <Icon size={20} strokeWidth={1.8} />
          {item.badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: '#f59e0b', color: '#fff', fontSize: '9px' }}>
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </div>
        <span className="hidden sm:block leading-tight font-medium text-center" style={{ fontSize: '10px' }}>
          {item.label}
        </span>
        {item.emBreve && (
          <span className="hidden sm:block leading-none" style={{ fontSize: '8px', color: 'rgba(255,255,255,0.45)' }}>
            em breve
          </span>
        )}
      </button>

      {/* Flyout */}
      {hov && item.children && (
        <div
          className="absolute left-full top-0 ml-2 rounded-xl overflow-hidden z-50"
          style={{ minWidth: '210px', ...FLYOUT_STYLE, animation: 'sidebarFlyIn 0.12s ease forwards' }}
        >
          <div className="px-4 py-2 border-b border-white/10">
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {item.label}
            </span>
          </div>
          {item.children.map(c => (
            <FlyoutItem
              key={c.rota}
              label={c.label}
              icone={c.icone}
              badge={c.badge}
              emBreve={c.emBreve}
              onClick={() => onNavigate(c.rota)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sidebar() {
  const { profissional, signOut } = useAuth()
  const { count: trocasCount } = useTrocasPendentes()
  const { count: vagasCount } = useDesistenciasAbertas()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [hovUser, setHovUser] = useState(false)
  const [modalSenha, setModalSenha] = useState(false)
  const [modalConfig, setModalConfig] = useState(false)
  const isAdmin = profissional?.role === 'admin'

  function ir(rota) {
    navigate(rota)
    setHovUser(false)
  }

  const navItems = [
    {
      id: 'escala',
      label: 'Escala',
      icon: CalendarDays,
      activeRoutes: ['/escala', '/desistencias', '/trocas'],
      badge: trocasCount + vagasCount,
      children: [
        { label: 'Escala', icone: '📅', rota: '/escala' },
        { label: 'Vagas em aberto', icone: '🏥', rota: '/desistencias', badge: vagasCount },
        { label: 'Trocas de plantão', icone: '🔄', rota: '/trocas', badge: trocasCount },
      ],
    },
    {
      id: 'plantao',
      label: 'Plantão',
      icon: ClipboardList,
      activeRoutes: ['/plantao'],
      emBreve: true,
      children: [
        { label: 'Prescrição PS', icone: '📋', rota: '/plantao/prescricao-ps', emBreve: true },
        { label: 'Atestado Médico', icone: '📄', rota: '/plantao/atestado', emBreve: true },
        { label: 'Prescrição Internação', icone: '🏥', rota: '/plantao/prescricao-internacao', emBreve: true },
        { label: 'Evolução Internação', icone: '📝', rota: '/plantao/evolucao-internacao', emBreve: true },
        { label: 'APAC', icone: '🗂️', rota: '/plantao/apac', emBreve: true },
        { label: 'Encaminhamento', icone: '↗️', rota: '/plantao/encaminhamento', emBreve: true },
        { label: 'Pedido de Exame', icone: '🔬', rota: '/plantao/pedido-exame', emBreve: true },
      ],
    },
    {
      id: 'financeiro',
      label: 'Financeiro',
      icon: Wallet,
      activeRoutes: ['/financeiro'],
      emBreve: true,
      children: [
        ...(isAdmin ? [{ label: 'Planilha de Custos', icone: '📊', rota: '/financeiro/custos', emBreve: true }] : []),
        { label: 'Contracheque', icone: '💰', rota: '/financeiro/contracheque', emBreve: true },
      ],
    },
    ...(isAdmin ? [{
      id: 'admin',
      label: 'Admin',
      icon: ShieldCheck,
      activeRoutes: ['/admin'],
      rota: '/admin',
    }] : []),
  ]

  return (
    <>
      <style>{`
        @keyframes sidebarFlyIn {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <nav
        className="fixed left-0 top-0 bottom-0 flex flex-col items-center py-3 z-40"
        style={{
          width: '72px',
          background: SIDEBAR_BG,
          boxShadow: '3px 0 18px rgba(0,0,0,0.28)',
        }}
      >
        {/* Logo */}
        <button
          onClick={() => ir('/escala')}
          className="mb-5 mt-1 shrink-0 transition-transform hover:scale-105"
        >
          <img
            src="/logo.png"
            alt="Chefe Coruja"
            className="rounded-full object-cover"
            style={{ width: '48px', height: '48px', boxShadow: '0 2px 12px rgba(0,0,0,0.35)' }}
          />
        </button>

        {/* Divisor */}
        <div className="w-10 mb-4" style={{ height: '1px', background: 'rgba(255,255,255,0.15)' }} />

        {/* Nav items */}
        <div className="flex flex-col items-center gap-1 flex-1 w-full px-2">
          {navItems.map(item => (
            <NavItem
              key={item.id}
              item={item}
              active={item.activeRoutes?.some(r => pathname.startsWith(r))}
              onNavigate={ir}
            />
          ))}
        </div>

        {/* Divisor */}
        <div className="w-10 mt-2 mb-3" style={{ height: '1px', background: 'rgba(255,255,255,0.15)' }} />

        {/* Usuário */}
        <div
          className="relative w-full px-2"
          onMouseEnter={() => setHovUser(true)}
          onMouseLeave={() => setHovUser(false)}
        >
          <button
            className="flex flex-col items-center justify-center gap-0.5 w-full rounded-xl py-2 transition-all hover:bg-white/10"
            style={{ color: '#fff' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: 'rgba(255,255,255,0.22)', color: '#fff' }}
            >
              {profissional?.nome?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <span
              className="hidden sm:block text-center truncate w-full"
              style={{ fontSize: '9px', color: 'rgba(255,255,255,0.65)', maxWidth: '64px', padding: '0 4px' }}
            >
              {profissional?.nome?.split(' ')[0] ?? ''}
            </span>
          </button>

          {hovUser && (
            <div
              className="absolute left-full bottom-0 ml-2 rounded-xl overflow-hidden z-50"
              style={{ minWidth: '200px', ...FLYOUT_STYLE, animation: 'sidebarFlyIn 0.12s ease forwards' }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <p className="text-sm font-semibold text-white truncate">{profissional?.nome}</p>
                <p className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{profissional?.email}</p>
              </div>
              <FlyoutItem
                label="Configurações"
                icone={<Settings size={14} />}
                onClick={() => { setHovUser(false); setModalConfig(true) }}
              />
              <FlyoutItem
                label="Alterar senha"
                icone={<KeyRound size={14} />}
                onClick={() => { setHovUser(false); setModalSenha(true) }}
              />
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={signOut}
          className="flex flex-col items-center justify-center gap-0.5 w-full px-2 py-2 mt-1 rounded-xl hover:bg-red-500/20 transition-all mx-2"
          style={{ color: 'rgba(255,255,255,0.55)', width: 'calc(100% - 16px)' }}
          title="Sair"
        >
          <LogOut size={18} strokeWidth={1.8} />
          <span className="hidden sm:block" style={{ fontSize: '9px' }}>Sair</span>
        </button>
      </nav>
    </>
  )
}
