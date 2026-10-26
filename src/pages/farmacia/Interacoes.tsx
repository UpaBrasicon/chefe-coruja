import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pill, Plus } from 'lucide-react'
import * as React from 'react'

import { TituloPagina } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { frase, lerPrincipios, type GrupoInteracao, type ListaInteracoes, type ParInteracao } from '@/lib/interacoes'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Estado } from '@/components/porta/Estado'
import { tomDaVariante } from '@/components/porta/tomEstado'

// Interações críticas da unidade (Fase 2, tarefa 3; migration 20261031000005).
// Decisão do RT (09/10/2026), opção C: lista curada pela farmácia, a partir
// da lista ONC (Phansalkar 2012) e das bulas ANVISA; base comercial depois.
// Os 15 pares ONC chegam como PROPOSTA: só alertam depois de a farmácia
// preencher os grupos de classe e ativar. A prescrição trava o item com
// interação ativa até o médico justificar.
// Revisão visual 3.7b (26/10/2026, opção B do RT): abas por situação e grupos,
// tabela e ficha, como a Disponibilidade.

type Situacao = ParInteracao['situacao']
type Aba = Situacao | 'grupos'

const SITUACAO: Record<Situacao, { rotulo: string; variante: 'success' | 'outline' | 'warning' }> = {
  ativa: { rotulo: 'ativa — alerta na prescrição', variante: 'success' },
  proposta: { rotulo: 'proposta — não alerta', variante: 'warning' },
  inativa: { rotulo: 'inativa', variante: 'outline' },
}
const DICA: Record<Aba, string> = {
  ativa: 'Travam a prescrição até o médico justificar',
  proposta: 'Ainda não alertam: preencha os grupos e ative',
  inativa: 'Não alertam',
  grupos: 'Um medicamento entra no grupo quando o princípio ativo contém o termo inteiro',
}

/** Grupos do par ainda sem fármaco: o par não alerta enquanto houver um. */
function semFarmaco(p: ParInteracao, grupos: GrupoInteracao[]): GrupoInteracao[] {
  const ids = p.grupo_a_id === p.grupo_b_id ? [p.grupo_a_id] : [p.grupo_a_id, p.grupo_b_id]
  return ids.map((id) => grupos.find((g) => g.id === id)).filter((g): g is GrupoInteracao => !!g && g.membros.length === 0)
}

