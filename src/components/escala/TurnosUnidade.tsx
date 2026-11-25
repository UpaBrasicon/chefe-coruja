// ─────────────────────────────────────────────────────────────────────────────
// Turnos da unidade (pedido do RT, 24/11/2026; migration 20270421000050). O
// gestor ou o administrador cadastra os turnos da escala: nome, início, fim,
// quem cobre e se é sobreaviso. Manhã, tarde e noite vêm prontos e têm o
// horário fixo (só o nome muda). Turno não se apaga: desativa e reativa. As
// grades Fixa e Mensal mostram os turnos ativos, na ordem desta lista.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { TituloCartao } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useTurnosUnidade } from '@/hooks/useTurnosUnidade'
import { supabase } from '@/lib/supabase'
import {
  COBRE_TURNO, hhmm, horarioDoTurno, minutosDoTurno, rotuloHoras, validarTurno, type CobreTurno, type Turno,
} from '@/lib/turnos'
import { cn } from '@/lib/utils'

type Form = { id: string | null; padrao: boolean; nome: string; inicio: string; fim: string; cobre: CobreTurno; sobreaviso: boolean }
const VAZIO: Form = { id: null, padrao: false, nome: '', inicio: '07:00', fim: '19:00', cobre: 'todos', sobreaviso: false }

