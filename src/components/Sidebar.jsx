import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTrocasPendentes } from '../hooks/useTrocasPendentes'
import { useDesistenciasAbertas } from '../hooks/useDesistenciasAbertas'
import { CalendarDays, ClipboardList, Wallet, ShieldCheck } from 'lucide-react'

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

function NavItem({ item, active, isOpen, onShow, onHide, onNavigate }) {
  const Icon = item.icon

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => onShow(item.id)}
      onMouseLeave={onHide}
    >
      <button
        onClick={() => item.rota && onNavigate(item.rota)}
        className="relative flex flex-col items-center justify-center gap-0.5 w-full rounded-xl py-2.5 transition-all duration-150"
        style={{
          background: active ? 'rgba(0,0,0,0.28)' : isOpen ? 'rgba(255,255,255,0.08)' : 'transparent',
          color: '#fff',
        }}
        title={item.label}
      >
        <div className="relative">
          <Icon size={30} strokeWidth={1.6} />
          {item.badge > 0 && (
            <span className="absolute -top-2 -right-2 font-bold w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: '#f59e0b', color: '#fff', fontSize: '10px' }}>
              {item.badge > 9 ? '9+' : item.badge}
            </span>
          )}
        </div>
        <span className="hidden sm:block leading-tight font-medium text-center" style={{ fontSize: '12px' }}>
          {item.label}
        </span>
        {item.emBreve && (
          <span className="hidden sm:block leading-none" style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
            em breve
          </span>
        )}
      </button>

      {isOpen && item.children && (
        <div
          className="absolute left-full top-0 ml-1 rounded-xl overflow-hidden z-50"
          style={{ minWidth: '210px', ...FLYOUT_STYLE, animation: 'sidebarFlyIn 0.12s ease forwards' }}
          onMouseEnter={() => onShow(item.id)}
          onMouseLeave={onHide}
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
  const { profissional } = useAuth()
  const { count: trocasCount } = useTrocasPendentes()
  const { count: vagasCount } = useDesistenciasAbertas()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isAdmin = profissional?.role === 'admin'

  // Estado compartilhado — só um flyout aberto por vez
  const [activeId, setActiveId] = useState(null)
  const timerRef = useRef(null)

  function show(id) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setActiveId(id) // fecha o anterior imediatamente
  }

  function hide() {
    timerRef.current = setTimeout(() => setActiveId(null), 180)
  }

  function ir(rota) {
    setActiveId(null)
    navigate(rota)
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
        className="fixed left-0 top-0 bottom-0 flex flex-col items-center py-4 z-40"
        style={{
          width: '108px',
          background: SIDEBAR_BG,
          boxShadow: '3px 0 18px rgba(0,0,0,0.28)',
        }}
      >
        <button
          onClick={() => ir('/escala')}
          className="mb-5 mt-1 shrink-0 transition-transform hover:scale-105"
        >
          <img
            src="/logo.png"
            alt="Chefe Coruja"
            className="rounded-full object-cover"
            style={{ width: '72px', height: '72px', boxShadow: '0 2px 14px rgba(0,0,0,0.35)' }}
          />
        </button>

        <div className="mb-4" style={{ width: '60px', height: '1px', background: 'rgba(255,255,255,0.15)' }} />

        <div className="flex flex-col items-center gap-1 flex-1 w-full px-2">
          {navItems.map(item => (
            <NavItem
              key={item.id}
              item={item}
              active={item.activeRoutes?.some(r => pathname.startsWith(r))}
              isOpen={activeId === item.id}
              onShow={show}
              onHide={hide}
              onNavigate={ir}
            />
          ))}
        </div>
      </nav>
    </>
  )
}
