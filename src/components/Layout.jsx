import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout({ children, style, className }) {
  return (
    <div className={`flex min-h-screen ${className ?? ''}`} style={style}>
      <Sidebar />
      <div style={{ flex: 1, marginLeft: '72px', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <div style={{ flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  )
}
