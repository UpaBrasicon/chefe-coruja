// ─────────────────────────────────────────────────────────────────────────────
// BuscaTerminologia — campo de busca reutilizável (shadcn/ui Command) para
// terminologias: CID-10, procedimentos SIGTAP, ocupações CBO, medicamentos
// CMED e exames LOINC. Usa useTerminologia (debounce 300ms + RPC).
//
// Uso:
//   <BuscaTerminologia tipo="cid10" onSelecionar={(r) => ...} />
//   <BuscaTerminologia tipo="medicamento_cmed" onSelecionar={...} />
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { useTerminologia, type ResultadoTerminologia, type TipoTerminologia } from '@/hooks/useTerminologia'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

const ROTULO_TIPO: Record<TipoTerminologia, string> = {
  cid10: 'CID-10',
  sigtap_procedimento: 'Procedimento (SIGTAP)',
  cbo: 'Ocupação (CBO)',
  medicamento_cmed: 'Medicamento (CMED)',
  loinc: 'Exame (LOINC)',
}

type Props = {
  tipo: TipoTerminologia
  onSelecionar: (resultado: ResultadoTerminologia) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function BuscaTerminologia({ tipo, onSelecionar, placeholder, className, autoFocus }: Props) {
  const [termo, setTermo] = useState('')
  const { data: resultados, isFetching, isError } = useTerminologia(tipo, termo)
  const semResultado = termo.trim().length >= 2 && !isFetching && !isError && (resultados ?? []).length === 0

  return (
    <Command className={cn('h-auto rounded-xl border bg-popover', className)} shouldFilter={false}>
      <CommandInput
        autoFocus={autoFocus}
        value={termo}
        onValueChange={setTermo}
        placeholder={placeholder ?? `Buscar ${ROTULO_TIPO[tipo]}…`}
        className="h-9"
      />
      {termo.trim().length >= 2 && (
        <CommandList>
          {isFetching && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando…
            </div>
          )}
          {isError && (
            <CommandEmpty>Erro ao buscar. Tente novamente.</CommandEmpty>
          )}
          {semResultado && <CommandEmpty>Nenhum resultado para “{termo.trim()}”.</CommandEmpty>}
          {(resultados ?? []).length > 0 && (
            <CommandGroup heading={ROTULO_TIPO[tipo]}>
              {resultados!.map((r) => (
                <CommandItem
                  key={`${r.tabela}-${r.codigo}`}
                  value={`${r.codigo} ${r.descricao}`}
                  onSelect={() => {
                    onSelecionar(r)
                    setTermo('')
                  }}
                >
                  <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{r.codigo}</span>
                  <span className="min-w-0 flex-1 truncate">{r.descricao}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      )}
    </Command>
  )
}