export function TurnosUnidade() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const podeEditar = papelAtivo === 'gestor' || papelAtivo === 'admin'
  const qc = useQueryClient()
  const turnos = useTurnosUnidade(unidadeId)
  const [form, setForm] = React.useState<Form | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['turnos-unidade', unidadeId] })
    void qc.invalidateQueries({ queryKey: ['escala-plantao-mes'] })
  }
  const salvar = useMutation({
    mutationFn: async (f: Form) => {
      const { error } = await supabase.rpc('salvar_turno_unidade', {
        p_unidade: unidadeId!, p_id: f.id, p_nome: f.nome.trim(), p_inicio: f.inicio, p_fim: f.fim,
        p_cobre: f.cobre, p_sobreaviso: f.sobreaviso,
      })
      if (error) throw error
    },
    onSuccess: () => { setForm(null); setErro(null); ativar.reset(); recarregar() },
  })
  const ativar = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.rpc('ativar_turno_unidade', { p_id: id, p_ativo: ativo })
      if (error) throw error
    },
    onSuccess: () => { setErro(null); salvar.reset(); recarregar() },
  })

  if (!unidadeId) return null
  const lista = turnos.todos
  const editar = (t: Turno) => {
    setErro(null)
    setForm({ id: t.id ?? null, padrao: t.padrao, nome: t.nome, inicio: hhmm(t.inicio), fim: hhmm(t.fim), cobre: t.cobre, sobreaviso: t.sobreaviso })
  }
  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form) return
    const problema = validarTurno(form)
    if (problema) { setErro(problema); return }
    salvar.mutate(form)
  }
  const ativos = lista.filter((t) => t.ativo).length

  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-trilha px-5 py-[15px]">
        <div className="flex min-w-0 flex-col gap-0.5">
          <TituloCartao className="mb-0">Turnos da unidade</TituloCartao>
          <span className="text-apoio text-pretty text-tinta-sussurro">
            Os horários da escala desta unidade. As grades Fixa e Mensal mostram os turnos ativos, nesta ordem.
          </span>
        </div>
        {podeEditar && !form && (
          <Button onClick={() => { setErro(null); setForm({ ...VAZIO }) }}>Novo turno</Button>
        )}
      </div>

      {turnos.isLoading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : turnos.isError ? (
        <div className="px-5 py-3"><MensagemErro erro={turnos.error} acao="ler os turnos da unidade" /></div>
      ) : (
        <ul className="flex flex-col">
          {lista.map((t) => (
            <li key={t.id ?? t.codigo} className="flex flex-wrap items-center gap-3 border-b border-trilha px-5 py-3">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn('text-corpo font-medium', t.ativo ? 'text-tinta' : 'text-tinta-apoio')}>
                  {t.nome}
                  {t.sobreaviso && <span className="ml-2 text-apoio font-normal text-acao">sobreaviso</span>}
                </span>
                <span className="text-apoio text-tinta-sussurro tabular">
                  {horarioDoTurno(t)} · {rotuloHoras(t.duracao_min)} · {t.cobre === 'todos' ? 'todos cobrem' : `cobre: ${COBRE_TURNO.find((c) => c.valor === t.cobre)?.rotulo.toLowerCase()}`}
                  {t.padrao && ' · horário fixo'}
                  {!t.ativo && ' · desativado'}
                </span>
              </div>
              {podeEditar && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => editar(t)} disabled={!!form}>Editar</Button>
                  {t.id && (
                    <Button variant="outline" size="sm" disabled={ativar.isPending || (t.ativo && ativos <= 1)}
                      onClick={() => ativar.mutate({ id: t.id!, ativo: !t.ativo })}>
                      {t.ativo ? 'Desativar' : 'Reativar'}
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {form && (
        <form onSubmit={enviar} className="flex flex-col gap-3 border-b border-trilha bg-campo px-5 py-4">
          <span className="text-apoio font-semibold text-grafite">{form.id ? `Editar ${form.nome || 'turno'}` : 'Novo turno'}</span>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="turno-nome">Nome</Label>
              <Input id="turno-nome" value={form.nome} maxLength={40} placeholder="Ex.: Diurno, Diarista, Sobreaviso"
                onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="turno-inicio">Início</Label>
              <Input id="turno-inicio" type="time" value={form.inicio} disabled={form.padrao}
                onChange={(e) => setForm({ ...form, inicio: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="turno-fim">Fim</Label>
              <Input id="turno-fim" type="time" value={form.fim} disabled={form.padrao}
                onChange={(e) => setForm({ ...form, fim: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="turno-cobre">Quem cobre</Label>
              <CampoSelecao id="turno-cobre" value={form.cobre} onChange={(e) => setForm({ ...form, cobre: e.target.value as CobreTurno })}>
                {COBRE_TURNO.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
              </CampoSelecao>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-apoio font-medium">
            <input type="checkbox" className="size-4 accent-primary" checked={form.sobreaviso}
              onChange={(e) => setForm({ ...form, sobreaviso: e.target.checked })} />
            Sobreaviso (a pessoa fica de prontidão, chamada quando precisa)
          </label>
          <span className="text-apoio text-tinta-sussurro tabular">
            {form.padrao
              ? 'O horário da manhã, da tarde e da noite não muda. Para outro horário, cadastre um turno novo.'
              : /^\d{2}:\d{2}/.test(form.inicio) && /^\d{2}:\d{2}/.test(form.fim)
                ? `Duração: ${rotuloHoras(minutosDoTurno(form.inicio, form.fim))}${form.fim <= form.inicio ? ', termina no dia seguinte' : ''}.`
                : 'Informe o início e o fim.'}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? <Spinner /> : null} Salvar</Button>
            <Button type="button" variant="ghost" onClick={() => { setForm(null); setErro(null) }}>Cancelar</Button>
          </div>
        </form>
      )}

      {(erro || salvar.error || ativar.error) && (
        <div className="px-5 py-3"><MensagemErro texto={erro} erro={erro ? undefined : (salvar.error ?? ativar.error)} acao="salvar o turno" /></div>
      )}

      <div className="bg-campo px-5 py-3 text-apoio text-pretty text-tinta-sussurro">
        Turno novo entra na escala fixa, na escala do mês, nas vagas, na candidatura e no check-in (pelo horário dele).
        Os avisos de começo de turno, a remuneração por turno e o filtro de turno dos indicadores continuam com manhã, tarde e noite.
        O horário de um turno só muda enquanto não houver plantão dele marcado daqui para a frente.
      </div>
    </section>
  )
}
