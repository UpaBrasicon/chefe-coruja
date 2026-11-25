// Combos de exames da unidade (EXM2, modelo do RT de 25/11/2026). Combo é
// conteúdo clínico: o app não traz combo pronto; o gestor monta, aqui, ao lado
// da lista de exames frequentes. Cada combo tem um nome e exames da lista da
// unidade. No pedido do leito, um clique põe o combo na cesta (nada é pedido
// sem o médico ver). Migration 20270425000011_exames_combos_unidade.sql.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Layers } from 'lucide-react'
import * as React from 'react'

import { useCombosExames, type ComboExames } from '@/components/exames/combos'
import { TituloCartao, Vazio } from '@/components/monitor/Pagina'
import { BuscaMultipla } from '@/components/ui/busca-multipla'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { ExameUnidade } from '@/lib/exames'
import { supabase } from '@/lib/supabase'

type Rascunho = { id: string | null; nome: string; procedimentos: string[]; ordem: string }

export function CombosExames({ unidadeId, exames }: { unidadeId: string; exames: ExameUnidade[] }) {
  const qc = useQueryClient()
  const lista = useCombosExames(unidadeId)
  const [editando, setEditando] = React.useState<Rascunho | null>(null)
  const [retirando, setRetirando] = React.useState<ComboExames | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const recarregar = () => { void qc.invalidateQueries({ queryKey: ['combos-exames', unidadeId] }) }
  const salvar = useMutation({
    mutationFn: async (r: Rascunho) => {
      const { error } = await supabase.rpc('definir_combo_exames', {
        p_unidade: unidadeId, p_combo: r.id ?? undefined, p_nome: r.nome.trim(), p_procedimentos: r.procedimentos, p_ordem: Number(r.ordem) || 0,
      })
      if (error) throw error
    },
    onSuccess: () => { setEditando(null); recarregar() },
  })
  const retirar = useMutation({
    mutationFn: async (c: ComboExames) => {
      const { error } = await supabase.rpc('retirar_combo_exames', { p_combo: c.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setRetirando(null); setMotivo(''); recarregar() },
  })
  const combos = lista.data?.combos ?? []
  const pode = !!lista.data?.pode_definir
  const opcoes = exames.map((e) => ({ id: e.procedimento, nome: e.nome_curto }))
  const erro = lista.error ?? salvar.error ?? retirar.error

  return (
    <section aria-labelledby="combos-exames" className="flex flex-col gap-3 rounded-container border border-fio bg-superficie p-3">
      <TituloCartao id="combos-exames" className="mb-0" extra={`${combos.length} ${combos.length === 1 ? 'combo' : 'combos'}`}>Combos de exames</TituloCartao>
      <p className="text-apoio text-tinta-sussurro">
        Um nome e os exames que entram juntos na cesta do pedido, com um clique. O app não traz combo pronto: a unidade monta os seus.
        Sem combo, a linha de combos não aparece no pedido.
      </p>
      <MensagemErro texto={erro ? (erro as Error).message : null} />
      {lista.isLoading ? <Spinner /> : combos.length === 0 && !editando ? (
        <Vazio icone={Layers} titulo="Nenhum combo" texto={exames.length ? 'Monte um combo com os exames da lista da unidade.' : 'Inclua exames na lista da unidade antes de montar um combo.'} />
      ) : (
        <ul className="flex flex-col divide-y divide-trilha rounded-controle border border-fio">
          {combos.map((c) => (
            <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-apoio">
              <span className="font-medium text-tinta">{c.nome}</span>
              <span className="min-w-0 flex-1 text-tinta-apoio">{c.itens.map((i) => i.nome_curto).join(', ') || 'nenhum exame da lista vigente'}</span>
              {pode && (
                <span className="flex gap-1">
                  <Button size="xs" variant="outline" onClick={() => setEditando({ id: c.id, nome: c.nome, procedimentos: c.itens.map((i) => i.procedimento), ordem: String(c.ordem) })}>Editar</Button>
                  <Button size="xs" variant="outline" onClick={() => { setRetirando(c); setMotivo('') }}>Retirar</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {pode && !editando && exames.length > 0 && (
        <Button size="sm" variant="outline" className="self-start" onClick={() => setEditando({ id: null, nome: '', procedimentos: [], ordem: '0' })}>Novo combo</Button>
      )}

      {editando && (
        <div className="flex flex-col gap-2 rounded-controle border border-fio p-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="combo-nome">Nome do combo</Label>
              <Input id="combo-nome" className="h-9 min-w-48" maxLength={60} value={editando.nome} onChange={(e) => setEditando({ ...editando, nome: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="combo-ordem">Ordem</Label>
              <Input id="combo-ordem" className="h-9 w-20" inputMode="numeric" value={editando.ordem} onChange={(e) => setEditando({ ...editando, ordem: e.target.value.replace(/\D/g, '') })} />
            </div>
          </div>
          <Label htmlFor="combo-exames">Exames do combo (da lista da unidade)</Label>
          <BuscaMultipla id="combo-exames" opcoes={opcoes} selecionados={editando.procedimentos}
            onChange={(ids) => setEditando({ ...editando, procedimentos: ids })} placeholder="Buscar exame da lista" vazio="Nenhum exame da lista com esse nome." />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Cancelar</Button>
            <Button size="sm" disabled={editando.nome.trim().length < 2 || editando.procedimentos.length === 0 || salvar.isPending}
              onClick={() => salvar.mutate(editando)}>Salvar combo</Button>
          </div>
        </div>
      )}

      {retirando && (
        <div className="flex flex-col gap-1.5 rounded-controle border border-fio p-3">
          <Label htmlFor="combo-motivo">Retirar o combo {retirando.nome}: motivo</Label>
          <Textarea id="combo-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRetirando(null)}>Voltar</Button>
            <Button size="sm" disabled={motivo.trim().length < 10 || retirar.isPending} onClick={() => retirar.mutate(retirando)}>Retirar</Button>
          </div>
        </div>
      )}
    </section>
  )
}
