import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'

export default function Layout({ children, style, className }) {
  return (
    <div className={`flex min-h-screen ${className ?? ''}`} style={style}>
      {/* Sidebar — desktop only */}
      <Sidebar />

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-[108px]">
        <TopBar />
        {/* Padding bottom no mobile para não esconder conteúdo atrás do BottomNav */}
        <div className="flex-1 pb-[60px] md:pb-0">
          {children}
        </div>
      </div>

      {/* Bottom nav — mobile only */}
      <div className="md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
