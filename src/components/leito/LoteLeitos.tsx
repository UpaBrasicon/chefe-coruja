// Ação em lote nos leitos de um setor (revisão do gestor, RT 24/11/2026, M3
// da Unidade). Cada leito passa pela mesma RPC da ação de um leito só (o banco
// confere papel e transição); o que o banco recusa volta na lista de recusas,
// e o resto segue.
import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { MOTIVOS_BLOQUEIO, type MotivoBloqueio } from '@/components/leito/motivos'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { excluirLeito } from '@/lib/api'
import { supabase } from '@/lib/supabase'

export type LeitoLote = { id: string; identificador: string; status: string; obito_aguardando_id?: string | null }
type Acao = 'bloquear' | 'desbloquear' | 'higienizacao' | 'excluir'

const PODE: Record<Acao, (l: LeitoLote) => boolean> = {
  bloquear: (l) => l.status === 'livre' || l.status === 'higienizacao',
  desbloquear: (l) => l.status === 'bloqueado',
  higienizacao: (l) => l.status === 'higienizacao',
  excluir: (l) => l.status !== 'ocupado' && !l.obito_aguardando_id,
}
const ROTULO: Record<Acao, string> = {
  bloquear: 'Bloquear', desbloquear: 'Desbloquear', higienizacao: 'Concluir higienização', excluir: 'Excluir',
}

export function BarraLote({ leitos, selecionados, unidadeId, onLimpar, onTodos }: {
  leitos: LeitoLote[]; selecionados: Set<string>; unidadeId: string; onLimpar: () => void; onTodos: () => void
}) {
  const qc = useQueryClient()
  const [ocupado, setOcupado] = React.useState(false)
  const [resultado, setResultado] = React.useState<string | null>(null)
  const [bloqueio, setBloqueio] = React.useState(false)
  const [motivo, setMotivo] = React.useState<MotivoBloqueio | ''>('')
  const [obs, setObs] = React.useState('')
  const escolhidos = leitos.filter((l) => selecionados.has(l.id))

  async function aplicar(acao: Acao) {
    const alvo = escolhidos.filter(PODE[acao])
    if (acao === 'excluir' && !window.confirm(`Excluir ${alvo.length === 1 ? 'o leito' : `os ${alvo.length} leitos`} ${alvo.map((l) => l.identificador).join(', ')}?`)) return
    setOcupado(true); setResultado(null)
    const recusas: string[] = []
    for (const l of alvo) {
      try {
        if (acao === 'excluir') await excluirLeito(l.id, unidadeId)
        else {
          const { error } = acao === 'bloquear'
            ? await supabase.rpc('bloquear_leito', { p_leito: l.id, p_motivo: motivo as string, p_observacao: obs.trim() || undefined })
            : acao === 'desbloquear'
              ? await supabase.rpc('desbloquear_leito', { p_leito: l.id })
              : await supabase.rpc('concluir_higienizacao', { p_leito: l.id })
          if (error) throw error
        }
      } catch (e) {
        recusas.push(`${l.identificador}: ${(e as Error).message}`)
      }
    }
    setOcupado(false)
    for (const k of [['leitos'], ['setores', unidadeId], ['situacao-leitos'], ['mapa-leitos-gestor'], ['mapa-leitos-outros-setores'], ['censo']]) {
      void qc.invalidateQueries({ queryKey: k })
    }
    const feitos = alvo.length - recusas.length
    const pulados = escolhidos.length - alvo.length
    setResultado([
      `${ROTULO[acao]}: ${feitos} de ${alvo.length} ${alvo.length === 1 ? 'leito' : 'leitos'}.`,
      pulados ? `${pulados} ${pulados === 1 ? 'ficou de fora' : 'ficaram de fora'} por não estar na situação certa.` : '',
      recusas.length ? `Recusados: ${recusas.join('; ')}.` : '',
    ].filter(Boolean).join(' '))
    if (recusas.length === 0) onLimpar()
    if (acao === 'bloquear') { setBloqueio(false); setMotivo(''); setObs('') }
  }

  const botao = (acao: Acao) => {
    const n = escolhidos.filter(PODE[acao]).length
    return (
      <Button key={acao} size="sm" variant={acao === 'excluir' ? 'destructive' : 'outline'} disabled={ocupado || n === 0}
        onClick={() => (acao === 'bloquear' ? setBloqueio(true) : void aplicar(acao))}>
        {ROTULO[acao]}{n ? ` (${n})` : ''}
      </Button>
    )
  }

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-controle border border-acao/40 bg-alerta-marca px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-apoio">
        <span className="font-medium text-tinta">
          {escolhidos.length === 0 ? 'Toque nos leitos para escolher' : `${escolhidos.length} ${escolhidos.length === 1 ? 'leito escolhido' : 'leitos escolhidos'}`}
        </span>
        <Button size="sm" variant="outline" onClick={onTodos} disabled={ocupado}>Escolher todos</Button>
        <span className="flex-1" />
        {ocupado && <Spinner />}
        {(['bloquear', 'desbloquear', 'higienizacao', 'excluir'] as Acao[]).map(botao)}
        <Button size="sm" variant="outline" onClick={onLimpar} disabled={ocupado}>Sair da seleção</Button>
      </div>
      {resultado && <p role="status" className="text-apoio text-tinta-apoio">{resultado}</p>}

      <Dialog open={bloqueio} onOpenChange={(o) => { if (!o) setBloqueio(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear {escolhidos.filter(PODE.bloquear).length} leitos</DialogTitle>
            <DialogDescription>Os leitos saem da lista de livres até serem desbloqueados. O motivo fica registrado em cada um.</DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-apoio font-medium text-grafite">Motivo</legend>
            {(Object.keys(MOTIVOS_BLOQUEIO) as MotivoBloqueio[]).map((m) => (
              <label key={m} className="flex items-center gap-2 text-apoio text-tinta">
                <input type="radio" name="motivo-bloqueio-lote" value={m} checked={motivo === m} onChange={() => setMotivo(m)} className="size-4" />
                {MOTIVOS_BLOQUEIO[m]}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="obs-bloqueio-lote" className="text-apoio font-medium text-grafite">{motivo === 'outro' ? 'Descreva o motivo' : 'Observação (opcional)'}</label>
            <Textarea id="obs-bloqueio-lote" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} maxLength={300} />
          </div>
          <DialogFooter>
            <Button onClick={() => void aplicar('bloquear')} disabled={ocupado || !motivo || (motivo === 'outro' && obs.trim().length < 5)}>
              {ocupado && <Spinner />} Bloquear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
