// Abas sublinhadas e densas da Internação do NIR (modelo do RT, 25/11/2026):
// a barra do topo, os filtros da lista e as abas do dossiê. Usa as abas da
// base (src/components/ui/tabs), só com o espaçamento menor e a contagem.
// NI3 (revisão unslop, RT 25/11/2026): `quebrar` deixa as abas descerem de
// linha em vez de rolar de lado (as do dossiê), com a contagem solta
// ("Conversa 0").
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export type AbaLinha<K extends string> = { valor: K; rotulo: string; contagem?: number; alerta?: boolean }

export function AbasLinha<K extends string>({ abas, valor, onChange, rotulo, className, tamanho = 'normal', quebrar = false }: {
  abas: AbaLinha<K>[]; valor: K; onChange: (k: K) => void; rotulo: string; className?: string
  /** compacto: filtros da lista (12 px). */
  tamanho?: 'normal' | 'compacto'
  /** Abas em mais de uma linha quando não cabem, sem rolagem lateral; contagem sem parênteses. */
  quebrar?: boolean
}) {
  return (
    <Tabs value={valor} onValueChange={(v) => onChange(v as K)} className="gap-0">
      <TabsList aria-label={rotulo} className={cn('gap-0 border-b-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', quebrar && 'flex-wrap overflow-visible', className)}>
        {abas.map((a) => (
          <TabsTrigger key={a.valor} value={a.valor}
            className={cn('rounded-none data-active:bg-transparent', tamanho === 'compacto' ? 'shrink-0 px-1.5 pt-1.5 pb-1.5 text-rotulo' : 'px-3 pt-3 pb-2.5')}>
            {a.rotulo}
            {a.contagem !== undefined && (
              <span className={cn('font-mono text-rotulo tabular-nums',
                a.alerta && a.contagem > 0 ? 'rounded-controle bg-atencao/10 px-1 text-atencao' : 'opacity-80')}>
                {tamanho === 'compacto' && !quebrar ? `(${a.contagem})` : a.contagem}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
