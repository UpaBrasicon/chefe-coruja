import Header from '../components/Header'
import EscalaCalendario from '../components/EscalaCalendario'

export default function Escala() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--cor-fundo)' }}>
      <Header />
      <main className="pt-4">
        <EscalaCalendario />
      </main>
    </div>
  )
}
