// Abas sublinhadas e densas da Internação do NIR (modelo do RT, 25/11/2026):
// a barra do topo, os filtros da lista e as abas do dossiê. Usa as abas da
// base (src/components/ui/tabs), só com o espaçamento menor e a contagem.
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type AbaLinha<K extends string> = { valor: K; rotulo: string; contagem?: number; alerta?: boolean }

export function AbasLinha<K extends string>({ abas, valor, onChange, rotulo, className, tamanho = 'normal' }: {
  abas: AbaLinha<K>[]; valor: K; onChange: (k: K) => void; rotulo: string; className?: string
  /** compacto: filtros da lista (12 px). */
  tamanho?: 'normal' | 'compacto'
}) {
  return (
    <Tabs value={valor} onValueChange={(v) => onChange(v as K)} className="gap-0">
      <TabsList aria-label={rotulo} className={cn('gap-0 border-b-0', className)}>
        {abas.map((a) => (
          <TabsTrigger key={a.valor} value={a.valor}
            className={cn('rounded-none data-active:bg-transparent', tamanho === 'compacto' ? 'px-2 pt-1.5 pb-1.5 text-rotulo' : 'px-3 pt-3 pb-2.5')}>
            {a.rotulo}
            {a.contagem !== undefined && (
              <span className={cn('font-mono text-rotulo tabular-nums',
                a.alerta && a.contagem > 0 ? 'rounded-controle bg-atencao/10 px-1 text-atencao' : 'opacity-80')}>
                {tamanho === 'compacto' ? `(${a.contagem})` : a.contagem}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
