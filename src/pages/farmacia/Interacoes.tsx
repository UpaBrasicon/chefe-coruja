import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pill, Plus } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { lerPrincipios, type GrupoInteracao, type ListaInteracoes, type ParInteracao } from '@/lib/interacoes'
import { supabase } from '@/lib/supabase'

// Interações críticas da unidade (Fase 2, tarefa 3; migration 20261031000005).
// Decisão do RT (09/10/2026), opção C: lista curada pela farmácia, a partir
// da lista ONC (Phansalkar 2012) e das bulas ANVISA; base comercial depois.
// Os 15 pares ONC chegam como PROPOSTA: só alertam depois de a farmácia
// preencher os grupos de classe e ativar. A prescrição trava o item com
// interação ativa até o médico justificar.

const SITUACAO: Record<ParInteracao['situacao'], { rotulo: string; variante: 'success' | 'outline' | 'warning' }> = {
  ativa: { rotulo: 'ativa — alerta na prescrição', variante: 'success' },
  proposta: { rotulo: 'proposta — não alerta', variante: 'warning' },
  inativa: { rotulo: 'inativa', variante: 'outline' },
}

export default function Interacoes() {
  const unidadeId = useUnidade().unidadeAtiva?.unidade_id
  const lista = useQuery({
    queryKey: ['lista-interacoes', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('lista_interacoes', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as ListaInteracoes
    },
  })
  const l = lista.data

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina icone={Pill} titulo="Interações críticas"
        descricao="Pares de grupos de fármacos que travam a prescrição até o médico justificar. A lista é da unidade e quem cuida dela é a farmácia." />
      <p className="text-rotulo text-tinta-sussurro">
        Base: lista ONC de alta prioridade (Phansalkar S. et al. J Am Med Inform Assoc 2012;19(5):735-43), resumida com as nossas palavras, e
        bulas ANVISA. O par “prolongam o QT” é montado pela farmácia a partir das bulas. A base comercial licenciada fica para depois.
      </p>
      {lista.isLoading ? <Spinner /> : lista.error ? (
        <p role="alert" className="text-apoio text-critico">{(lista.error as Error).message}</p>
      ) : l && unidadeId && (
        <>
          <section className="flex flex-col gap-2">
            <TituloSecao>Pares</TituloSecao>
            {l.pares.length === 0 && <Vazio icone={Pill} titulo="Nenhum par cadastrado" />}
            {l.pares.map((p) => <LinhaPar key={p.id} p={p} grupos={l.grupos} unidadeId={unidadeId} podeEditar={l.pode_editar} />)}
            {l.pode_editar && <NovoPar grupos={l.grupos} unidadeId={unidadeId} />}
          </section>
          <section className="flex flex-col gap-2">
            <TituloSecao>Grupos de fármacos</TituloSecao>
            <span className="text-rotulo text-tinta-sussurro">Princípios ativos como no cadastro (sem acento não importa). Um medicamento entra no grupo quando o nome do princípio ativo contém o termo inteiro.</span>
            {l.grupos.map((g) => <LinhaGrupo key={g.id} g={g} unidadeId={unidadeId} podeEditar={l.pode_editar} />)}
            {l.pode_editar && <LinhaGrupo g={null} unidadeId={unidadeId} podeEditar />}
          </section>
        </>
      )}
    </div>
  )
}

function useRecarregar(unidadeId: string) {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['lista-interacoes', unidadeId] })
}

function LinhaGrupo({ g, unidadeId, podeEditar }: { g: GrupoInteracao | null; unidadeId: string; podeEditar: boolean }) {
  const recarregar = useRecarregar(unidadeId)
  const [editando, setEditando] = React.useState(false)
  const [nome, setNome] = React.useState(g?.nome ?? '')
  const [membros, setMembros] = React.useState((g?.membros ?? []).join(', '))
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('salvar_grupo_interacao', { p_unidade: unidadeId, p_nome: nome.trim(), p_principios: lerPrincipios(membros) })
      if (error) throw error
    },
    onSuccess: () => { setEditando(false); if (!g) { setNome(''); setMembros('') } recarregar() },
  })

  if (!editando) {
    return g ? (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-fio bg-superficie px-3 py-2 text-apoio">
        <span className="font-medium text-tinta">{g.nome}</span>
        <span className={g.membros.length ? 'text-tinta-apoio' : 'text-atencao'}>{g.membros.length ? g.membros.join(', ') : 'sem fármaco: a farmácia preenche'}</span>
        <span className="text-xs text-tinta-sussurro">{g.no_cadastro} no cadastro</span>
        {podeEditar && <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setEditando(true)}>Editar</Button>}
      </div>
    ) : (
      <div><Button size="sm" variant="outline" onClick={() => setEditando(true)}><Plus /> Novo grupo</Button></div>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-acao/30 bg-acao/[0.04] p-3">
      <Input placeholder="Nome do grupo" value={nome} disabled={!!g} onChange={(e) => setNome(e.target.value)} />
      <Textarea rows={2} placeholder="Princípios ativos, separados por vírgula (ex.: fluoxetina, sertralina)" value={membros} onChange={(e) => setMembros(e.target.value)} />
      {salvar.error && <span role="alert" className="text-xs text-critico">{(salvar.error as Error).message}</span>}
      <div className="flex gap-2">
        <Button size="sm" disabled={nome.trim().length < 3 || salvar.isPending} onClick={() => salvar.mutate()}>Salvar grupo</Button>
        <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>Voltar</Button>
      </div>
    </div>
  )
}

