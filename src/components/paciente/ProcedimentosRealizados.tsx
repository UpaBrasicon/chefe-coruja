// Procedimentos realizados (Fase 3, tarefa 3; vão no BPA-I). Quem fez
// registra na hora, da lista curta da unidade. O faturamento usa o mesmo
// quadro para lançar em nome de quem fez (`profissionalId`). O autor do
// registro é sempre o login. Competência fechada pelo faturamento não aceita
// registro nem cancelamento (o servidor recusa).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { EnderecoSus } from '@/components/paciente/EnderecoSus'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { codigoSigtapNaTela, type ProcedimentoRealizado, type Registravel } from '@/lib/bpa'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'

const selectCls = 'h-8 rounded-controle border border-fio bg-campo px-2 text-apoio'
const localDe = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function ProcedimentosRealizados({ pacienteId, unidadeId, episodioId, profissionalId, realizadoEmPadrao }: {
  pacienteId: string; unidadeId: string; episodioId?: string | null
  /** só o faturamento: lança em nome deste profissional */
  profissionalId?: string | null
  realizadoEmPadrao?: string
}) {
  const qc = useQueryClient()
  const lista = useQuery({
    queryKey: ['procedimentos-registraveis', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('procedimentos_registraveis', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as Registravel[]
    },
  })
  const feitos = useQuery({
    queryKey: ['procedimentos-do-paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('procedimentos_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ProcedimentoRealizado[]
    },
  })
  const [proc, setProc] = React.useState('')
  const [qtd, setQtd] = React.useState('1')
  const [quando, setQuando] = React.useState(() => localDe(realizadoEmPadrao ?? new Date().toISOString()))
  const registrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_procedimento', {
        p_paciente: pacienteId, p_procedimento: proc, p_quantidade: Number(qtd),
        p_episodio: episodioId ?? undefined, p_realizado_em: new Date(quando).toISOString(),
        p_profissional: profissionalId ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { setProc(''); setQtd('1'); void qc.invalidateQueries({ queryKey: ['procedimentos-do-paciente', pacienteId] }) },
  })
  const faturamento = profissionalId !== undefined
  const qtdOk = /^\d{1,6}$/.test(qtd) && Number(qtd) >= 1

  return (
    <div className="flex flex-col gap-2">
      {lista.isLoading ? <Spinner /> : (lista.data ?? []).length === 0 ? (
        <p className="text-xs text-tinta-sussurro">A unidade ainda não montou a lista de procedimentos (faturamento ou gestor, em Faturamento › Configuração).</p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-56 flex-1 flex-col gap-1">
            <Label htmlFor={`proc-${pacienteId}`} className="text-xs">Procedimento</Label>
            <select id={`proc-${pacienteId}`} className={selectCls} value={proc} onChange={(e) => setProc(e.target.value)}>
              <option value="">Escolha…</option>
              {(lista.data ?? []).map((p) => <option key={p.procedimento} value={p.procedimento}>{codigoSigtapNaTela(p.procedimento)} · {p.nome}</option>)}
            </select>
          </div>
          <div className="flex w-20 flex-col gap-1">
            <Label htmlFor={`qtd-${pacienteId}`} className="text-xs">Qtd.</Label>
            <Input id={`qtd-${pacienteId}`} className="h-8" inputMode="numeric" value={qtd} onChange={(e) => setQtd(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`quando-${pacienteId}`} className="text-xs">Quando</Label>
            <Input id={`quando-${pacienteId}`} className="h-8" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
          </div>
          <Button size="sm" disabled={!proc || !qtdOk || !quando || (faturamento && !profissionalId) || registrar.isPending}
            onClick={() => registrar.mutate()}>
            {faturamento ? 'Lançar' : 'Registrar'}
          </Button>
        </div>
      )}
      {registrar.error && <p role="alert" className="text-xs text-critico">{(registrar.error as Error).message}</p>}
      {feitos.isLoading ? null : feitos.error ? (
        <p role="alert" className="text-xs text-critico">{(feitos.error as Error).message}</p>
      ) : (feitos.data ?? []).length > 0 && (
        <ul className="flex flex-col gap-1">
          {(feitos.data ?? []).map((r) => <LinhaFeito key={r.id} r={r} pacienteId={pacienteId} podeCancelar={r.meu || faturamento} />)}
        </ul>
      )}
    </div>
  )
}

function LinhaFeito({ r, pacienteId, podeCancelar }: { r: ProcedimentoRealizado; pacienteId: string; podeCancelar: boolean }) {
  const qc = useQueryClient()
  const [abrindo, setAbrindo] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cancelar_procedimento_realizado', { p_id: r.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setAbrindo(false); void qc.invalidateQueries({ queryKey: ['procedimentos-do-paciente', pacienteId] }) },
  })
  return (
    <li className="flex flex-col gap-1 rounded-md border border-fio px-2.5 py-1.5 text-apoio">
      <div className="flex flex-wrap items-center gap-2">
        <span className={r.cancelado_em ? 'text-tinta-sussurro line-through' : 'text-tinta'}>
          {codigoSigtapNaTela(r.procedimento)} · {r.nome ?? 'fora do SIGTAP carregado'}{r.quantidade > 1 ? ` × ${r.quantidade}` : ''}
        </span>
        <span className="text-xs text-tinta-sussurro">
          {fmtDataHora(r.realizado_em)} · {r.profissional ?? '—'}{r.via === 'faturamento' ? ` (lançado por ${r.registrado_por ?? '—'})` : ''}
        </span>
        {r.cancelado_em && <Badge variant="secondary">cancelado: {r.motivo_cancelamento}</Badge>}
        {r.fechada && !r.cancelado_em && <Badge variant="info">competência fechada</Badge>}
        {podeCancelar && !r.cancelado_em && !r.fechada && !abrindo && (
          <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setAbrindo(true)}>Cancelar</Button>
        )}
      </div>
      {abrindo && (
        <div className="flex flex-wrap gap-2">
          <Input className="h-8 flex-1" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="xs" variant="destructive" disabled={motivo.trim().length < 10 || cancelar.isPending} onClick={() => cancelar.mutate()}>Cancelar registro</Button>
          <Button size="xs" variant="ghost" onClick={() => { setAbrindo(false); cancelar.reset() }}>Voltar</Button>
          {cancelar.error && <span role="alert" className="basis-full text-xs text-critico">{(cancelar.error as Error).message}</span>}
        </div>
      )}
    </li>
  )
}

/** Quadro para as telas clínicas: procedimentos do paciente e, recolhido, o endereço do SUS. */
export function QuadroProcedimentos({ pacienteId, unidadeId, episodioId }: { pacienteId: string; unidadeId: string; episodioId?: string | null }) {
  return (
    <section className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-4 py-3.5" aria-label="Procedimentos realizados">
      <div>
        <h3 className="text-corpo font-semibold text-tinta">Procedimentos realizados</h3>
        <p className="text-xs text-tinta-sussurro">
          Registre o que você fez: vai para o BPA da unidade com o seu CNS e CBO (Perfil). Atendimento médico, classificação de risco e medicação checada já entram sozinhos.
        </p>
      </div>
      <ProcedimentosRealizados pacienteId={pacienteId} unidadeId={unidadeId} episodioId={episodioId} />
      <details className="rounded-md border border-fio px-3 py-2">
        <summary className="cursor-pointer text-apoio text-tinta-apoio">Endereço e dados do SUS do paciente</summary>
        <div className="pt-2"><EnderecoSus pacienteId={pacienteId} titulo={false} /></div>
      </details>
    </section>
  )
}
