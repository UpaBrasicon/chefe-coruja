export function Skeleton({ className = '', style }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className}`}
      style={{ background: '#e9edf2', ...style }}
    />
  )
}

/* Linha de texto */
export function SkLine({ w = '100%', h = 14, className = '' }) {
  return <Skeleton className={className} style={{ width: w, height: h, borderRadius: 6 }} />
}

/* Card genérico — borda + padding + linhas */
export function SkCard({ linhas = 3, className = '' }) {
  const widths = ['75%', '55%', '40%', '65%', '50%']
  return (
    <div
      className={`rounded-2xl p-4 space-y-2.5 ${className}`}
      style={{ background: '#fff', border: '1px solid #e9edf2' }}
    >
      {Array.from({ length: linhas }).map((_, i) => (
        <SkLine key={i} w={widths[i % widths.length]} h={i === 0 ? 16 : 12} />
      ))}
    </div>
  )
}

/* Calendário (7 colunas × n linhas) */
export function SkCalendario({ semanas = 5 }) {
  return (
    <div className="animate-pulse space-y-1.5 px-2 pt-2">
      {/* Cabeçalho dias */}
      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} style={{ height: 22, borderRadius: 6 }} />
        ))}
      </div>
      {/* Semanas */}
      {Array.from({ length: semanas }).map((_, s) => (
        <div key={s} className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, d) => (
            <Skeleton key={d} style={{ height: 72, borderRadius: 10 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

/* Tabs placeholder */
export function SkTabs({ qtd = 4 }) {
  return (
    <div className="flex gap-2 mb-5">
      {Array.from({ length: qtd }).map((_, i) => (
        <Skeleton key={i} style={{ height: 34, width: 80, borderRadius: 10, flexShrink: 0 }} />
      ))}
    </div>
  )
}
