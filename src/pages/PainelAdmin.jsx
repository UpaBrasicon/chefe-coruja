import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'

export default function PainelAdmin() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--cor-fundo)' }}>
      <div className="text-center">
        <div className="text-5xl mb-4">🛠️</div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--cor-texto)' }}>Painel Admin</h2>
        <p style={{ color: 'var(--cor-texto-suave)' }}>Em construção — disponível na Fase 5.</p>
        <Link to="/escala">
          <Button className="mt-6" style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
            Voltar para a Escala
          </Button>
        </Link>
      </div>
    </div>
  )
}
