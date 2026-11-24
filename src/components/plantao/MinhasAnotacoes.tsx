import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NotebookPen, Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { diasParaApagar, LIMITE_TEXTO, ordenarAnotacoes, pareceDadoDePaciente, type Anotacao } from '@/domain/anotacoes'
import { TituloCartao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

// Anotações pessoais do médico (pedido 7; AN1 a AN4 = A do RT em 23/11/2026):
// lembretes do próprio médico, sem dado de paciente, que só ele lê e que
// apagam sozinhos 30 dias depois da última mudança.

const CHAVE = 'anotacoes-medico'

export function MinhasAnotacoes({ className }: { className?: string }) {
  const qc = useQueryClient()
  const lista = useQuery({
    queryKey: [CHAVE],
    queryFn: async () => {
      const { data, error } = await supabase.from('anotacoes_medico')
        .select('id, texto, feita, fixada, criada_em, alterada_em')
        .order('alterada_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Anotacao[]
    },
  })
  const [texto, setTexto] = React.useState('')
  const [editando, setEditando] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string[] | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const [agora] = React.useState(() => Date.now())

  async function rodar(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setOcupado(true)
    const { error } = await fn()
    setOcupado(false)
    if (error) { setErro(error.message); return false }
    setErro(null)
    void qc.invalidateQueries({ queryKey: [CHAVE] })
    return true
  }

  async function salvar(confirmado = false) {
    const achados = pareceDadoDePaciente(texto, new Date().getFullYear())
    // AN1 = A: dado de paciente vai para as pendências; aqui só com confirmação
    if (!confirmado && achados.length) { setAviso(achados); return }
    setAviso(null)
    const ok = await rodar(() => supabase.rpc('salvar_anotacao', { p_id: editando, p_texto: texto }))
    if (ok) { setTexto(''); setEditando(null) }
  }

  const notas = ordenarAnotacoes(lista.data ?? [])
  const cabe = texto.trim().length > 0 && texto.length <= LIMITE_TEXTO

  return (
    <section aria-label="Minhas anotações" className={cn('flex flex-col gap-3 rounded-cartao border border-fio bg-superficie p-4 shadow-repouso', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <NotebookPen className="size-4 text-acao" aria-hidden />
        <TituloCartao className="mb-0">Minhas anotações</TituloCartao>
        <span className="text-rotulo text-tinta-sussurro">só você vê · apagam 30 dias depois da última mudança</span>
      </div>
      <p className="rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2 text-apoio text-tinta">
        Para lembretes seus. Não escreva nome, documento nem conduta de paciente: o que for do paciente vai nas pendências do passômetro.
      </p>

      <div className="flex flex-col gap-2">
        <Textarea value={texto} onChange={(e) => { setTexto(e.target.value); setAviso(null) }} maxLength={LIMITE_TEXTO}
          aria-label={editando ? 'Editar anotação' : 'Nova anotação'} placeholder="Ex.: ligar para o laboratório às 15h" rows={2} />
        {aviso && (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-controle border border-critico/30 bg-alerta-critico px-3 py-2 text-apoio text-critico">
            <span className="flex-1">Parece ter {aviso.join(' e ')}. Dado de paciente não fica aqui: use as pendências do passômetro.</span>
            <Button size="xs" variant="outline" onClick={() => void salvar(true)}>Salvar mesmo assim</Button>
          </div>
        )}
        {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => void salvar()} disabled={!cabe || ocupado}>{editando ? 'Salvar mudança' : 'Anotar'}</Button>
          {editando && <Button size="sm" variant="ghost" onClick={() => { setEditando(null); setTexto(''); setAviso(null) }}>Cancelar</Button>}
          <span className="ml-auto text-rotulo tabular-nums text-tinta-sussurro">{texto.length}/{LIMITE_TEXTO}</span>
        </div>
      </div>

      {lista.isLoading && <Spinner />}
      {lista.data && notas.length === 0 && <p className="text-apoio text-tinta-apoio">Nenhuma anotação.</p>}
      <ul className="flex flex-col">
        {notas.map((n) => {
          const dias = diasParaApagar(n.alterada_em, agora)
          return (
            <li key={n.id} className="flex items-start gap-2 border-t border-trilha py-2.5">
              <CaixaMarcar marcado={n.feita} onChange={(v) => void rodar(() => supabase.rpc('marcar_anotacao', { p_id: n.id, p_feita: v }))}
                title={n.feita ? 'Desmarcar feita' : 'Marcar como feita'} desabilitado={ocupado}>
                <span className="sr-only">Feita</span>
              </CaixaMarcar>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn('whitespace-pre-wrap text-corpo text-tinta', n.feita && 'text-tinta-sussurro line-through')}>{n.texto}</span>
                <span className="text-rotulo text-tinta-sussurro">
                  {n.fixada ? 'Fixada · ' : ''}{dias === 0 ? 'apaga hoje' : `apaga em ${dias} ${dias === 1 ? 'dia' : 'dias'}`}
                </span>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={n.fixada ? 'Tirar do topo' : 'Fixar no topo'} disabled={ocupado}
                onClick={() => void rodar(() => supabase.rpc('marcar_anotacao', { p_id: n.id, p_fixada: !n.fixada }))}>
                {n.fixada ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Editar" disabled={ocupado}
                onClick={() => { setEditando(n.id); setTexto(n.texto); setAviso(null) }}>
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Apagar" disabled={ocupado}
                onClick={() => void rodar(() => supabase.rpc('apagar_anotacao', { p_id: n.id }))}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
