import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTrocasPendentes } from '../hooks/useTrocasPendentes'
import { useDesistenciasAbertas } from '../hooks/useDesistenciasAbertas'
import { Button } from './ui/button'
import ModalAlterarSenha from './ModalAlterarSenha'

export default function Header() {
  const { profissional, signOut } = useAuth()
  const { count: trocasCount } = useTrocasPendentes()
  const { count: vagasCount } = useDesistenciasAbertas()
  const [menuAberto, setMenuAberto] = useState(false)
  const [modalSenha, setModalSenha] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function fecharFora(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuAberto(false)
      }
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
          <Link to="/desistencias" className="relative">
            <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20 px-2 sm:px-3 text-xs sm:text-sm">
              Vagas
              {vagasCount > 0 && (
                <span className="absolute -top-1 -right-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--cor-secundaria)', color: '#fff', fontSize: '10px' }}>
                  {vagasCount}
                </span>
              )}
            </Button>
          </Link>

          <Link to="/trocas" className="relative">
            <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20 px-2 sm:px-3 text-xs sm:text-sm">
              Trocas
              {trocasCount > 0 && (
                <span className="absolute -top-1 -right-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--cor-vago)', color: '#fff', fontSize: '10px' }}>
                  {trocasCount}
                </span>
              )}
            </Button>
          </Link>

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
    </>
  )
}
