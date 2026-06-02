import Layout from '../components/Layout'
import EscalaCalendario from '../components/EscalaCalendario'

export default function Escala() {
  return (
    <Layout style={{ background: 'linear-gradient(160deg, #f0f9ff 0%, #dbeafe 45%, #f0fdf9 100%)' }}>
      <main className="pt-4">
        <EscalaCalendario />
      </main>
    </Layout>
  )
}
