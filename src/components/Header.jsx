import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTrocasPendentes } from '../hooks/useTrocasPendentes'
import { useDesistenciasAbertas } from '../hooks/useDesistenciasAbertas'
import { Button } from './ui/button'
import ModalAlterarSenha from './ModalAlterarSenha'
import ModalConfiguracoes from './ModalConfiguracoes'

const dropdownStyle = {
  background: 'rgba(248,252,251,0.97)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(13,148,136,0.25)',
  borderTop: '3px solid #0d9488',
  boxShadow: '0 12px 40px rgba(13,148,136,0.18), 0 2px 12px rgba(0,0,0,0.12)',
}

export default function Header() {
  const { profissional, signOut } = useAuth()
  const { count: trocasCount } = useTrocasPendentes()
  const { count: vagasCount } = useDesistenciasAbertas()
  const [menuAberto, setMenuAberto] = useState(false)
  const [menuEscalaAberto, setMenuEscalaAberto] = useState(false)
  const [menuPlantaoAberto, setMenuPlantaoAberto] = useState(false)
  const [menuFinanceiroAberto, setMenuFinanceiroAberto] = useState(false)
  const [modalSenha, setModalSenha] = useState(false)
  const [modalConfig, setModalConfig] = useState(false)
  const menuRef = useRef(null)
  const menuEscalaRef = useRef(null)
  const menuPlantaoRef = useRef(null)
  const menuFinanceiroRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    function fecharFora(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAberto(false)
      if (menuEscalaRef.current && !menuEscalaRef.current.contains(e.target)) setMenuEscalaAberto(false)
      if (menuPlantaoRef.current && !menuPlantaoRef.current.contains(e.target)) setMenuPlantaoAberto(false)
      if (menuFinanceiroRef.current && !menuFinanceiroRef.current.contains(e.target)) setMenuFinanceiroAberto(false)
    }
    document.addEventListener('mousedown', fecharFora)
    return () => document.removeEventListener('mousedown', fecharFora)
  }, [])

  function MenuItem({ onClick, children, danger, divider }) {
    const [hovered, setHovered] = useState(false)
    return (
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          borderLeft: hovered
            ? `3px solid ${danger ? '#dc2626' : '#0d9488'}`
            : '3px solid transparent',
          background: hovered
            ? danger
              ? 'linear-gradient(90deg,rgba(220,38,38,0.07) 0%,transparent 100%)'
              : 'linear-gradient(90deg,rgba(13,148,136,0.08) 0%,transparent 100%)'
            : 'transparent',
          transform: hovered ? 'translateX(2px)' : 'translateX(0)',
          transition: 'all 0.15s ease',
          color: danger ? '#dc2626' : hovered ? '#0d9488' : '#374151',
          borderTop: divider ? '1px solid rgba(13,148,136,0.1)' : 'none',
        }}
        className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2"
      >
        {children}
      </button>
    )
  }

  return (
    <>
      <style>{`
        .dropdown-enter {
          animation: dropIn 0.15s ease forwards;
        }
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
      `}</style>

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
          <div
            className="relative"
            ref={menuEscalaRef}
            onMouseEnter={() => setMenuEscalaAberto(true)}
            onMouseLeave={() => setMenuEscalaAberto(false)}
          >
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
              <div className="absolute left-0 top-full pt-1 z-50">
                <div className="dropdown-enter rounded-xl min-w-[210px] py-1 overflow-hidden" style={dropdownStyle}>
                  <MenuItem onClick={() => { setMenuEscalaAberto(false); navigate('/escala') }}>
                    📅 Escala
                  </MenuItem>
                  <MenuItem onClick={() => { setMenuEscalaAberto(false); navigate('/desistencias') }}>
                    <span className="flex-1 flex items-center gap-2">🏥 Vagas em aberto</span>
                    {vagasCount > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--cor-secundaria)', color: '#fff' }}>
                        {vagasCount}
                      </span>
                    )}
                  </MenuItem>
                  <MenuItem onClick={() => { setMenuEscalaAberto(false); navigate('/trocas') }}>
                    <span className="flex-1 flex items-center gap-2">🔄 Trocas de plantão</span>
                    {trocasCount > 0 && (
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--cor-vago)', color: '#fff' }}>
                        {trocasCount}
                      </span>
                    )}
                  </MenuItem>
                </div>
              </div>
            )}
          </div>

          {/* Dropdown Plantão */}
          <div
            className="relative"
            ref={menuPlantaoRef}
            onMouseEnter={() => setMenuPlantaoAberto(true)}
            onMouseLeave={() => setMenuPlantaoAberto(false)}
          >
            <button
              onClick={() => setMenuPlantaoAberto(v => !v)}
              className="relative flex items-center gap-1 text-xs sm:text-sm text-white hover:bg-white/20 px-2 sm:px-3 py-1.5 rounded-md transition-colors"
            >
              Plantão
              <span className="text-white/70 text-xs">▾</span>
              <span className="ml-1 text-xs px-1 rounded" style={{ background: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>em breve</span>
            </button>

            {menuPlantaoAberto && (
              <div className="absolute left-0 top-full pt-1 z-50">
                <div className="dropdown-enter rounded-xl min-w-[230px] py-1 overflow-hidden" style={dropdownStyle}>
                  <div className="px-4 py-2" style={{ borderBottom: '1px solid rgba(13,148,136,0.12)' }}>
                    <p className="text-xs font-semibold" style={{ color: '#0d9488' }}>Parte Médica</p>
                  </div>
                  {[
                    { label: 'Prescrição Pronto Socorro', icone: '📋', rota: '/plantao/prescricao-ps' },
                    { label: 'Atestado Médico',           icone: '📄', rota: '/plantao/atestado' },
                    { label: 'Prescrição Internação',     icone: '🏥', rota: '/plantao/prescricao-internacao' },
                    { label: 'Evolução Internação',       icone: '📝', rota: '/plantao/evolucao-internacao' },
                  ].map(item => (
                    <MenuItem key={item.rota} onClick={() => { setMenuPlantaoAberto(false); navigate(item.rota) }}>
                      <span className="flex-1 flex items-center gap-2">{item.icone} {item.label}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10px' }}>em breve</span>
                    </MenuItem>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dropdown Financeiro */}
          <div
            className="relative"
            ref={menuFinanceiroRef}
            onMouseEnter={() => setMenuFinanceiroAberto(true)}
            onMouseLeave={() => setMenuFinanceiroAberto(false)}
          >
            <button
              onClick={() => setMenuFinanceiroAberto(v => !v)}
              className="relative flex items-center gap-1 text-xs sm:text-sm text-white hover:bg-white/20 px-2 sm:px-3 py-1.5 rounded-md transition-colors"
            >
              Financeiro
              <span className="text-white/70 text-xs">▾</span>
              <span className="ml-1 text-xs px-1 rounded" style={{ background: 'rgba(255,255,255,0.2)', fontSize: '9px' }}>em breve</span>
            </button>

            {menuFinanceiroAberto && (
              <div className="absolute left-0 top-full pt-1 z-50">
                <div className="dropdown-enter rounded-xl min-w-[210px] py-1 overflow-hidden" style={dropdownStyle}>
                  {profissional?.role === 'admin' && (
                    <MenuItem onClick={() => { setMenuFinanceiroAberto(false); navigate('/financeiro/custos') }}>
                      <span className="flex-1 flex items-center gap-2">📊 Planilha de Custos</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10px' }}>em breve</span>
                    </MenuItem>
                  )}
                  <MenuItem onClick={() => { setMenuFinanceiroAberto(false); navigate('/financeiro/contracheque') }}>
                    <span className="flex-1 flex items-center gap-2">💰 Contracheque</span>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '10px' }}>em breve</span>
                  </MenuItem>
                </div>
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

          {/* Dropdown usuário */}
          <div
            className="relative"
            ref={menuRef}
            onMouseEnter={() => setMenuAberto(true)}
            onMouseLeave={() => setMenuAberto(false)}
          >
            <button
              onClick={() => setMenuAberto(v => !v)}
              className="flex items-center gap-1 text-xs sm:text-sm opacity-90 max-w-[160px] ml-1 text-white hover:opacity-100 transition-opacity"
            >
              <span className="hidden md:block truncate">{profissional?.nome ?? ''}</span>
              <span className="text-white/70 text-xs">▾</span>
            </button>

            {menuAberto && (
              <div className="absolute right-0 top-full pt-1 z-50">
                <div className="dropdown-enter rounded-xl min-w-[190px] py-1 overflow-hidden" style={dropdownStyle}>
                  <div className="px-4 py-2.5" style={{ borderBottom: '1px solid rgba(13,148,136,0.12)' }}>
                    <p className="text-xs font-semibold truncate" style={{ color: '#0d9488' }}>{profissional?.nome}</p>
                    <p className="text-xs truncate" style={{ color: '#94a3b8' }}>{profissional?.email}</p>
                  </div>
                  <MenuItem onClick={() => { setMenuAberto(false); setModalConfig(true) }}>
                    ⚙️ Configurações
                  </MenuItem>
                  <MenuItem onClick={() => { setMenuAberto(false); setModalSenha(true) }}>
                    🔑 Alterar senha
                  </MenuItem>
                  <MenuItem onClick={() => { setMenuAberto(false); signOut() }} danger divider>
                    ↪ Sair
                  </MenuItem>
                </div>
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
