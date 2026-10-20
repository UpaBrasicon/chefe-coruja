// ─────────────────────────────────────────────────────────────────────────────
// Isolamento do paciente (Correções do Portão 2, tarefa 1; R2-01).
//
// Selo no cabeçalho único do paciente (porta e leito): vermelho quando há
// isolamento ativo (aerossol, gotícula, contato), discreto quando não há.
// A gaveta marca e retira, sempre com motivo; médico ou enfermeiro (o banco
// confere). A marca vale para o atendimento atual e sai sozinha na alta. Com
// isolamento ativo, o banco só aceita leito do tipo isolamento.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { diaMesHora } from '@/lib/formato'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

export type TipoIsolamento = 'contato' | 'goticula' | 'aerossol'
export type Isolamento = { id: string; tipo: TipoIsolamento; motivo: string; marcado_em: string; marcado_por: string | null }

const ROTULO_ISOLAMENTO: Record<TipoIsolamento, string> = { aerossol: 'Aerossol', goticula: 'Gotícula', contato: 'Contato' }
const EXEMPLO: Record<TipoIsolamento, string> = {
  aerossol: 'tuberculose, sarampo, varicela',
  goticula: 'meningite meningocócica, coqueluche, influenza',
  contato: 'germe multirresistente, diarreia infecciosa, escabiose',
}

const erroTexto = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message) ?? 'Não foi possível salvar.'
const quando = (iso: string) => diaMesHora(iso)

function useIsolamento(pacienteId: string) {
  return useQuery({
    queryKey: ['isolamento', pacienteId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('isolamento_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as Isolamento[]
    },
  })
}

export function SeloIsolamento({ pacienteId, onClick }: { pacienteId: string; onClick: () => void }) {
  const q = useIsolamento(pacienteId)
  const lista = q.data ?? []
  if (q.isLoading || q.error) return null
  if (!lista.length) {
    return (
      <Button variant="ghost" onClick={onClick} title="Sem isolamento. Marcar isolamento." className="min-h-0 gap-1 p-0">
        <ShieldAlert className="size-3.5" aria-hidden /> Isolamento
      </Button>
    )
  }
  const tipos = lista.map((i) => ROTULO_ISOLAMENTO[i.tipo].toLowerCase()).join(' e ')
  return (
    // padrao-ok: selo de isolamento ativo, cápsula vermelha cheia como o selo de alergia; nenhuma peça tem esse tom
    <button type="button" onClick={onClick} title={`Isolamento por ${tipos}: só leito de isolamento. Abrir isolamento.`}
      className="inline-flex items-center gap-1.5 rounded-capsula bg-critico px-[11px] py-1 text-apoio font-semibold text-sobre-acao hover:opacity-90">
      <ShieldAlert className="size-3.5 shrink-0" aria-hidden /> Isolamento · {tipos}
    </button>
  )
}

export function GavetaIsolamento({ pacienteId, nome, aberta, onAbertaChange }: {
  pacienteId: string; nome: string; aberta: boolean; onAbertaChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const q = useIsolamento(pacienteId)
  const [tipo, setTipo] = React.useState<TipoIsolamento | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [retirando, setRetirando] = React.useState<string | null>(null)
  const [motivoRetirada, setMotivoRetirada] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)

  const atualizar = () => {
    void qc.invalidateQueries({ queryKey: ['isolamento', pacienteId] })
    setErro(null)
  }
  const marcar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('marcar_isolamento', { p_paciente: pacienteId, p_tipo: tipo!, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setTipo(null); setMotivo(''); atualizar() },
    onError: (e) => setErro(erroTexto(e)),
  })
  const retirar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('retirar_isolamento', { p_isolamento: id, p_motivo: motivoRetirada.trim() })
      if (error) throw error
    },
    onSuccess: () => { setRetirando(null); setMotivoRetirada(''); atualizar() },
    onError: (e) => setErro(erroTexto(e)),
  })

  const ativos = q.data ?? []
  const livres = (['aerossol', 'goticula', 'contato'] as TipoIsolamento[]).filter((t) => !ativos.some((a) => a.tipo === t))

  return (
    <Gaveta aberta={aberta} onAbertaChange={onAbertaChange} rotulo="Isolamento">
      <GavetaCabeca sobre="Isolamento" titulo={nome}
        detalhe="Vale para o atendimento atual e sai sozinho na alta. Com isolamento, só leito de isolamento; sem leito livre, o paciente aguarda e o NIR é avisado." />
      <div className="flex flex-col gap-5 px-5 py-4">
        {q.isLoading && <Spinner className="size-4" />}
        {erro && <p role="alert" className="rounded-controle border border-critico/40 bg-critico/10 px-3 py-2 text-apoio text-tinta">{erro}</p>}

        <section className="flex flex-col gap-2">
          <h3 className="rotulo text-tinta-sussurro">Ativo</h3>
          {!q.isLoading && !ativos.length && <p className="text-apoio text-tinta-sussurro">Sem isolamento.</p>}
          {ativos.map((i) => (
            <div key={i.id} className="flex flex-col gap-2 rounded-controle border border-critico/40 px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-corpo font-semibold text-critico">{ROTULO_ISOLAMENTO[i.tipo]}</span>
                <span className="text-apoio text-tinta-sussurro">{quando(i.marcado_em)}{i.marcado_por ? ` · ${i.marcado_por}` : ''}</span>
              </div>
              <p className="text-apoio text-tinta">{i.motivo}</p>
              {retirando === i.id ? (
                <div className="flex flex-col gap-2">
                  <Textarea aria-label="Motivo da retirada" placeholder="Por que o isolamento sai (ex.: baciloscopias negativas)"
                    value={motivoRetirada} onChange={(e) => setMotivoRetirada(e.target.value)} rows={2} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" disabled={motivoRetirada.trim().length < 5 || retirar.isPending}
                      onClick={() => retirar.mutate(i.id)}>Retirar isolamento</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setRetirando(null); setMotivoRetirada('') }}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <Button size="xs" variant="outline" className="self-start" onClick={() => { setRetirando(i.id); setErro(null) }}>Retirar…</Button>
              )}
            </div>
          ))}
        </section>

        {livres.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="rotulo text-tinta-sussurro">Marcar isolamento</h3>
            <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Tipo de isolamento">
              {livres.map((t) => (
                <label key={t} className={cn('flex cursor-pointer items-start gap-2 rounded-controle border px-3 py-2',
                  tipo === t ? 'border-acao bg-acao/10' : 'border-fio')}>
                  <input type="radio" name="tipo-isolamento" className="mt-1" checked={tipo === t} onChange={() => setTipo(t)} />
                  <span className="flex flex-col">
                    <span className="text-corpo font-medium text-tinta">{ROTULO_ISOLAMENTO[t]}</span>
                    <span className="text-apoio text-tinta-sussurro">{EXEMPLO[t]}</span>
                  </span>
                </label>
              ))}
            </div>
            <Textarea aria-label="Motivo do isolamento" placeholder="Motivo (ex.: suspeita de tuberculose bacilífera)"
              value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
            <Button className="self-start" disabled={!tipo || motivo.trim().length < 5 || marcar.isPending} onClick={() => marcar.mutate()}>
              Marcar isolamento
            </Button>
          </section>
        )}
      </div>
      <GavetaPe>Médico ou enfermeiro marca e retira, sempre com motivo. Tudo fica na auditoria.</GavetaPe>
    </Gaveta>
  )
}
