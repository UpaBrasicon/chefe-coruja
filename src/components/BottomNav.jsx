import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTrocasPendentes } from '../hooks/useTrocasPendentes'
import { useDesistenciasAbertas } from '../hooks/useDesistenciasAbertas'
import { useAvisos } from '../contexts/AvisosContext'
import {
  Home, CalendarDays, ArrowLeftRight, Building2,
  MoreHorizontal, ShieldCheck, Wallet, ClipboardList,
  LogOut, User, Bell, X, Crown,
} from 'lucide-react'

const NAV_BG = 'linear-gradient(90deg, #0a5a56 0%, #0c7470 50%, #0d9488 100%)'

function BottomItem({ icon: Icon, label, active, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 relative"
      style={{ color: active ? '#fff' : 'rgba(255,255,255,0.5)' }}
    >
      <div
        className="relative flex items-center justify-center rounded-xl transition-all"
        style={{
          width: 38, height: 28,
          background: active ? 'rgba(0,0,0,0.28)' : 'transparent',
        }}
      >
        <Icon size={20} strokeWidth={1.8} />
        {badge > 0 && (
          <span
            className="absolute -top-1 -right-1 font-bold rounded-full flex items-center justify-center"
            style={{ width: 14, height: 14, background: '#f59e0b', color: '#fff', fontSize: '8px' }}
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span style={{ fontSize: '9px', fontWeight: active ? 600 : 400, lineHeight: 1 }}>{label}</span>
    </button>
  )
}

function SheetItem({ icon, label, onClick, danger, emBreve }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-3.5 active:bg-gray-50 transition-colors"
      style={{ color: danger ? '#dc2626' : '#1e293b' }}
    >
      <span style={{ color: danger ? '#dc2626' : '#0d9488', flexShrink: 0 }}>{icon}</span>
      <span className="flex-1 text-sm font-medium text-left">{label}</span>
      {emBreve && (
        <span className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: '#f1f5f9', color: '#94a3b8' }}>
          em breve
        </span>
      )}
    </button>
  )
}

export default function BottomNav() {
  const { profissional, signOut } = useAuth()
  const { count: trocasCount }  = useTrocasPendentes()
  const { count: vagasCount }   = useDesistenciasAbertas()
  const { naoLidas }            = useAvisos()
  const navigate   = useNavigate()
  const { pathname } = useLocation()
  const [maisAberto, setMaisAberto] = useState(false)
  const isAdmin = ['admin', 'ceo'].includes(profissional?.role)
  const isCEO   = profissional?.role === 'ceo'

  function ir(rota) { navigate(rota); setMaisAberto(false) }

  const items = [
    { id: 'home',   icon: Home,           label: 'Início',  rota: '/home',         active: pathname === '/home' },
    { id: 'escala', icon: CalendarDays,   label: 'Escala',  rota: '/escala',       active: ['/escala','/desistencias','/trocas'].some(r => pathname.startsWith(r)) },
    { id: 'trocas', icon: ArrowLeftRight, label: 'Trocas',  rota: '/trocas',       active: pathname.startsWith('/trocas'), badge: trocasCount },
    { id: 'vagas',  icon: Building2,      label: 'Vagas',   rota: '/desistencias', active: pathname.startsWith('/desistencias'), badge: vagasCount },
    { id: 'mais',   icon: MoreHorizontal, label: 'Mais',    menu: true,            active: maisAberto },
  ]

  return (
    <>
      {/* Overlay */}
      {maisAberto && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={() => setMaisAberto(false)}
        />
      )}

      {/* Bottom sheet */}
      <div
        className="fixed left-0 right-0 z-50 rounded-t-2xl overflow-hidden"
        style={{
          bottom: maisAberto ? 60 : -400,
          background: '#fff',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
          transition: 'bottom 0.3s cubic-bezier(0.4,0,0.2,1)',
          maxHeight: '60vh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2"
          style={{ borderBottom: '1px solid #f3f4f6' }}>
          <span className="text-sm font-semibold" style={{ color: '#1e293b' }}>Menu</span>
          <button onClick={() => setMaisAberto(false)} style={{ color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>

        {/* Notificações */}
        {naoLidas > 0 && (
          <SheetItem
            icon={<Bell size={18} />}
            label={`Notificações (${naoLidas})`}
            onClick={() => setMaisAberto(false)}
          />
        )}

        {/* Perfil */}
        <SheetItem icon={<User size={18} />} label="Meu perfil" onClick={() => ir('/perfil')} />

        {/* CEO */}
        {isCEO && (
          <SheetItem icon={<Crown size={18} />} label="Painel CEO" onClick={() => ir('/ceo')} />
        )}

        {/* Admin */}
        {isAdmin && (
          <SheetItem icon={<ShieldCheck size={18} />} label="Admin" onClick={() => ir('/admin')} />
        )}

        {/* Divider */}
        <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />

        {/* Plantão e Financeiro */}
        <SheetItem icon={<ClipboardList size={18} />} label="Plantão" emBreve onClick={() => ir('/plantao/prescricao-ps')} />
        <SheetItem icon={<Wallet size={18} />} label="Financeiro" emBreve onClick={() => ir('/financeiro/contracheque')} />

        {/* Sair */}
        <div style={{ height: 1, background: '#f3f4f6', margin: '4px 0' }} />
        <SheetItem icon={<LogOut size={18} />} label="Sair" danger onClick={signOut} />

        <div style={{ height: 8 }} />
      </div>

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch"
        style={{
          height: 60,
          background: NAV_BG,
          boxShadow: '0 -2px 16px rgba(0,0,0,0.22)',
        }}
      >
        {items.map(item => (
          <BottomItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={item.active}
            badge={item.badge}
            onClick={() => item.menu ? setMaisAberto(v => !v) : ir(item.rota)}
          />
        ))}
      </nav>
    </>
  )
}
