import Sidebar from './Sidebar'
import ModalAlterarSenha from './ModalAlterarSenha'
import ModalConfiguracoes from './ModalConfiguracoes'

export default function Layout({ children, style, className }) {
  return (
    <div className={`flex min-h-screen ${className ?? ''}`} style={style}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '72px', minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}
