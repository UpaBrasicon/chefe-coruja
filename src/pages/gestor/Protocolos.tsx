// ─────────────────────────────────────────────────────────────────────────────
// Protocolos do gestor (protótipo "protocolos", P/index.html 8078–8160).
//
// Classificação de risco: o protocolo carregado no banco (com a fonte) e a
// revisão de cada fluxograma pela unidade — manter o original ou alterar a
// lista de discriminadores citando o documento da unidade. A cor continua do
// enfermeiro (ADR 0007); a triagem lê a lista que vale na unidade.
// Prescrição: os protocolos de receita da unidade, que o plantonista vê no
// Receituário e escolhe item a item. Publicar exige versão e fonte.
// Tudo pelo banco (migration 20261007000002).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ClipboardPlus, Plus, ShieldCheck, X } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { NIVEL_RISCO, type CorRisco } from '@/domain/risco'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Chip } from '@/components/documentos/ui'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const CORES: CorRisco[] = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul']
const ESTILO_COR: Record<CorRisco, string> = {
  vermelho: 'bg-mts-vermelho text-white', laranja: 'bg-mts-laranja text-white', amarelo: 'bg-mts-amarelo text-mts-amarelo-texto',
  verde: 'bg-mts-verde text-white', azul: 'bg-mts-azul text-white',
}
type Discriminadores = Partial<Record<CorRisco, [string, string][]>>
type Fluxo = {
  id: string; nome: string; publico: 'adulto' | 'pediatrico'; ordem: number; discriminadores: Discriminadores; original: Discriminadores
  estado: 'revisao' | 'mantido' | 'alterado'; fonte_alteracao: string | null; definido_por: string | null; definido_em: string | null
}
type ProtocoloCR = { protocolo: { id: string; codigo: string; fonte: string } | null; fluxogramas: Fluxo[] }

