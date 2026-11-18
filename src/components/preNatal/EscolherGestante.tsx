// Pré-natal do parceiro (U6, E3; PP3 = A): a ficha da parceria pede a gestante.
// A busca é a do cadastro da unidade (buscar_pacientes). O banco confere se a
// gestante tem pré-natal ativo na UBS (migration 20270415000011).
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { rotuloIdade } from '@/domain/idade'
import { useValorAdiado } from '@/hooks/useValorAdiado'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

export type Gestante = { id: string; nome: string; nome_social: string | null; data_nascimento: string | null }

export function EscolherGestante({ unidadeId, gestante, onEscolher }: {
  unidadeId: string; gestante: Gestante | null; onEscolher: (g: Gestante | null) => void
}) {
  const [termo, setTermo] = React.useState('')
  const t = useValorAdiado(termo.trim())
  const achados = useQuery({
    queryKey: ['parceria-busca-gestante', unidadeId, t],
    enabled: t.length >= 3 && !gestante,
    queryFn: async (): Promise<Gestante[]> => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId, p_termo: t })
      if (error) throw error
      return ((data ?? []) as Gestante[]).slice(0, 8)
    },
  })
  const hoje = dataIso()
  if (gestante) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-apoio font-medium text-tinta">Gestante</span>
        <span className="text-apoio text-tinta">{gestante.nome_social || gestante.nome}</span>
        <Button size="xs" variant="ghost" onClick={() => { onEscolher(null); setTermo('') }}>Trocar</Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="rec-gestante">Gestante do pré-natal do parceiro</Label>
      <Input id="rec-gestante" value={termo} onChange={(e) => setTermo(e.target.value)}
        placeholder="Nome, CPF, CNS ou prontuário da gestante" autoComplete="off" />
      {t.length > 0 && t.length < 3 && <span className="text-rotulo text-tinta-sussurro">Digite ao menos 3 letras.</span>}
      {achados.error && <p role="alert" className="text-apoio text-critico">{(achados.error as Error).message}</p>}
      {(achados.data ?? []).length > 0 && (
        <ul className="flex flex-col rounded-controle border border-fio bg-superficie">
          {(achados.data ?? []).map((a) => (
            <li key={a.id}>
              <BotaoLinha variante="linha" onClick={() => onEscolher(a)} className="py-2 text-apoio">
                {a.nome_social || a.nome}
                {a.data_nascimento && <span className="text-tinta-sussurro"> · {rotuloIdade(a.data_nascimento, hoje)}</span>}
              </BotaoLinha>
            </li>
          ))}
        </ul>
      )}
      {t.length >= 3 && achados.isSuccess && (achados.data ?? []).length === 0 && (
        <span className="text-apoio text-tinta-sussurro">Nenhum cadastro com esse termo.</span>
      )}
      <span className="text-rotulo text-tinta-sussurro">A gestante precisa estar no pré-natal da UBS.</span>
    </div>
  )
}
