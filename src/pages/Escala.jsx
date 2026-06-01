import Header from '../components/Header'
import EscalaCalendario from '../components/EscalaCalendario'

export default function Escala() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(160deg, #f0f9ff 0%, #dbeafe 45%, #f0fdf9 100%)' }}>
      <Header />
      <main className="pt-4">
        <EscalaCalendario />
      </main>
    </div>
  )
}