export default function Interacoes() {
  const unidadeId = useUnidade().unidadeAtiva?.unidade_id
  const [aba, setAba] = React.useState<Aba>('ativa')
  const [escolhido, setEscolhido] = React.useState<string | null>(null)
  const [novo, setNovo] = React.useState(false)
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
  const ir = (a: Aba, id: string | null = null) => { setAba(a); setEscolhido(id); setNovo(false) }

  const pares = (l?.pares ?? []).filter((p) => p.situacao === aba)
  const conta = (s: Situacao) => (l?.pares ?? []).filter((p) => p.situacao === s).length
  const grupos = l?.grupos ?? []
  const selPar = aba !== 'grupos' && !novo ? pares.find((p) => p.id === escolhido) ?? pares[0] : undefined
  const selGrupo = aba === 'grupos' && !novo ? grupos.find((g) => g.id === escolhido) ?? grupos[0] : undefined

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina icone={Pill} titulo="Interações críticas"
        descricao="Pares de grupos de fármacos que travam a prescrição até o médico justificar. A lista é da unidade e quem cuida dela é a farmácia." />
      <div className="flex flex-col gap-3">
        <Tabs value={aba} onValueChange={(v) => ir(v as Aba)}>
          <TabsList aria-label="Interações" className="gap-5">
            <TabsTrigger value="ativa">Ativas <span className="text-rotulo font-semibold text-acao tabular-nums">{conta('ativa')}</span></TabsTrigger>
            <TabsTrigger value="proposta">Propostas <span className={cn('text-rotulo font-semibold tabular-nums', conta('proposta') ? 'text-atencao' : 'text-acao')}>{conta('proposta')}</span></TabsTrigger>
            <TabsTrigger value="inativa">Inativas <span className="text-rotulo font-semibold text-acao tabular-nums">{conta('inativa')}</span></TabsTrigger>
            <TabsTrigger value="grupos">Grupos <span className="text-rotulo font-semibold text-acao tabular-nums">{grupos.length}</span></TabsTrigger>
          </TabsList>
        </Tabs>
        <MensagemErro texto={lista.error ? (lista.error as Error).message : null} />
        {unidadeId && (
          <div className="grid overflow-hidden rounded-cartao border border-fio bg-superficie md:grid-cols-[minmax(0,1fr)_320px]">
            <section aria-label={aba === 'grupos' ? 'Grupos de fármacos' : 'Pares'} className="flex min-w-0 flex-col border-fio md:border-r">
              <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-2.5">
                <span className="text-apoio text-tinta-sussurro">{DICA[aba]}</span>
                {l?.pode_editar && (
                  <Button size="xs" variant="outline" className="ml-auto" onClick={() => { setNovo(true); setEscolhido(null) }}>
                    <Plus /> {aba === 'grupos' ? 'Novo grupo' : 'Novo par'}
                  </Button>
                )}
              </div>
              {lista.isLoading && <p className="px-4 py-4 text-apoio text-tinta-sussurro">Carregando…</p>}
              {l && aba !== 'grupos' && (pares.length === 0
                ? <p className="px-4 py-4 text-apoio text-tinta-sussurro">{aba === 'ativa' ? 'Nenhum par ativo: as propostas só alertam depois de ativadas.' : aba === 'proposta' ? 'Nenhuma proposta.' : 'Nenhum par inativo.'}</p>
                : (
                  <Table aria-label="Pares de interação">
                    <TableHeader><TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Par</TableHead><TableHead className="pr-4">Gravidade</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {pares.map((p) => {
                        const faltam = aba === 'proposta' ? semFarmaco(p, grupos) : []
                        return (
                          <TableRow key={p.id} aria-selected={p.id === selPar?.id} onClick={() => { setEscolhido(p.id); setNovo(false) }}
                            className={cn('cursor-pointer', p.id === selPar?.id && 'bg-alerta-marca hover:bg-alerta-marca')}>
                            <TableCell className="pl-4 whitespace-normal">
                              <BotaoLinha variante="linha" className="flex-col gap-0.5 border-0 p-0 hover:bg-transparent" onClick={() => { setEscolhido(p.id); setNovo(false) }}>
                                <span className="font-medium text-tinta">{p.grupo_a} <span className="text-tinta-sussurro">×</span> {p.grupo_b}</span>
                                {faltam.length > 0 && <span className="text-rotulo text-atencao">{faltam.map((g) => g.nome).join(' e ')} sem fármaco</span>}
                              </BotaoLinha>
                            </TableCell>
                            <TableCell className="pr-4"><Gravidade g={p.gravidade} /></TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                ))}
              {l && aba === 'grupos' && (
                <Table aria-label="Grupos de fármacos">
                  <TableHeader><TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Grupo</TableHead><TableHead className="pr-4 text-right">No cadastro</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {grupos.map((g) => (
                      <TableRow key={g.id} aria-selected={g.id === selGrupo?.id} onClick={() => { setEscolhido(g.id); setNovo(false) }}
                        className={cn('cursor-pointer', g.id === selGrupo?.id && 'bg-alerta-marca hover:bg-alerta-marca')}>
                        <TableCell className="pl-4 whitespace-normal">
                          <BotaoLinha variante="linha" className="flex-col gap-0.5 border-0 p-0 hover:bg-transparent" onClick={() => { setEscolhido(g.id); setNovo(false) }}>
                            <span className="font-medium text-tinta">{g.nome}</span>
                            <span className={cn('text-rotulo', g.membros.length ? 'text-tinta-sussurro' : 'text-atencao')}>{g.membros.length ? g.membros.join(', ') : 'sem fármaco: a farmácia preenche'}</span>
                          </BotaoLinha>
                        </TableCell>
                        <TableCell className="pr-4 text-right tabular-nums">{g.no_cadastro}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </section>
            <div className="order-first min-w-0 border-b border-fio md:order-none md:border-b-0">
              {l && novo && aba !== 'grupos' && <FormPar inicial={null} grupos={grupos} unidadeId={unidadeId} aoFechar={() => setNovo(false)} aoSalvar={(s) => ir(s)} />}
              {l && novo && aba === 'grupos' && <FormGrupo g={null} unidadeId={unidadeId} aoFechar={() => setNovo(false)} />}
              {l && selPar && <FichaPar key={selPar.id} p={selPar} grupos={grupos} unidadeId={unidadeId} podeEditar={l.pode_editar} irAoGrupo={(id) => ir('grupos', id)} aoSalvar={(s) => ir(s, selPar.id)} />}
              {l && selGrupo && <FichaGrupo key={selGrupo.id} g={selGrupo} pares={l.pares} unidadeId={unidadeId} podeEditar={l.pode_editar} irAoPar={(p) => ir(p.situacao, p.id)} />}
              {l && !novo && !selPar && !selGrupo && <p className="px-5 py-4 text-apoio text-tinta-sussurro">Escolha um item na lista.</p>}
            </div>
          </div>
        )}
        <p className="text-rotulo text-tinta-sussurro">
          Base: lista ONC de alta prioridade (Phansalkar S. et al. J Am Med Inform Assoc 2012;19(5):735-43), resumida com as nossas palavras, e
          bulas ANVISA. O par “prolongam o QT” é montado pela farmácia a partir das bulas. A base comercial licenciada fica para depois.
        </p>
      </div>
    </div>
  )
}

function Gravidade({ g }: { g: ParInteracao['gravidade'] }) {
  return <Badge variant={g === 'contraindicada' ? 'destructive' : 'warning'} className="tracking-normal normal-case">{g}</Badge>
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-trilha py-2 last:border-b-0">
      <dt className="text-rotulo text-tinta-sussurro">{rotulo}</dt>
      <dd className="text-apoio text-tinta">{children}</dd>
    </div>
  )
}

function useRecarregar(unidadeId: string) {
  const qc = useQueryClient()
  return () => void qc.invalidateQueries({ queryKey: ['lista-interacoes', unidadeId] })
}

function FichaPar({ p, grupos, unidadeId, podeEditar, irAoGrupo, aoSalvar }: {
  p: ParInteracao; grupos: GrupoInteracao[]; unidadeId: string; podeEditar: boolean
  irAoGrupo: (id: string) => void; aoSalvar: (s: Situacao) => void
}) {
  const [modo, setModo] = React.useState<'ver' | 'editar' | 'ativar'>('ver')
  if (modo !== 'ver') {
    return <FormPar inicial={p} situacao={modo === 'ativar' ? 'ativa' : undefined} grupos={grupos} unidadeId={unidadeId} aoFechar={() => setModo('ver')} aoSalvar={aoSalvar} />
  }
  const st = SITUACAO[p.situacao]
  const faltam = semFarmaco(p, grupos)
  const membros = (id: string) => {
    const g = grupos.find((x) => x.id === id)
    if (g?.membros.length) return g.membros.join(', ')
    return (
      <span className="flex flex-wrap items-center gap-x-2 text-atencao">sem fármaco
        {podeEditar && <Button size="xs" variant="ghost" onClick={() => irAoGrupo(id)}>Preencher o grupo</Button>}
      </span>
    )
  }
  return (
    <section aria-label={`Par ${p.grupo_a} e ${p.grupo_b}`} className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-corpo font-semibold text-tinta">{p.grupo_a} <span className="text-tinta-sussurro">×</span> {p.grupo_b}</h3>
        <div className="flex flex-wrap items-center gap-2"><Gravidade g={p.gravidade} /><Estado tom={tomDaVariante(st.variante)}>{st.rotulo}</Estado></div>
      </div>
      <dl className="flex flex-col">
        <Campo rotulo="Efeito">{frase(p.efeito)}</Campo>
        {p.conduta && <Campo rotulo="Conduta">{frase(p.conduta)}</Campo>}
        <Campo rotulo={p.grupo_a_id === p.grupo_b_id ? p.grupo_a : `Grupo A · ${p.grupo_a}`}>{membros(p.grupo_a_id)}</Campo>
        {p.grupo_a_id !== p.grupo_b_id && <Campo rotulo={`Grupo B · ${p.grupo_b}`}>{membros(p.grupo_b_id)}</Campo>}
        <Campo rotulo="Fonte">{p.fonte}</Campo>
        {p.atualizado_por && <Campo rotulo="Última mudança">{p.atualizado_por}, {fmtDataHora(p.atualizado_em)}{p.motivo ? ` — “${p.motivo}”` : ''}</Campo>}
      </dl>
      {podeEditar && (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            {p.situacao === 'proposta' && <Button size="sm" disabled={faltam.length > 0} onClick={() => setModo('ativar')}>Ativar</Button>}
            <Button size="sm" variant="outline" onClick={() => setModo('editar')}>Editar</Button>
          </div>
          {p.situacao === 'proposta' && (
            <span className="text-rotulo text-tinta-sussurro">
              {faltam.length > 0 ? 'Preencha os grupos sem fármaco antes de ativar: sem fármaco o par não alerta.' : 'Ativar pede o motivo da mudança e passa a travar a prescrição.'}
            </span>
          )}
        </div>
      )}
    </section>
  )
}

function FichaGrupo({ g, pares, unidadeId, podeEditar, irAoPar }: {
  g: GrupoInteracao; pares: ParInteracao[]; unidadeId: string; podeEditar: boolean; irAoPar: (p: ParInteracao) => void
}) {
  const [editando, setEditando] = React.useState(false)
  if (editando) return <FormGrupo g={g} unidadeId={unidadeId} aoFechar={() => setEditando(false)} />
  const usos = pares.filter((p) => p.grupo_a_id === g.id || p.grupo_b_id === g.id)
  return (
    <section aria-label={`Grupo ${g.nome}`} className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-corpo font-semibold text-tinta">{g.nome}</h3>
        <p className="text-apoio text-tinta-sussurro">{g.no_cadastro} no cadastro da unidade</p>
      </div>
      <dl className="flex flex-col">
        <Campo rotulo="Princípios ativos">{g.membros.length ? g.membros.join(', ') : <span className="text-atencao">sem fármaco: a farmácia preenche</span>}</Campo>
        <Campo rotulo="Nos pares">
          {usos.length === 0 ? 'Nenhum par usa este grupo.' : (
            <span className="flex flex-col items-start gap-1">
              {usos.map((p) => (
                <BotaoLinha key={p.id} variante="linha" className="border-0 p-0 text-left text-acao hover:bg-transparent hover:underline" onClick={() => irAoPar(p)}>
                  {p.grupo_a} × {p.grupo_b} <span className="text-tinta-sussurro">({p.situacao})</span>
                </BotaoLinha>
              ))}
            </span>
          )}
        </Campo>
      </dl>
      {podeEditar && <div><Button size="sm" variant="outline" onClick={() => setEditando(true)}>Editar princípios ativos</Button></div>}
    </section>
  )
}

function FormGrupo({ g, unidadeId, aoFechar }: { g: GrupoInteracao | null; unidadeId: string; aoFechar: () => void }) {
  const recarregar = useRecarregar(unidadeId)
  const [nome, setNome] = React.useState(g?.nome ?? '')
  const [membros, setMembros] = React.useState((g?.membros ?? []).join(', '))
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('salvar_grupo_interacao', { p_unidade: unidadeId, p_nome: nome.trim(), p_principios: lerPrincipios(membros) })
      if (error) throw error
    },
    onSuccess: () => { recarregar(); aoFechar() },
  })
  return (
    <section aria-label={g ? `Editar o grupo ${g.nome}` : 'Novo grupo'} className="flex flex-col gap-2 px-5 py-4">
      <h3 className="text-corpo font-semibold text-tinta">{g ? g.nome : 'Novo grupo'}</h3>
      {!g && <Input aria-label="Nome do grupo" placeholder="Nome do grupo" value={nome} onChange={(e) => setNome(e.target.value)} />}
      <Textarea aria-label="Princípios ativos" rows={3} placeholder="Princípios ativos, separados por vírgula (ex.: fluoxetina, sertralina)" value={membros} onChange={(e) => setMembros(e.target.value)} />
      <span className="text-rotulo text-tinta-sussurro">Princípios ativos como no cadastro (sem acento não importa).</span>
      <MensagemErro texto={salvar.error ? (salvar.error as Error).message : null} />
      <div className="flex gap-2">
        <Button size="sm" disabled={nome.trim().length < 3 || salvar.isPending} onClick={() => salvar.mutate()}>Salvar grupo</Button>
        <Button size="sm" variant="ghost" onClick={aoFechar}>Voltar</Button>
      </div>
    </section>
  )
}

function FormPar({ inicial, situacao, grupos, unidadeId, aoFechar, aoSalvar }: {
  inicial: ParInteracao | null; situacao?: Situacao; grupos: GrupoInteracao[]; unidadeId: string
  aoFechar: () => void; aoSalvar: (s: Situacao) => void
}) {
  const recarregar = useRecarregar(unidadeId)
  const [f, setF] = React.useState({
    grupo_a: inicial?.grupo_a_id ?? '', grupo_b: inicial?.grupo_b_id ?? '', gravidade: inicial?.gravidade ?? 'contraindicada',
    efeito: inicial?.efeito ?? '', conduta: inicial?.conduta ?? '', fonte: inicial?.fonte ?? 'Bula ANVISA de ', situacao: situacao ?? inicial?.situacao ?? 'proposta',
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
    onSuccess: () => { recarregar(); aoSalvar(f.situacao) },
  })
  const seletor = (id: string, valor: string, set: (v: string) => void) => (
    <CampoSelecao id={id} className="text-controle" value={valor} onChange={(e) => set(e.target.value)}>
      <option value="">Escolha o grupo…</option>
      {grupos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
    </CampoSelecao>
  )
  return (
    <section aria-label={inicial ? 'Editar o par' : 'Novo par'} className="flex flex-col gap-2 px-5 py-4">
      <h3 className="text-corpo font-semibold text-tinta">{!inicial ? 'Novo par' : situacao === 'ativa' ? 'Ativar o par' : 'Editar o par'}</h3>
      <div className="flex flex-col gap-1"><Label htmlFor="par-a">Grupo A</Label>{seletor('par-a', f.grupo_a, (v) => setF({ ...f, grupo_a: v }))}</div>
      <div className="flex flex-col gap-1"><Label htmlFor="par-b">Grupo B</Label>{seletor('par-b', f.grupo_b, (v) => setF({ ...f, grupo_b: v }))}</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-apoio">
        {(['contraindicada', 'grave'] as const).map((g) => (
          <label key={g} className="flex items-center gap-1.5"><input type="radio" checked={f.gravidade === g} onChange={() => setF({ ...f, gravidade: g })} /> {g}</label>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-apoio">
        {(['proposta', 'ativa', 'inativa'] as const).map((s) => (
          <label key={s} className="flex items-center gap-1.5"><input type="radio" checked={f.situacao === s} onChange={() => setF({ ...f, situacao: s })} /> {s}</label>
        ))}
      </div>
      <Input aria-label="Efeito" placeholder="Efeito (o que pode acontecer)" value={f.efeito} onChange={(e) => setF({ ...f, efeito: e.target.value })} />
      <Input aria-label="Conduta" placeholder="Conduta (opcional)" value={f.conduta} onChange={(e) => setF({ ...f, conduta: e.target.value })} />
      <Input aria-label="Fonte" placeholder="Fonte (bula ANVISA, lista ONC…)" value={f.fonte} onChange={(e) => setF({ ...f, fonte: e.target.value })} />
      <Input aria-label="Motivo da mudança" placeholder="Motivo da mudança (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <MensagemErro texto={salvar.error ? (salvar.error as Error).message : null} />
      <div className="flex gap-2">
        <Button size="sm" disabled={!f.grupo_a || !f.grupo_b || f.efeito.trim().length < 5 || f.fonte.trim().length < 5 || motivo.trim().length < 5 || salvar.isPending}
          onClick={() => salvar.mutate()}>Salvar</Button>
        <Button size="sm" variant="ghost" onClick={aoFechar}>Voltar</Button>
      </div>
    </section>
  )
}