const msg = (e: unknown) => (e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Não foi possível salvar.')
const dataHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : ''

export default function Protocolos() {
  return (
    <div className="mx-auto w-full max-w-[896px]">
      <TituloPagina icone={ClipboardPlus} titulo="Protocolos"
        descricao="O que a instituição oferece com um clique. Publicar um protocolo aqui muda o que o plantonista vê no Receituário — ele escolhe item a item, e nunca recebe o pacote sem ver." />
      <div className="flex flex-col gap-[22px]">
        <Classificacao />
        <h2 className="mt-2 text-secao font-semibold tracking-[-0.01em] text-tinta">Protocolos de prescrição</h2>
        <Prescricao />
      </div>
    </div>
  )
}

// ── classificação de risco ──────────────────────────────────────────────────
function Classificacao() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const [filtro, setFiltro] = React.useState<'todos' | Fluxo['estado']>('todos')
  const [aberto, setAberto] = React.useState<string | null>(null)
  const dados = useQuery({
    queryKey: ['protocolo-classificacao-unidade', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('protocolo_classificacao_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as ProtocoloCR
    },
  })
  const fluxos = dados.data?.fluxogramas ?? []
  const n = (e: Fluxo['estado']) => fluxos.filter((f) => f.estado === e).length
  const lista = fluxos.filter((f) => filtro === 'todos' || f.estado === filtro)

  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      <div className="flex flex-col gap-1 border-b border-trilha px-5 py-4">
        <h2 className="text-corpo font-semibold text-tinta">Classificação de risco</h2>
        <span className="text-apoio text-pretty text-tinta-sussurro">
          {dados.data?.protocolo ? `${dados.data.protocolo.fonte}. ` : ''}O protocolo é apoio ao enfermeiro; a cor é sempre dele. A unidade mantém ou muda cada fluxograma, citando o documento dela.
        </span>
      </div>
      <div className="flex flex-col gap-1 border-b border-trilha px-5 py-3.5">
        <span className="text-apoio font-medium text-grafite">Idade da pediatria na triagem</span>
        <span className="text-apoio text-pretty text-tinta-sussurro">
          Pediatria na triagem: até 13 anos, 11 meses e 29 dias. Acima disso, a triagem abre nos fluxogramas de adulto; o enfermeiro pode trocar o grupo à mão, e a troca fica registrada. É a regra do produto para toda regra que depende de idade, e não muda por unidade.
        </span>
      </div>
      {dados.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
      {dados.error && <p className="px-5 py-3 text-apoio text-critico">{msg(dados.error)}</p>}
      {!dados.isLoading && !dados.data?.protocolo && (
        <p className="px-5 py-4 text-apoio text-tinta-sussurro">A unidade ainda não tem protocolo de classificação carregado. A carga é feita pela administração da rede, com a fonte do documento.</p>
      )}
      {dados.data?.protocolo && (
        <div className="cc-lista">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trilha bg-campo px-5 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-apoio font-semibold text-tinta">Revisão dos fluxogramas</span>
              <span className="text-apoio text-tinta-sussurro">
                {n('revisao')} em revisão · {n('mantido')} {n('mantido') === 1 ? 'mantido' : 'mantidos'} · {n('alterado')} {n('alterado') === 1 ? 'alterado' : 'alterados'}, de {fluxos.length} fluxogramas. Transcritos do documento; o gestor mantém ou muda cada um.
              </span>
            </div>
            <div className="flex flex-wrap gap-[7px]">
              {([['todos', 'Todos'], ['revisao', 'Em revisão'], ['mantido', 'Mantidos'], ['alterado', 'Alterados']] as const).map(([k, r]) => (
                <Chip key={k} ativo={filtro === k} onClick={() => setFiltro(k)}>{r}</Chip>
              ))}
            </div>
          </div>
          {lista.map((f) => (
            <LinhaFluxo key={f.id} f={f} unidadeId={unidadeId!} aberto={aberto === f.id}
              onAbrir={() => setAberto(aberto === f.id ? null : f.id)}
              onMudou={() => { setAberto(null); void qc.invalidateQueries({ queryKey: ['protocolo-classificacao-unidade'] }) }} />
          ))}
        </div>
      )}
    </section>
  )
}

const ESTADO: Record<Fluxo['estado'], [string, string]> = {
  revisao: ['Em revisão', 'bg-alerta-atencao text-atencao'],
  mantido: ['Mantido', 'bg-conforme/[0.08] text-conforme'],
  alterado: ['Alterado', 'bg-mts-azul/[0.08] text-mts-azul'],
}

function LinhaFluxo({ f, unidadeId, aberto, onAbrir, onMudou }: {
  f: Fluxo; unidadeId: string; aberto: boolean; onAbrir: () => void; onMudou: () => void
}) {
  return (
    <div className="border-b border-trilha last:border-0">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
          <span className="text-corpo font-medium text-tinta">{f.nome}</span>
          <span className="text-apoio text-tinta-sussurro">
            {f.publico === 'pediatrico' ? 'Pediatria' : 'Adulto'}
            {f.definido_por && <span> · {f.definido_por} · {dataHora(f.definido_em)}</span>}
          </span>
        </div>
        <span className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap', ESTADO[f.estado][1])}>{ESTADO[f.estado][0]}</span>
        <Button size="sm" variant="outline" onClick={onAbrir}>{aberto ? 'Fechar' : 'Revisar'}</Button>
      </div>
      {aberto && <EditorFluxo f={f} unidadeId={unidadeId} onMudou={onMudou} />}
    </div>
  )
}

const copia = (d: Discriminadores): Discriminadores => JSON.parse(JSON.stringify(d ?? {}))

function EditorFluxo({ f, unidadeId, onMudou }: { f: Fluxo; unidadeId: string; onMudou: () => void }) {
  const [ed, setEd] = React.useState<Discriminadores>(() => copia(f.discriminadores))
  const [novo, setNovo] = React.useState<Partial<Record<CorRisco, string>>>({})
  const [fonte, setFonte] = React.useState(f.fonte_alteracao ?? '')
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const mudou = JSON.stringify(limpar(ed)) !== JSON.stringify(limpar(f.original))

  async function agir(acao: 'manter' | 'alterar' | 'reabrir') {
    setErro(null); setSalvando(true)
    const { error } = await supabase.rpc('revisar_fluxograma', {
      p_unidade: unidadeId, p_fluxograma: f.id, p_acao: acao,
      p_discriminadores: acao === 'alterar' ? limpar(ed) : undefined, p_fonte: acao === 'alterar' ? fonte : undefined,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    onMudou()
  }

  return (
    <div className="flex flex-col gap-4 border-t border-trilha bg-campo/50 px-5 py-4">
      {CORES.map((c) => {
        const itens = ed[c] ?? []
        return (
          <div key={c} className="flex flex-col gap-2">
            <span className={cn('inline-flex w-fit min-w-[86px] items-center justify-center rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold capitalize', ESTILO_COR[c])}>
              {c} · {NIVEL_RISCO[c]}
            </span>
            {itens.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input aria-label={`Discriminador ${c} ${i + 1}`} value={d[0]} title={d[1] || undefined}
                  onChange={(e) => setEd((E) => { const x = copia(E); x[c]![i][0] = e.target.value; return x })} />
                <button type="button" aria-label="Remover discriminador" onClick={() => setEd((E) => { const x = copia(E); x[c]!.splice(i, 1); return x })}
                  className="grid size-8 shrink-0 place-items-center rounded-controle text-tinta-sussurro hover:bg-critico/[0.08] hover:text-critico">
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input placeholder="Novo discriminador" value={novo[c] ?? ''} onChange={(e) => setNovo((N) => ({ ...N, [c]: e.target.value }))} />
              <Button size="sm" variant="outline" disabled={!(novo[c] ?? '').trim()} onClick={() => {
                const t = (novo[c] ?? '').trim()
                setEd((E) => { const x = copia(E); (x[c] = x[c] ?? []).push([t, '']); return x })
                setNovo((N) => ({ ...N, [c]: '' }))
              }}><Plus /> Adicionar</Button>
            </div>
          </div>
        )
      })}
      {mudou && (
        <label className="flex flex-col gap-[5px]">
          <span className="text-apoio font-medium text-grafite">Fonte da alteração</span>
          <Input value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Documento da unidade: nome, versão e data (ex.: POP 12, versão 3, 01/09/2026)" />
          <span className="text-rotulo text-tinta-sussurro">Sem a fonte, a alteração não é aceita: o sistema não inventa discriminador.</span>
        </label>
      )}
      {erro && <p className="text-apoio text-critico">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={salvando} onClick={() => void agir('manter')}><Check /> Manter o original</Button>
        <Button size="sm" disabled={salvando || !mudou || fonte.trim().length < 10} onClick={() => void agir('alterar')}>Salvar alterações</Button>
        <Button size="sm" variant="ghost" disabled={salvando} onClick={() => { setEd(copia(f.original)); setErro(null) }}>Desfazer edição</Button>
        {f.estado !== 'revisao' && (
          <Button size="sm" variant="ghost" disabled={salvando} onClick={() => void agir('reabrir')}>Voltar para em revisão (usa o original)</Button>
        )}
      </div>
      {f.estado === 'alterado' && f.fonte_alteracao && <span className="text-apoio text-tinta-sussurro">Fonte da alteração vigente: {f.fonte_alteracao}</span>}
    </div>
  )
}

function limpar(d: Discriminadores): Discriminadores {
  const out: Discriminadores = {}
  for (const c of CORES) {
    const l = (d?.[c] ?? []).map(([t, desc]) => [t.trim(), desc ?? ''] as [string, string]).filter(([t]) => t)
    if (l.length) out[c] = l
  }
  return out
}

// ── protocolos de prescrição ────────────────────────────────────────────────
type ItemReceita = { medicamento: string; posologia: string; quantidade: string }
type ProtocoloReceita = {
  id: string; nome: string; indicacao: string | null; versao: string | null; fonte: string | null; itens: ItemReceita[]
  ativo: boolean; atualizado_em: string; atualizado_por: string | null; versoes: number
}

function Prescricao() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const [editando, setEditando] = React.useState<string | 'novo' | null>(null)
  const lista = useQuery({
    queryKey: ['receita-protocolos', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('receita_protocolos_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as ProtocoloReceita[]
    },
  })
  const recarregar = () => { setEditando(null); void qc.invalidateQueries({ queryKey: ['receita-protocolos'] }) }

  return (
    <div className="flex flex-col gap-4">
      {lista.isLoading && <div className="flex justify-center py-6"><Spinner /></div>}
      {lista.error && <p className="text-apoio text-critico">{msg(lista.error)}</p>}
      {!lista.isLoading && (lista.data ?? []).length === 0 && editando !== 'novo' && (
        <p className="rounded-cartao border border-dashed border-fio px-5 py-4 text-apoio text-tinta-sussurro">
          Nenhum protocolo de prescrição. Nada vem pronto: protocolo genérico seria lido como o da unidade. Escreva o da instituição, com a fonte.
        </p>
      )}
      {(lista.data ?? []).map((p) => editando === p.id
        ? <EditorReceita key={p.id} unidadeId={unidadeId!} p={p} onFim={recarregar} onCancelar={() => setEditando(null)} />
        : (
          <section key={p.id} className="cc-lista overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-trilha px-5 py-3.5">
              <h3 className="text-corpo font-semibold text-tinta">{p.nome}</h3>
              {p.indicacao && <span className="text-apoio text-tinta-sussurro">{p.indicacao}</span>}
              <span className="ml-auto flex items-center gap-2 text-apoio text-tinta-sussurro">
                {p.versao && <span>versão {p.versao}</span>}
                <span className={cn('rounded-capsula px-2 py-[2px] text-rotulo font-semibold uppercase', p.ativo ? 'bg-alerta-marca text-acao' : 'bg-trilha text-tinta-sussurro')}>
                  {p.ativo ? 'Publicado' : 'Rascunho'}
                </span>
              </span>
            </div>
            {p.itens.map((it, i) => (
              <div key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-trilha px-5 py-2.5">
                <span className="text-corpo font-medium text-tinta">{it.medicamento}</span>
                <span className="text-apoio text-tinta-apoio">{it.posologia}</span>
                {it.quantidade && <span className="text-apoio text-tinta-sussurro">· {it.quantidade}</span>}
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-campo px-5 py-3">
              <span className="text-apoio text-pretty text-tinta-sussurro">
                {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}
                {p.fonte ? ` · Fonte: ${p.fonte}` : ' · sem fonte (não publicado)'}
                {p.atualizado_por ? ` · ${p.atualizado_por}, ${dataHora(p.atualizado_em)}` : ''}
                {p.versoes > 1 ? ` · ${p.versoes} gravações guardadas` : ''}
              </span>
              <Button size="sm" variant="outline" onClick={() => setEditando(p.id)}>Editar itens</Button>
            </div>
          </section>
        ))}
      {editando === 'novo'
        ? <EditorReceita unidadeId={unidadeId!} onFim={recarregar} onCancelar={() => setEditando(null)} />
        : <div><Button variant="outline" onClick={() => setEditando('novo')}><Plus /> Novo protocolo</Button></div>}
    </div>
  )
}

function EditorReceita({ unidadeId, p, onFim, onCancelar }: {
  unidadeId: string; p?: ProtocoloReceita; onFim: () => void; onCancelar: () => void
}) {
  const [nome, setNome] = React.useState(p?.nome ?? '')
  const [indicacao, setIndicacao] = React.useState(p?.indicacao ?? '')
  const [versao, setVersao] = React.useState('')
  const [fonte, setFonte] = React.useState(p?.fonte ?? '')
  const [itens, setItens] = React.useState<ItemReceita[]>(p?.itens.length ? p.itens.map((i) => ({ ...i })) : [{ medicamento: '', posologia: '', quantidade: '' }])
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const muda = (i: number, k: keyof ItemReceita, v: string) => setItens((L) => L.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  async function gravar(publicar: boolean) {
    setErro(null); setSalvando(true)
    const { error } = await supabase.rpc('salvar_receita_protocolo', {
      p_unidade: unidadeId, p_nome: nome, p_indicacao: indicacao,
      p_itens: itens.filter((i) => i.medicamento.trim() || i.posologia.trim()), p_protocolo: p?.id, p_ativo: publicar,
      p_versao: versao.trim() || p?.versao || undefined, p_fonte: fonte.trim() || undefined,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    onFim()
  }

  return (
    <section className="flex flex-col gap-4 rounded-cartao border border-marca/40 bg-superficie px-5 py-4 shadow-repouso">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-[1_1_240px] flex-col gap-[5px]"><span className="text-apoio font-medium text-grafite">Nome</span>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Pneumonia comunitária" /></label>
        <label className="flex flex-[1_1_240px] flex-col gap-[5px]"><span className="text-apoio font-medium text-grafite">Indicação</span>
          <Input value={indicacao} onChange={(e) => setIndicacao(e.target.value)} placeholder="Quando o protocolo se aplica" /></label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-apoio font-medium text-grafite">Itens</span>
        {itens.map((it, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input aria-label="Medicamento" className="flex-[1_1_200px]" value={it.medicamento} onChange={(e) => muda(i, 'medicamento', e.target.value)} placeholder="Medicamento e apresentação" />
            <Input aria-label="Posologia" className="flex-[2_1_260px]" value={it.posologia} onChange={(e) => muda(i, 'posologia', e.target.value)} placeholder="Posologia" />
            <Input aria-label="Quantidade" className="flex-[0_1_140px]" value={it.quantidade} onChange={(e) => muda(i, 'quantidade', e.target.value)} placeholder="Quantidade" />
            <button type="button" aria-label="Remover item" onClick={() => setItens((L) => L.filter((_, j) => j !== i))}
              className="grid size-8 place-items-center rounded-controle text-tinta-sussurro hover:bg-critico/[0.08] hover:text-critico"><X className="size-4" /></button>
          </div>
        ))}
        <div><Button size="sm" variant="outline" onClick={() => setItens((L) => [...L, { medicamento: '', posologia: '', quantidade: '' }])}><Plus /> Item</Button></div>
      </div>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-[0_1_180px] flex-col gap-[5px]"><span className="text-apoio font-medium text-grafite">Nova versão</span>
          <Input value={versao} onChange={(e) => setVersao(e.target.value)} placeholder={p?.versao ? `atual: ${p.versao}` : 'Ex.: 2026.1'} /></label>
        <label className="flex flex-[1_1_320px] flex-col gap-[5px]"><span className="text-apoio font-medium text-grafite">Fonte</span>
          <Input value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Protocolo ou diretriz da unidade, com versão e data" /></label>
      </div>
      <span className="text-rotulo text-pretty text-tinta-sussurro">Publicar exige versão e fonte. Cada gravação fica guardada; a anterior não se apaga. O rascunho não aparece para o plantonista.</span>
      {erro && <p className="text-apoio text-critico">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={salvando} onClick={() => void gravar(true)}><ShieldCheck /> Publicar nova versão</Button>
        <Button variant="outline" disabled={salvando} onClick={() => void gravar(false)}>Salvar como rascunho</Button>
        <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
      </div>
    </section>
  )
}
