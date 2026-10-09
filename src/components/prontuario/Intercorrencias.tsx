import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Siren } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { GRAVIDADES, PAPEL_REGISTRO, versoesAnteriores, vigentes, type Gravidade, type Intercorrencia } from '@/lib/intercorrencia'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Intercorrência estruturada (Fase 2, tarefa 4 do BACKLOG; migration
// 20261031000003). Médico, enfermeiro e técnico de enfermagem de plantão
// registram tipo, gravidade, hora, o que aconteceu e a conduta; o autor é o
// usuário do login. Nada se apaga: corrigir é retificar, e a versão anterior
// continua visível.

const VARIANTE: Record<Gravidade, 'outline' | 'warning' | 'destructive'> = { leve: 'outline', moderada: 'warning', grave: 'destructive' }
const PODE_REGISTRAR = ['plantonista', 'enfermeiro', 'tecnico_enfermagem']

/** "2026-10-08T14:05" na hora local, para o campo datetime-local. */
function agoraLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

export function Intercorrencias({ pacienteId, episodioId, internacaoId }: { pacienteId: string; episodioId?: string | null; internacaoId?: string | null }) {
  const { papelAtivo } = useUnidade()
  const podeRegistrar = !!papelAtivo && PODE_REGISTRAR.includes(papelAtivo) && (!!episodioId || !!internacaoId)
  const [form, setForm] = React.useState<{ retifica: Intercorrencia | null } | null>(null)
  const [verAnteriores, setVerAnteriores] = React.useState<string | null>(null)

  const lista = useQuery({
    queryKey: ['intercorrencias', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('intercorrencias_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as Intercorrencia[]
    },
  })
  const todas = lista.data ?? []
  const atuais = vigentes(todas)
  if (atuais.length === 0 && !podeRegistrar) return null

  return (
    <div className="flex flex-col gap-1.5">
      {atuais.map((x) => {
        const anteriores = versoesAnteriores(todas, x)
        return (
          <div key={x.id} role="note" className="flex flex-col gap-1 rounded-container border border-fio bg-superficie px-3 py-2 text-apoio">
            <div className="flex flex-wrap items-center gap-2">
              <Siren className="size-4 shrink-0 text-critico" aria-hidden />
              <strong className="font-semibold text-tinta">{x.tipo_rotulo}</strong>
              <Badge variant={VARIANTE[x.gravidade]}>{x.gravidade}</Badge>
              <span className="text-tinta-apoio">{fmtDataHora(x.ocorrida_em)}{x.setor ? ` · ${x.setor}` : ''}</span>
              {podeRegistrar && (
                <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setForm({ retifica: x })}>Retificar</Button>
              )}
            </div>
            <span className="text-tinta">{x.descricao}</span>
            <span className="text-tinta-apoio">Conduta: {x.conduta}</span>
            <span className="text-rotulo text-tinta-sussurro">
              {x.registrado_por ?? '—'} ({PAPEL_REGISTRO[x.papel] ?? x.papel}), {fmtDataHora(x.registrado_em)}
              {anteriores.length > 0 && (
                <> · <button type="button" className="underline" onClick={() => setVerAnteriores(verAnteriores === x.id ? null : x.id)}>
                  {anteriores.length} versão(ões) anterior(es)
                </button></>
              )}
            </span>
            {verAnteriores === x.id && anteriores.map((a) => (
              <span key={a.id} className="border-l-2 border-fio pl-2 text-rotulo text-tinta-sussurro line-through decoration-tinta-sussurro/40">
                {a.tipo_rotulo} · {a.gravidade} · {fmtDataHora(a.ocorrida_em)}: {a.descricao} — {a.conduta} ({a.registrado_por ?? '—'}, {fmtDataHora(a.registrado_em)})
              </span>
            ))}
          </div>
        )
      })}
      {podeRegistrar && (
        <div><Button size="sm" variant="outline" onClick={() => setForm({ retifica: null })}><Siren /> Registrar intercorrência</Button></div>
      )}
      {form && (
        <FormIntercorrencia key={form.retifica?.id ?? 'nova'} pacienteId={pacienteId} episodioId={episodioId ?? null} internacaoId={internacaoId ?? null}
          retifica={form.retifica} aoFechar={() => setForm(null)} />
      )}
    </div>
  )
}

function FormIntercorrencia({ pacienteId, episodioId, internacaoId, retifica, aoFechar }: {
  pacienteId: string; episodioId: string | null; internacaoId: string | null; retifica: Intercorrencia | null; aoFechar: () => void
}) {
  const qc = useQueryClient()
  const [tipo, setTipo] = React.useState(retifica?.tipo ?? '')
  const [tipoOutro, setTipoOutro] = React.useState(retifica?.tipo === 'outra' ? retifica.tipo_rotulo : '')
  const [gravidade, setGravidade] = React.useState<Gravidade | ''>(retifica?.gravidade ?? '')
  const [quando, setQuando] = React.useState(() => {
    if (!retifica) return agoraLocal()
    const d = new Date(retifica.ocorrida_em)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [descricao, setDescricao] = React.useState(retifica?.descricao ?? '')
  const [conduta, setConduta] = React.useState(retifica?.conduta ?? '')

  const tipos = useQuery({
    queryKey: ['tipos-intercorrencia'],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from('tipos_intercorrencia').select('codigo, rotulo').eq('ativo', true).order('ordem')
      if (error) throw error
      return data
    },
  })

  const registrar = useMutation({
    mutationFn: async () => {
      // nulos explícitos: a função do servidor não tem padrão para atendimento,
      // internação e "Outra"; se o campo não vai, o PostgREST não acha a função
      const { error } = await supabase.rpc('registrar_intercorrencia', {
        p_paciente: pacienteId, p_episodio: (retifica ? retifica.episodio_id : episodioId) ?? null,
        p_internacao: (retifica ? retifica.internacao_id : internacaoId) ?? null,
        p_tipo: tipo, p_tipo_outro: tipo === 'outra' ? tipoOutro.trim() : null, p_gravidade: gravidade,
        p_ocorrida_em: new Date(quando).toISOString(), p_descricao: descricao.trim(), p_conduta: conduta.trim(),
        p_retifica: retifica?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['intercorrencias', pacienteId] }); aoFechar() },
  })

  const pronto = !!tipo && (tipo !== 'outra' || tipoOutro.trim().length >= 3) && !!gravidade && !!quando
    && descricao.trim().length >= 10 && conduta.trim().length >= 5

  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar() }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="text-dialogo">{retifica ? 'Retificar intercorrência' : 'Registrar intercorrência'}</DialogTitle>
          <DialogDescription className="text-controle">
            {retifica ? 'A versão anterior fica guardada e visível como retificada.' : 'Fica no prontuário com o seu nome e não se apaga; para corrigir, retifique.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inter-tipo">Tipo</Label>
          <select id="inter-tipo" className="h-9 rounded-controle border border-fio bg-campo px-2 text-controle" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="">Escolha…</option>
            {(tipos.data ?? []).map((t) => <option key={t.codigo} value={t.codigo}>{t.rotulo}</option>)}
          </select>
          {tipo === 'outra' && <Input placeholder="Qual intercorrência?" value={tipoOutro} onChange={(e) => setTipoOutro(e.target.value)} />}
        </div>
        <div role="radiogroup" aria-label="Gravidade" className="grid gap-1.5 sm:grid-cols-3">
          {GRAVIDADES.map((g) => (
            <button key={g.valor} type="button" role="radio" aria-checked={gravidade === g.valor} onClick={() => setGravidade(g.valor)}
              className={cn('flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left', gravidade === g.valor ? 'border-marca ring-1 ring-marca' : 'border-fio')}>
              <span className="text-apoio font-medium text-tinta">{g.rotulo}</span>
              <span className="text-rotulo text-tinta-sussurro">{g.ajuda}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inter-quando">Hora em que ocorreu</Label>
          <Input id="inter-quando" type="datetime-local" className="w-56" value={quando} onChange={(e) => setQuando(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inter-desc">O que aconteceu</Label>
          <Textarea id="inter-desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Sinais, achados e circunstância" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="inter-conduta">Conduta</Label>
          <Textarea id="inter-conduta" rows={2} value={conduta} onChange={(e) => setConduta(e.target.value)} placeholder="O que foi feito e quem foi comunicado" />
        </div>
        {registrar.error && <p role="alert" className="text-apoio text-critico">{(registrar.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
          <Button disabled={!pronto || registrar.isPending} onClick={() => registrar.mutate()}><Siren /> {retifica ? 'Retificar' : 'Registrar'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
