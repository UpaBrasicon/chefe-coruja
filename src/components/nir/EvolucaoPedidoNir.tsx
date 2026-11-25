// Prazos e evolução do pedido no dossiê do NIR (decisão do RT de 25/11/2026:
// o NIR avisa o médico e também atualiza a evolução do pedido de regulação).
// É a atualização do pedido (regulacao_atualizar_evolucao: a "Evolução
// (versão N)" que a central lê e que reinicia o prazo), com autor = login; não
// é a evolução médica do prontuário. A lista mostra quem atualizou: "Evolução
// (versão 3) — atualizada pelo NIR, <nome>" (regulacao_evolucoes.autor_papel,
// migration 20270425000031). O formulário também abre pela barra de ações.
// Peça própria do NIR para não mexer no PrazosDoPedido da regulação, que a
// tela do regulador usa.
import { useMutation } from '@tanstack/react-query'
import { Timer } from 'lucide-react'
import * as React from 'react'

import { SeloSla } from '@/components/regulacao/SlaRegulacao'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { dataHora } from '@/lib/formato'
import { rotuloEvolucao } from '@/lib/nirPainel'
import type { Sla, StatusRegulacao } from '@/lib/regulacao'
import { textoTempos, type TempoStatus } from '@/lib/regulacaoLinhaTempo'
import { supabase } from '@/lib/supabase'

/** papel: medico, gestor ou nir (ausente nas evoluções antigas). */
export type EvolucaoNir = { texto: string; sinais_vitais: string | null; em: string; autor: string | null; papel?: string | null }

export function EvolucaoPedidoNir({ id, sla, status, tempos, evolucoes, podeEvoluir, aoFim, pedirEvolucao }: {
  id: string; sla: Sla | null; status: StatusRegulacao; tempos: TempoStatus[]; evolucoes: EvolucaoNir[]; podeEvoluir: boolean
  aoFim: () => void
  /** A barra de ações pede o formulário; muda a cada clique. */
  pedirEvolucao: number
}) {
  const [abrir, setAbrir] = React.useState(!!pedirEvolucao && podeEvoluir)
  const [pedidoVisto, setPedidoVisto] = React.useState(pedirEvolucao)
  if (pedirEvolucao !== pedidoVisto) {
    setPedidoVisto(pedirEvolucao)
    if (pedirEvolucao && podeEvoluir) setAbrir(true)
  }
  const [texto, setTexto] = React.useState('')
  const [sinais, setSinais] = React.useState('')
  const evoluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_atualizar_evolucao', { p_id: id, p_texto: texto.trim(), p_sinais_vitais: sinais.trim() || undefined })
      if (error) throw error
    },
    onSuccess: () => { setTexto(''); setSinais(''); setAbrir(false); aoFim() },
  })
  return (
    <section aria-label="Prazos e evolução do pedido" className="flex flex-col gap-2 rounded-controle border border-fio bg-superficie p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-medium text-tinta"><Timer className="size-4" aria-hidden /> Prazos e evolução do pedido</span>
        <SeloSla sla={sla} />
        {podeEvoluir && !abrir && <Button size="xs" variant="outline" className="ml-auto" onClick={() => setAbrir(true)}>Atualizar evolução</Button>}
      </div>
      {tempos.length > 0 && <p className="text-rotulo text-tinta-apoio">Tempo em cada status: {textoTempos(tempos, status)}</p>}
      {abrir && (
        <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim().length >= 10) evoluir.mutate() }}>
          <Label htmlFor={`evol-nir-${id}`} className="text-rotulo">
            Evolução do pedido (a central vê; o prazo recomeça). Fica com o seu nome e o seu papel; não vai para o prontuário.
          </Label>
          <Textarea id={`evol-nir-${id}`} rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <Label htmlFor={`evol-nir-sv-${id}`} className="text-rotulo">Sinais vitais, com hora (opcional)</Label>
          <Input id={`evol-nir-sv-${id}`} className="h-8" value={sinais} onChange={(e) => setSinais(e.target.value)} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={evoluir.isPending || texto.trim().length < 10}>Registrar evolução</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setAbrir(false)}>Voltar</Button>
          </div>
          {evoluir.error && <p role="alert" className="text-rotulo text-critico">{(evoluir.error as Error).message}</p>}
        </form>
      )}
      {evolucoes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {evolucoes.map((e, i) => (
            <li key={i} className="text-tinta">
              <span className="text-rotulo text-tinta-sussurro">{rotuloEvolucao(evolucoes.length - i, e.papel, e.autor)} · {dataHora(e.em)}</span>
              <p className="whitespace-pre-wrap">{e.texto}</p>
              {e.sinais_vitais && <p className="text-tinta-apoio">Sinais vitais: {e.sinais_vitais}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
