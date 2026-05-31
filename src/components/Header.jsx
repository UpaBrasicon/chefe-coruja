import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTrocasPendentes } from '../hooks/useTrocasPendentes'
import { useDesistenciasAbertas } from '../hooks/useDesistenciasAbertas'
import { Button } from './ui/button'
import ModalAlterarSenha from './ModalAlterarSenha'
import ModalConfiguracoes from './ModalConfiguracoes'

export default function Header() {
  const { profissional, signOut } = useAuth()
  const { count: trocasCount } = useTrocasPendentes()
  const { count: vagasCount } = useDesistenciasAbertas()
  const [menuAberto, setMenuAberto] = useState(false)
  const [menuEscalaAberto, setMenuEscalaAberto] = useState(false)
  const [modalSenha, setModalSenha] = useState(false)
  const [modalConfig, setModalConfig] = useState(false)
  const menuRef = useRef(null)
  const menuEscalaRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function fecharFora(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAberto(false)
      if (menuEscalaRef.current && !menuEscalaRef.current.contains(e.target)) setMenuEscalaAberto(false)
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [])

  return (
    <>
      <header
        className="flex items-center justify-between px-3 sm:px-5 py-2.5 shadow-sm sticky top-0 z-10"
        style={{ background: 'var(--cor-primaria)', color: '#fff' }}
      >
        <Link to="/escala" className="flex items-center gap-2 no-underline shrink-0">
          <img src="/logo.png" alt="Chefe Coruja" className="h-9 w-9 rounded-full object-cover" />
          <span className="font-bold text-base sm:text-lg tracking-tight text-white hidden xs:block sm:block">
            Chefe Coruja
          </span>
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {/* Dropdown Escala */}
          <div className="relative" ref={menuEscalaRef}>
            <button
              onClick={() => setMenuEscalaAberto(v => !v)}
              className="relative flex items-center gap-1 text-xs sm:text-sm text-white hover:bg-white/20 px-2 sm:px-3 py-1.5 rounded-md transition-colors"
            >
              Escala
              <span className="text-white/70 text-xs">▾</span>
              {(trocasCount + vagasCount) > 0 && (
                <span className="absolute -top-1 -right-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: '#f59e0b', color: '#fff', fontSize: '10px' }}>
                  {trocasCount + vagasCount}
                </span>
              )}
            </button>

            {menuEscalaAberto && (
              <div className="absolute left-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 min-w-[200px] py-1 overflow-hidden">
                <button
                  onClick={() => { setMenuEscalaAberto(false); navigate('/escala') }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  📅 Escala
                </button>
                <button
                  onClick={() => { setMenuEscalaAberto(false); navigate('/desistencias') }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">🏥 Vagas em aberto</span>
                  {vagasCount > 0 && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--cor-secundaria)', color: '#fff' }}>
                      {vagasCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => { setMenuEscalaAberto(false); navigate('/trocas') }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">🔄 Trocas de plantão</span>
                  {trocasCount > 0 && (
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--cor-vago)', color: '#fff' }}>
                      {trocasCount}
                    </span>
                  )}
                </button>
              </div>
            )}
          </div>

          {profissional?.role === 'admin' && (
            <Link to="/admin">
              <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20 px-2 sm:px-3 text-xs sm:text-sm">
                Admin
              </Button>
            </Link>
          )}

          {/* Menu do usuário */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuAberto(v => !v)}
              className="flex items-center gap-1 text-xs sm:text-sm opacity-90 max-w-[160px] ml-1 text-white hover:opacity-100 transition-opacity"
            >
              <span className="hidden md:block truncate">{profissional?.nome ?? ''}</span>
              <span className="text-white/70 text-xs">▾</span>
            </button>

            {menuAberto && (
              <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-xl border border-slate-100 z-50 min-w-[180px] py-1 overflow-hidden">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs text-slate-400 truncate">{profissional?.nome}</p>
                </div>
                <button
                  onClick={() => { setMenuAberto(false); setModalConfig(true) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  ⚙️ Configurações
                </button>
                <button
                  onClick={() => { setMenuAberto(false); setModalSenha(true) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  🔑 Alterar senha
                </button>
                <button
                  onClick={() => { setMenuAberto(false); signOut() }}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
                  style={{ color: '#dc2626' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  ↪ Sair
                </button>
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={signOut}
            className="text-white hover:text-white hover:bg-white/20 px-2 sm:px-3 text-xs sm:text-sm md:hidden">
            Sair
          </Button>
        </div>
      </header>

      <ModalAlterarSenha aberto={modalSenha} onFechar={() => setModalSenha(false)} />
      <ModalConfiguracoes aberto={modalConfig} onFechar={() => setModalConfig(false)} />
    </>
  )
}
