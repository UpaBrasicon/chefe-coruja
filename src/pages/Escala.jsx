import Header from '../components/Header'
import EscalaCalendario from '../components/EscalaCalendario'
import { useNavyTheme } from '../hooks/useNavyTheme'

export default function Escala() {
  useNavyTheme()
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #0c1445 0%, #0e2d6e 45%, #0e4d8a 100%)' }}>
      <Header />
      <main className="pt-4">
        <EscalaCalendario />
      </main>
    </div>
  )
}
