export default function EmBreve({ titulo, descricao, icone = '🚧' }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">{icone}</div>
        <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--cor-texto)' }}>
          {titulo}
        </h1>
        <p className="text-base mb-6" style={{ color: 'var(--cor-texto-suave)', lineHeight: 1.7 }}>
          {descricao ?? 'Esta funcionalidade está em desenvolvimento e será disponibilizada em breve.'}
        </p>
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold"
          style={{ background: '#e0f2fe', color: '#0369a1' }}>
          Em breve
        </span>
      </div>
    </div>
  )
}
