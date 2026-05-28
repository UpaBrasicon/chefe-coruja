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
      className="flex items-center justify-between px-4 py-3 shadow-sm sticky top-0 z-10"
      style={{ background: 'var(--cor-primaria)', color: '#fff' }}
    >
      <Link to="/escala" className="flex items-center gap-2 no-underline">
        <span className="text-2xl">🦉</span>
        <span className="font-bold text-lg tracking-tight text-white">Chefe Coruja</span>
      </Link>

      <div className="flex items-center gap-1">
        {/* Vagas em aberto */}
        <Link to="/desistencias" className="relative">
          <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20">
            Vagas
            {vagasCount > 0 && (
              <span className="absolute -top-1 -right-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: 'var(--cor-secundaria)', color: '#fff', fontSize: '10px' }}>
                {vagasCount}
              </span>
            )}
          </Button>
        </Link>

        {/* Trocas */}
        <Link to="/trocas" className="relative">
          <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20">
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
            <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20 text-xs">
              Admin
            </Button>
          </Link>
        )}

        <span className="text-sm hidden sm:block opacity-90 max-w-[140px] truncate ml-1">
          {profissional?.nome ?? ''}
        </span>

        <Button variant="ghost" size="sm" onClick={signOut} className="text-white hover:text-white hover:bg-white/20">
          Sair
        </Button>
      </div>
    </header>
  )
}
