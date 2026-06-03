import { useState, useRef, useEffect } from 'react'
import { Bell, ChevronDown, Settings, KeyRound, LogOut } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useAvisos } from '../contexts/AvisosContext'
import PainelAvisos from './PainelAvisos'
import ModalAlterarSenha from './ModalAlterarSenha'

/* Páginas navy — topbar adapta cores para não contrastar com o fundo escuro */
const NAVY_ROUTES = ['/admin/editor-escala']

function temaTopBar(pathname) {
  const isNavy = NAVY_ROUTES.some(r => pathname.startsWith(r))
  return isNavy
    ? {
        bg:          'rgba(12, 20, 69, 0.88)',
        border:      'rgba(255,255,255,0.07)',
        shadow:      '0 1px 8px rgba(0,0,0,0.28)',
        iconColor:   'rgba(255,255,255,0.65)',
        hoverBg:     'rgba(255,255,255,0.10)',
        avatarBorder:'rgba(255,255,255,0.15)',
        badgeRing:   '#0e2d6e',
        dropBg:      '#0e2d6e',
        dropBorder:  'rgba(255,255,255,0.10)',
        dropShadow:  '0 8px 32px rgba(0,0,0,0.45)',
        dropText:    '#f1f5f9',
        dropSub:     'rgba(255,255,255,0.45)',
        dropDivider: 'rgba(255,255,255,0.08)',
        dropHover:   'rgba(255,255,255,0.07)',
        dropDanger:  '#fca5a5',
      }
    : {
        bg:          'rgba(255,255,255,0.97)',
        border:      'rgba(0,0,0,0.07)',
        shadow:      '0 1px 6px rgba(0,0,0,0.05)',
        iconColor:   '#6b7280',
        hoverBg:     '#f3f4f6',
        avatarBorder:'transparent',
        badgeRing:   '#fff',
        dropBg:      '#fff',
        dropBorder:  'rgba(0,0,0,0.07)',
        dropShadow:  '0 8px 32px rgba(0,0,0,0.12)',
        dropText:    '#111827',
        dropSub:     '#9ca3af',
        dropDivider: '#f3f4f6',
        dropHover:   '#f9fafb',
        dropDanger:  '#dc2626',
      }
}

function DropItem({ icon, label, onClick, danger, divider, tema }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors"
      style={{
        color: danger ? tema.dropDanger : tema.dropText,
        background: hov ? tema.dropHover : 'transparent',
        borderTop: divider ? `1px solid ${tema.dropDivider}` : 'none',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

export default function TopBar() {
  const { profissional, signOut } = useAuth()
  const { avisos, naoLidas, marcarLida, marcarTodasLidas, excluir } = useAvisos()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const tema = temaTopBar(pathname)

  const [painelAberto, setPainelAberto] = useState(false)
  const [dropAberto,   setDropAberto]   = useState(false)
  const [modalSenha,   setModalSenha]   = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    function fecharFora(e) {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropAberto(false)
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [])

  const inicial = profissional?.nome?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <>
      <style>{`
        @keyframes topDropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <div
        className="sticky top-0 z-30 flex items-center gap-1 px-5"
        style={{
          height: '56px',
          background: tema.bg,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          borderBottom: `1px solid ${tema.border}`,
          boxShadow: tema.shadow,
          transition: 'background 0.3s ease, border-color 0.3s ease',
        }}
      >
        {/* Logo — mobile only (sidebar escondido no mobile) */}
        <button
          onClick={() => navigate('/home')}
          className="flex items-center gap-2 md:hidden mr-auto shrink-0"
        >
          <img src="/logo.png" alt="" className="rounded-full object-cover" style={{ width: 32, height: 32 }} />
          <span className="font-bold text-sm" style={{ color: tema.dropText === '#f1f5f9' ? '#fff' : '#1e293b' }}>
            Chefe Coruja
          </span>
        </button>

        {/* Spacer — desktop only (logo fica no sidebar) */}
        <div className="hidden md:flex flex-1" />

        {/* Sino */}
        <button
          className="relative p-2 rounded-full transition-colors"
          style={{ color: tema.iconColor }}
          onMouseEnter={e => e.currentTarget.style.background = tema.hoverBg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          onClick={() => setPainelAberto(v => !v)}
          title="Notificações"
        >
          <Bell size={20} strokeWidth={1.8} />
          {naoLidas > 0 && (
            <span
              className="absolute rounded-full flex items-center justify-center font-bold"
              style={{
                width: naoLidas > 9 ? '18px' : '16px',
                height: '16px',
                background: '#ef4444',
                color: '#fff',
                fontSize: '9px',
                top: '4px', right: '4px',
                boxShadow: `0 0 0 2px ${tema.badgeRing}`,
              }}
            >
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </button>

        {/* Avatar + chevron */}
        <div className="relative ml-1" ref={dropRef}>
          <button
            onClick={() => setDropAberto(v => !v)}
            className="flex items-center gap-1.5 rounded-full pl-0.5 pr-2 py-0.5 transition-colors"
            style={{ background: dropAberto ? tema.hoverBg : 'transparent' }}
            onMouseEnter={e => { if (!dropAberto) e.currentTarget.style.background = tema.hoverBg }}
            onMouseLeave={e => { if (!dropAberto) e.currentTarget.style.background = 'transparent' }}
          >
            {profissional?.foto_url ? (
              <img src={profissional.foto_url} alt={profissional.nome}
                className="rounded-full object-cover"
                style={{ width: 36, height: 36, border: `2px solid ${tema.avatarBorder}` }} />
            ) : (
              <div className="rounded-full flex items-center justify-center text-sm font-bold text-white select-none"
                style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#0d9488 0%,#0c7470 100%)', fontSize: 14 }}>
                {inicial}
              </div>
            )}
            <ChevronDown size={14} strokeWidth={2.5}
              style={{ color: tema.iconColor, transition: 'transform 0.2s', transform: dropAberto ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </button>

          {dropAberto && (
            <div
              className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden"
              style={{
                minWidth: 210,
                background: tema.dropBg,
                boxShadow: tema.dropShadow,
                border: `1px solid ${tema.dropBorder}`,
                animation: 'topDropIn 0.15s ease forwards',
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: `1px solid ${tema.dropDivider}` }}>
                <p className="text-sm font-semibold truncate" style={{ color: tema.dropText }}>{profissional?.nome}</p>
                <p className="text-xs truncate mt-0.5" style={{ color: tema.dropSub }}>{profissional?.email}</p>
              </div>
              <div className="py-1">
                <DropItem tema={tema} icon={<Settings size={14} />}  label="Meu perfil"    onClick={() => { setDropAberto(false); navigate('/perfil') }} />
                <DropItem tema={tema} icon={<KeyRound size={14} />}  label="Alterar senha" onClick={() => { setDropAberto(false); setModalSenha(true) }} />
                <DropItem tema={tema} icon={<LogOut size={14} />}    label="Sair"          onClick={signOut} danger divider />
              </div>
            </div>
          )}
        </div>
      </div>

      <PainelAvisos
        aberto={painelAberto}
        onFechar={() => setPainelAberto(false)}
        avisos={avisos}
        naoLidas={naoLidas}
        onMarcarLida={marcarLida}
        onMarcarTodasLidas={marcarTodasLidas}
        onExcluir={excluir}
      />

      <ModalAlterarSenha aberto={modalSenha} onFechar={() => setModalSenha(false)} />
    </>
  )
}
