import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useTrocasPendentes } from '../hooks/useTrocasPendentes'
import { useDesistenciasAbertas } from '../hooks/useDesistenciasAbertas'
import { Button } from './ui/button'

export default function Header() {
  const { profissional, signOut } = useAuth()
  const { count: trocasCount } = useTrocasPendentes()
  const { count: vagasCount } = useDesistenciasAbertas()

  return (
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
            <span className="hidden sm:inline">Vagas</span>
            <span className="sm:hidden">🏥</span>
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
            <span className="hidden sm:inline">Trocas</span>
            <span className="sm:hidden">🔄</span>
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
              <span className="hidden sm:inline">Admin</span>
              <span className="sm:hidden">⚙️</span>
            </Button>
          </Link>
        )}

        <span className="text-xs sm:text-sm hidden md:block opacity-90 max-w-[160px] truncate ml-1">
          {profissional?.nome ?? ''}
        </span>

        <Button variant="ghost" size="sm" onClick={signOut} className="text-white hover:text-white hover:bg-white/20 px-2 sm:px-3 text-xs sm:text-sm">
          Sair
        </Button>
      </div>
    </header>
  )
}
