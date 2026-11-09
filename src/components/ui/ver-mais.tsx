import { Button } from '@/components/ui/button'

// Item 05 do kit de desempenho: listas administrativas em páginas. Mostra
// quantos já estão na tela e quantos existem; some quando já vieram todos.
export const PAGINA = 50

export function VerMais({ mostrados, total, ocupado, onClick }: { mostrados: number; total: number; ocupado?: boolean; onClick: () => void }) {
  if (mostrados >= total) return null
  return (
    <div className="flex items-center justify-center gap-3 py-2">
      <span className="text-apoio text-tinta-sussurro tabular-nums">{mostrados} de {total}</span>
      <Button variant="outline" size="sm" disabled={ocupado} onClick={onClick}>
        Ver mais
      </Button>
    </div>
  )
}
