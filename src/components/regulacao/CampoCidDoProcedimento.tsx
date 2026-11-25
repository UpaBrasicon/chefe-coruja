// ─────────────────────────────────────────────────────────────────────────────
// CID do pedido de regulação conferido com o procedimento SIGTAP (regra do RT
// de 24/11/2026). Com lista de CID no SIGTAP, a busca mostra só os CID dela e
// o CID que veio de antes (do prontuário ou escolhido) e não está nela aparece
// como conflito; sem lista, a busca é a do CID-10 inteiro. Trocar o
// procedimento confere de novo. Regras em src/lib/cidProcedimento.ts; a lista
// vem de regulacao_cids_do_procedimento (migration 20270423000010). Enquanto a
// RPC não existir no banco, a tela fica como antes (busca livre).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { BuscaTerminologia } from '@/components/terminologia/BuscaTerminologia'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useValorAdiado } from '@/hooks/useValorAdiado'
import { codigoProcedimento } from '@/lib/cidProcedimento'

import { cidsDoProcedimento } from './useCidsDoProcedimento'

export function CampoCidDoProcedimento({ procedimento, escolhido, conflito, rotulo, onEscolher, onLimpar }: {
  procedimento: string
  /** "J18.9 Pneumonia…" quando há CID; vazio, a busca. */
  escolhido: string
  conflito: string | null
  rotulo: React.ReactNode
  onEscolher: (codigo: string, rotulo: string) => void
  onLimpar: () => void
}) {
  const proc = codigoProcedimento(procedimento)
  const [termo, setTermo] = React.useState('')
  const termoAdiado = useValorAdiado(termo)
  const lista = useQuery({
    queryKey: ['regulacao-cids-do-procedimento', proc, termoAdiado.trim()],
    enabled: !!proc && !escolhido,
    staleTime: 10 * 60_000,
    placeholderData: (anterior) => anterior,
    queryFn: () => cidsDoProcedimento(proc, termoAdiado.trim() || null, null),
  })
  const r = lista.data
  const id = React.useId()

  return (
    <div className="flex flex-col gap-1">
      <span className="text-rotulo text-tinta-apoio">{rotulo}</span>
      {escolhido ? (
        <div className={`flex items-center gap-2 rounded-controle border px-2 py-1.5 ${conflito ? 'border-critico/40 bg-alerta-critico' : 'border-fio bg-campo'}`}>
          <span className="min-w-0 flex-1 truncate text-tinta">{escolhido}</span>
          <Button size="xs" variant="outline" onClick={() => { setTermo(''); onLimpar() }}>Trocar</Button>
        </div>
      ) : proc && lista.isLoading ? <Spinner /> : r?.tem_lista ? (
        <div className="flex flex-col gap-1 rounded-controle border border-fio bg-superficie p-2">
          <label htmlFor={id} className="sr-only">Buscar CID da lista do procedimento</label>
          <Input id={id} className="h-8" value={termo} onChange={(e) => setTermo(e.target.value)}
            placeholder="Código ou nome do CID da lista do procedimento" />
          <span className="text-rotulo text-tinta-sussurro">
            {r.total === 1 ? '1 CID compatível' : `${r.total} CID compatíveis`} com o procedimento {proc} no SIGTAP{r.competencia ? ` (competência ${r.competencia.slice(4)}/${r.competencia.slice(0, 4)})` : ''}.
          </span>
          {r.itens.length === 0 ? <span className="text-tinta-sussurro">Nenhum CID da lista com esse termo.</span> : (
            <ul className="flex max-h-56 flex-col overflow-y-auto">
              {r.itens.map((c) => (
                <li key={c.codigo}>
                  <BotaoLinha variante="linha" className="items-baseline gap-2 px-2 py-1.5" onClick={() => onEscolher(c.codigo, `${c.codigo} ${c.descricao}`)}>
                    <span className="font-medium tabular-nums text-tinta">{c.codigo}</span>
                    <span className="text-tinta-apoio">{c.descricao}</span>
                    {!c.principal && <span className="text-rotulo text-tinta-sussurro">só como secundário</span>}
                  </BotaoLinha>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <BuscaTerminologia tipo="cid10" onSelecionar={(x) => onEscolher(x.codigo, `${x.codigo} ${x.descricao}`)} />
      )}
      {conflito && <p role="alert" className="text-critico">{conflito}</p>}
      {lista.error && <p role="alert" className="text-rotulo text-critico">{(lista.error as Error).message}</p>}
    </div>
  )
}
