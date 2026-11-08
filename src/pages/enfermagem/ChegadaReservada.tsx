// ─────────────────────────────────────────────────────────────────────────────
// O leito reservado pela regulação, na lista do setor da Internação da
// enfermagem (item 16 do teste da rede; decisão do RT em 08/11/2026: opção B).
// Mostra quem chega, de onde, o número e a saída. O enfermeiro escalado no
// setor confirma "Paciente chegou" (R5, 20270308000001): a chegada cria ou usa
// o cadastro, traz as alergias da origem e interna no leito reservado. "Não
// chegou" fica com o médico, o NIR e o gestor (E2).
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation } from '@tanstack/react-query'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { linhaDaChegada } from '@/lib/chegadaEnfermagem'
import { duplicataDaChegada } from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type ChegadaEnfermagem = Database['public']['Functions']['enfermagem_chegadas']['Returns'][number]

export function ChegadaReservada({ c, agora, aoFim }: { c: ChegadaEnfermagem; agora: number; aoFim: () => void }) {
  const [aberta, setAberta] = React.useState(false)
  // a escolha do cadastro na provável duplicata vai junto do clique
  const cadastro = React.useRef<{ paciente?: string; novo?: boolean }>({})
  const confirmar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_marcar_chegada', {
        p_id: c.regulacao_id, p_chegou: true,
        p_paciente_destino: cadastro.current.paciente, p_cadastro_novo: cadastro.current.novo ?? false,
      })
      if (error) throw error
    },
    onSuccess: () => { setAberta(false); cadastro.current = {}; aoFim() },
  })
  const duplicata = duplicataDaChegada(confirmar.error ? (confirmar.error as Error).message : null)

  return (
    <div className="border-b border-trilha bg-alerta-atencao last:border-0">
      <div className="flex flex-wrap items-center gap-3.5 px-5 py-3">
        <span className="w-11 shrink-0 text-apoio font-semibold text-atencao">{c.leito}</span>
        <span className="min-w-0 flex-[1_1_220px] text-apoio text-atencao [text-wrap:pretty]">{linhaDaChegada(c, agora)}</span>
        {c.pode_confirmar && (
          <Button variant={aberta ? 'default' : 'outline'} onClick={() => setAberta((v) => !v)} aria-expanded={aberta}>
            Paciente chegou
          </Button>
        )}
      </div>
      {aberta && (
        <div className="flex flex-col gap-2 px-5 pb-3 sm:pl-[76px]">
          <p className="text-apoio text-tinta">
            Confirmar a chegada de <span className="font-medium">{c.nome}</span> no leito {c.leito}, da {c.origem} (regulação nº {c.numero}).
          </p>
          <p className="text-apoio text-tinta-apoio">
            {c.alergias.length > 0 ? `Alergias informadas pela origem: ${c.alergias.join(', ')}.` : 'A origem não informou alergias.'}{' '}
            A chegada cria o cadastro (ou usa o desta unidade, pelo Cartão SUS ou CPF) e interna o paciente no leito reservado.
          </p>
          {duplicata ? (
            <div role="alert" className="flex flex-col gap-2 rounded-controle border border-atencao/40 bg-superficie p-2.5">
              <span className="text-apoio text-atencao">{duplicata.texto || 'Já existe cadastro parecido nesta unidade.'} É a mesma pessoa?</span>
              <div className="flex flex-wrap gap-2">
                <Button size="xs" onClick={() => { cadastro.current = { paciente: duplicata.id }; confirmar.mutate() }} disabled={confirmar.isPending}>Sim, usar esse cadastro</Button>
                <Button size="xs" variant="outline" onClick={() => { cadastro.current = { novo: true }; confirmar.mutate() }} disabled={confirmar.isPending}>Não, criar cadastro novo</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => confirmar.mutate()} disabled={confirmar.isPending}>Confirmar e internar</Button>
              <Button size="sm" variant="ghost" onClick={() => setAberta(false)}>Cancelar</Button>
            </div>
          )}
          {confirmar.error && !duplicata && <p role="alert" className="text-rotulo text-critico">{(confirmar.error as Error).message}</p>}
        </div>
      )}
    </div>
  )
}
