import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { AvisosProvider } from '../contexts/AvisosContext'

export default function Layout({ children, style, className }) {
  return (
    <AvisosProvider>
      <div className={`flex min-h-screen ${className ?? ''}`} style={style}>
        <Sidebar />
        <div style={{ flex: 1, marginLeft: '108px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <TopBar />
          <div style={{ flex: 1 }}>
            {children}
          </div>
        </div>
      </div>
    </AvisosProvider>
  )
}
