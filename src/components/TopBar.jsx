import { useState, useRef, useEffect } from 'react'
import { Bell, ChevronDown, Settings, KeyRound, LogOut } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useAvisos } from '../hooks/useAvisos'
import PainelAvisos from './PainelAvisos'
import ModalAlterarSenha from './ModalAlterarSenha'
import ModalConfiguracoes from './ModalConfiguracoes'

function DropItem({ icon, label, onClick, danger, divider }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors"
      style={{
        color: danger ? '#dc2626' : '#374151',
        background: hov ? (danger ? 'rgba(220,38,38,0.06)' : '#f9fafb') : 'transparent',
        borderTop: divider ? '1px solid #f3f4f6' : 'none',
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
  const [painelAberto, setPainelAberto] = useState(false)
  const [dropAberto, setDropAberto] = useState(false)
  const [modalSenha, setModalSenha] = useState(false)
  const [modalConfig, setModalConfig] = useState(false)
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
        className="sticky top-0 z-30 flex items-center justify-end gap-1 px-5"
        style={{
          height: '56px',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
        }}
      >
        {/* Sino */}
        <button
          className="relative p-2 rounded-full transition-colors"
          style={{ color: '#6b7280' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
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
                top: '4px',
                right: '4px',
                boxShadow: '0 0 0 2px #fff',
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
            style={{ background: dropAberto ? '#f3f4f6' : 'transparent' }}
            onMouseEnter={e => { if (!dropAberto) e.currentTarget.style.background = '#f3f4f6' }}
            onMouseLeave={e => { if (!dropAberto) e.currentTarget.style.background = 'transparent' }}
          >
            {profissional?.foto_url ? (
              <img
                src={profissional.foto_url}
                alt={profissional.nome}
                className="rounded-full object-cover"
                style={{ width: '36px', height: '36px' }}
              />
            ) : (
              <div
                className="rounded-full flex items-center justify-center text-sm font-bold text-white select-none"
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #0c7470 100%)',
                  fontSize: '14px',
                }}
              >
                {inicial}
              </div>
            )}
            <ChevronDown
              size={14}
              strokeWidth={2.5}
              style={{
                color: '#9ca3af',
                transition: 'transform 0.2s',
                transform: dropAberto ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {dropAberto && (
            <div
              className="absolute right-0 top-full mt-2 rounded-2xl overflow-hidden"
              style={{
                minWidth: '210px',
                background: '#fff',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                border: '1px solid rgba(0,0,0,0.07)',
                animation: 'topDropIn 0.15s ease forwards',
              }}
            >
              <div className="px-4 py-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
                <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>
                  {profissional?.nome}
                </p>
                <p className="text-xs truncate mt-0.5" style={{ color: '#9ca3af' }}>
                  {profissional?.email}
                </p>
              </div>
              <div className="py-1">
                <DropItem
                  icon={<Settings size={14} />}
                  label="Configurações"
                  onClick={() => { setDropAberto(false); setModalConfig(true) }}
                />
                <DropItem
                  icon={<KeyRound size={14} />}
                  label="Alterar senha"
                  onClick={() => { setDropAberto(false); setModalSenha(true) }}
                />
                <DropItem
                  icon={<LogOut size={14} />}
                  label="Sair"
                  onClick={signOut}
                  danger
                  divider
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel lateral de avisos */}
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
      <ModalConfiguracoes aberto={modalConfig} onFechar={() => setModalConfig(false)} />
    </>
  )
}
