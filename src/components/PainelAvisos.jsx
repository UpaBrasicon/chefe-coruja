import { useNavigate } from 'react-router-dom'
import { X, CheckCheck, Trash2 } from 'lucide-react'

const TIPO_CONFIG = {
  troca_solicitada: { icone: '🔄', cor: '#3b82f6', bg: '#eff6ff' },
  troca_aceita:     { icone: '✅', cor: '#16a34a', bg: '#f0fdf4' },
  troca_recusada:   { icone: '❌', cor: '#dc2626', bg: '#fef2f2' },
  designado:        { icone: '📋', cor: '#7c3aed', bg: '#f5f3ff' },
  fechamento_ponto: { icone: '📅', cor: '#d97706', bg: '#fffbeb' },
  geral:            { icone: '🔔', cor: '#6b7280', bg: '#f9fafb' },
}

function tempoRelativo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60)   return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export default function PainelAvisos({ aberto, onFechar, avisos, naoLidas, onMarcarLida, onMarcarTodasLidas, onExcluir }) {
  const navigate = useNavigate()

  function handleClick(aviso) {
    if (!aviso.lida) onMarcarLida(aviso.id)
    if (aviso.link) { navigate(aviso.link); onFechar() }
  }

  return (
    <>
      {/* Overlay */}
      {aberto && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.08)' }}
          onClick={onFechar}
        />
      )}

      {/* Painel */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: '360px',
          background: '#fff',
          boxShadow: '-6px 0 32px rgba(0,0,0,0.12)',
          transform: aberto ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: '1px solid #f3f4f6' }}
        >
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-800" style={{ fontSize: '15px' }}>
              Notificações
            </h2>
            {naoLidas > 0 && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: '#ef4444', color: '#fff', fontSize: '11px' }}
              >
                {naoLidas}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {naoLidas > 0 && (
              <button
                onClick={onMarcarTodasLidas}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-gray-100"
                style={{ color: '#6b7280' }}
                title="Marcar todas como lidas"
              >
                <CheckCheck size={14} />
                Todas lidas
              </button>
            )}
            <button
              onClick={onFechar}
              className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
              style={{ color: '#9ca3af' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {avisos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <span className="text-4xl mb-3">🔔</span>
              <p className="font-medium text-gray-500 text-sm">Nenhuma notificação</p>
              <p className="text-xs text-gray-400 mt-1">As novidades aparecerão aqui</p>
            </div>
          ) : (
            <div>
              {avisos.map(aviso => {
                const cfg = TIPO_CONFIG[aviso.tipo] ?? TIPO_CONFIG.geral
                return (
                  <div
                    key={aviso.id}
                    className="flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors"
                    style={{
                      background: aviso.lida ? '#fff' : '#fafbff',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = aviso.lida ? '#fff' : '#fafbff'}
                    onClick={() => handleClick(aviso)}
                  >
                    {/* Ícone */}
                    <div
                      className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base"
                      style={{ background: cfg.bg }}
                    >
                      {cfg.icone}
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm leading-snug"
                        style={{
                          color: '#111827',
                          fontWeight: aviso.lida ? 400 : 600,
                        }}
                      >
                        {aviso.titulo}
                      </p>
                      {aviso.mensagem && (
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#6b7280' }}>
                          {aviso.mensagem}
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                        {tempoRelativo(aviso.criada_em)}
                      </p>
                    </div>

                    {/* Indicadores */}
                    <div className="shrink-0 flex flex-col items-end gap-2 pt-0.5">
                      {!aviso.lida && (
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: '#3b82f6' }}
                        />
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); onExcluir(aviso.id) }}
                        className="p-1 rounded transition-colors hover:bg-red-50"
                        style={{ color: '#d1d5db' }}
                        title="Excluir"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {avisos.length > 0 && (
          <div
            className="px-4 py-3 text-center shrink-0"
            style={{ borderTop: '1px solid #f3f4f6' }}
          >
            <p className="text-xs" style={{ color: '#9ca3af' }}>
              {avisos.length} notificação{avisos.length !== 1 ? 'ões' : ''} · apenas as últimas 50
            </p>
          </div>
        )}
      </div>
    </>
  )
}