function LinhaPar({ p, grupos, unidadeId, podeEditar }: { p: ParInteracao; grupos: GrupoInteracao[]; unidadeId: string; podeEditar: boolean }) {
  const [editando, setEditando] = React.useState(false)
  const st = SITUACAO[p.situacao]
  if (editando) return <FormPar inicial={p} grupos={grupos} unidadeId={unidadeId} aoFechar={() => setEditando(false)} />
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-fio bg-superficie px-3 py-2 text-apoio">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-tinta">{p.grupo_a} × {p.grupo_b}</span>
        <Badge variant={p.gravidade === 'contraindicada' ? 'destructive' : 'warning'}>{p.gravidade}</Badge>
        <Badge variant={st.variante}>{st.rotulo}</Badge>
        {podeEditar && <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setEditando(true)}>Editar</Button>}
      </div>
      <span className="text-tinta">{p.efeito}{p.conduta ? ` Conduta: ${p.conduta}` : ''}</span>
      <span className="text-xs text-tinta-sussurro">
        Fonte: {p.fonte}{p.atualizado_por ? ` · ${p.atualizado_por}, ${fmtDataHora(p.atualizado_em)}` : ''}{p.motivo ? ` — “${p.motivo}”` : ''}
      </span>
    </div>
  )
}

function NovoPar({ grupos, unidadeId }: { grupos: GrupoInteracao[]; unidadeId: string }) {
  const [aberto, setAberto] = React.useState(false)
  if (!aberto) return <div><Button size="sm" variant="outline" onClick={() => setAberto(true)}><Plus /> Novo par</Button></div>
  return <FormPar inicial={null} grupos={grupos} unidadeId={unidadeId} aoFechar={() => setAberto(false)} />
}

function FormPar({ inicial, grupos, unidadeId, aoFechar }: { inicial: ParInteracao | null; grupos: GrupoInteracao[]; unidadeId: string; aoFechar: () => void }) {
  const recarregar = useRecarregar(unidadeId)
  const [f, setF] = React.useState({
    grupo_a: inicial?.grupo_a_id ?? '', grupo_b: inicial?.grupo_b_id ?? '', gravidade: inicial?.gravidade ?? 'contraindicada',
    efeito: inicial?.efeito ?? '', conduta: inicial?.conduta ?? '', fonte: inicial?.fonte ?? 'Bula ANVISA de ', situacao: inicial?.situacao ?? 'proposta',
  })
  const [motivo, setMotivo] = React.useState('')
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('salvar_interacao', {
        p_unidade: unidadeId, p_id: inicial?.id ?? null, p_grupo_a: f.grupo_a, p_grupo_b: f.grupo_b, p_gravidade: f.gravidade,
        p_efeito: f.efeito.trim(), p_conduta: f.conduta.trim(), p_fonte: f.fonte.trim(), p_situacao: f.situacao, p_motivo: motivo.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => { recarregar(); aoFechar() },
  })
  const seletor = (id: string, valor: string, set: (v: string) => void) => (
    <select id={id} className="h-9 rounded-controle border border-fio bg-campo px-2 text-controle" value={valor} onChange={(e) => set(e.target.value)}>
      <option value="">Escolha o grupo…</option>
      {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
    </select>
  )
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-acao/30 bg-acao/[0.04] p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1"><Label htmlFor="par-a">Grupo A</Label>{seletor('par-a', f.grupo_a, (v) => setF({ ...f, grupo_a: v }))}</div>
        <div className="flex flex-col gap-1"><Label htmlFor="par-b">Grupo B</Label>{seletor('par-b', f.grupo_b, (v) => setF({ ...f, grupo_b: v }))}</div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {(['contraindicada', 'grave'] as const).map((g) => (
          <label key={g} className="flex items-center gap-1.5"><input type="radio" checked={f.gravidade === g} onChange={() => setF({ ...f, gravidade: g })} /> {g}</label>
        ))}
        <span className="mx-1 h-5 w-px bg-fio" aria-hidden />
        {(['proposta', 'ativa', 'inativa'] as const).map((s) => (
          <label key={s} className="flex items-center gap-1.5"><input type="radio" checked={f.situacao === s} onChange={() => setF({ ...f, situacao: s })} /> {s}</label>
        ))}
      </div>
      <Input placeholder="Efeito (o que pode acontecer)" value={f.efeito} onChange={(e) => setF({ ...f, efeito: e.target.value })} />
      <Input placeholder="Conduta (opcional)" value={f.conduta} onChange={(e) => setF({ ...f, conduta: e.target.value })} />
      <Input placeholder="Fonte (bula ANVISA, lista ONC…)" value={f.fonte} onChange={(e) => setF({ ...f, fonte: e.target.value })} />
      <Input placeholder="Motivo da mudança (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      {salvar.error && <span role="alert" className="text-xs text-critico">{(salvar.error as Error).message}</span>}
      <div className="flex gap-2">
        <Button size="sm" disabled={!f.grupo_a || !f.grupo_b || f.efeito.trim().length < 5 || f.fonte.trim().length < 5 || motivo.trim().length < 5 || salvar.isPending}
          onClick={() => salvar.mutate()}>Salvar</Button>
        <Button size="sm" variant="ghost" onClick={aoFechar}>Voltar</Button>
      </div>
    </div>
  )
}
