import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './ui/button'

export default function Header() {
  const { profissional, signOut } = useAuth()

  return (
    <header
      className="flex items-center justify-between px-4 py-3 shadow-sm sticky top-0 z-10"
      style={{ background: 'var(--cor-primaria)', color: '#fff' }}
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">🦉</span>
        <span className="font-bold text-lg tracking-tight">Chefe Coruja</span>
      </div>

      <div className="flex items-center gap-2">
        {profissional?.role === 'admin' && (
          <Link to="/admin">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:text-white hover:bg-white/20 text-xs"
            >
              Painel Admin
            </Button>
          </Link>
        )}
        <span className="text-sm hidden sm:block opacity-90 max-w-[180px] truncate">
          {profissional?.nome ?? ''}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="text-white hover:text-white hover:bg-white/20"
        >
          Sair
        </Button>
      </div>
    </header>
  )
}
