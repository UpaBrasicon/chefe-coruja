import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, Plus } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Campo, Pilulas, Texto } from '@/components/documentos/ui'

import {
  CATEGORIA, haQuanto, selo, SEVERIDADE, SITUACAO, useChamadosTecnicos, useUnidadesRede,
  type Categoria, type ChamadoTecnico, type Severidade, type Situacao,
} from './dadosAdmin'
import { Abas, cartao } from './ui'

// Pendências técnicas (P/index.html 10029–10068). No protótipo eram sete
// chamados fixos; aqui são os chamados técnicos da organização, abertos e
// acompanhados pelo administrador (chamados_tecnicos, com andamento só de
// inserção). "Abrir chamado" em cada linha abre o chamado: andamento e a troca
// de situação, responsável e nota.

type Filtro = 'todos' | Categoria
const CATEGORIAS = Object.keys(CATEGORIA) as Categoria[]
const SEVERIDADES = Object.keys(SEVERIDADE) as Severidade[]
const SITUACOES = Object.keys(SITUACAO) as Situacao[]

const SELO_SEVERIDADE: Record<Severidade, string> = {
  alta: 'text-critico bg-critico/10',
  media: 'text-atencao bg-atencao/10',
  baixa: 'text-tinta-apoio bg-trilha',
}
const MARCA_SEVERIDADE: Record<Severidade, string> = { alta: 'bg-critico', media: 'bg-atencao', baixa: 'bg-fio-forte' }
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function PendenciasTecnicas() {
  const [params, setParams] = useSearchParams()
  const [filtro, setFiltro] = React.useState<Filtro>('todos')
  const [resolvidos, setResolvidos] = React.useState(false)
  const [aberto, setAberto] = React.useState<ChamadoTecnico | null>(null)
  const chamados = useChamadosTecnicos(resolvidos)
  const lista = chamados.data ?? []
  const visiveis = lista.filter((c) => filtro === 'todos' || c.categoria === filtro)
  const abertos = lista.filter((c) => c.situacao !== 'resolvido')
  const altas = abertos.filter((c) => c.severidade === 'alta').length

  // "Abrir chamado" das Plataformas chega com ?novo=<unidade>&titulo=…
  const novo = params.get('novo')
  const [criando, setCriando] = React.useState(novo !== null)
  const fecharNovo = () => {
    setCriando(false)
    if (novo !== null) setParams((p) => { const n = new URLSearchParams(p); n.delete('novo'); n.delete('titulo'); return n }, { replace: true })
  }

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={ClipboardList}
        titulo="Pendências técnicas"
        descricao={chamados.data
          ? `${abertos.length} ${abertos.length === 1 ? 'chamado aberto' : 'chamados abertos'} na rede · ${altas} de severidade alta`
          : 'Chamados técnicos da rede'}
        acoes={<Button onClick={() => setCriando(true)}><Plus /> Novo chamado</Button>}
      />

      <div className={cartao}>
        <div className="flex flex-wrap items-end justify-between">
          <Abas
            rotulo="Categoria"
            valor={filtro}
            onChange={setFiltro}
            opcoes={[{ valor: 'todos' as Filtro, rotulo: 'Todos' }, ...CATEGORIAS.map((c) => ({ valor: c as Filtro, rotulo: CATEGORIA[c] }))]}
          />
          <label className="ml-auto flex items-center gap-2 px-5 py-[11px] text-apoio text-tinta-apoio">
            <input type="checkbox" checked={resolvidos} onChange={(e) => setResolvidos(e.target.checked)} className="size-4 accent-[var(--color-acao)]" />
            Mostrar resolvidos
          </label>
        </div>
        {chamados.isLoading && <div className="px-5 py-5"><Spinner /></div>}
        {chamados.error && <p className="px-5 py-4 text-apoio text-critico">{(chamados.error as Error).message}</p>}
        {visiveis.map((c) => (
          <div key={c.id} className={cn('flex items-stretch gap-[13px] border-b border-trilha px-5 py-3.5 last:border-0 hover:bg-campo', c.situacao === 'resolvido' && 'opacity-70')}>
            <span className={cn('w-[3px] shrink-0 self-stretch rounded-capsula', MARCA_SEVERIDADE[c.severidade])} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-[9px]">
                <span className="text-corpo font-medium text-tinta">{c.titulo}</span>
                <span className={cn(selo, SELO_SEVERIDADE[c.severidade])}>{SEVERIDADE[c.severidade]}</span>
              </div>
              <span className="text-apoio text-tinta-sussurro">{CATEGORIA[c.categoria]} · {c.unidade_nome ?? 'Rede toda'}</span>
              <div className="flex flex-wrap items-center gap-3.5 text-apoio text-tinta-sussurro">
                <span>{c.situacao === 'resolvido' && c.resolvido_em ? `resolvido ${haQuanto(c.resolvido_em)}` : `aberto ${haQuanto(c.aberto_em)}`}</span>
                <span>{c.responsavel ?? 'sem responsável'}</span>
                <span>{SITUACAO[c.situacao]}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAberto(c)}
              className="self-center rounded-[9px] border border-fio bg-superficie px-3 py-1.5 text-apoio whitespace-nowrap text-tinta-apoio hover:border-marca hover:text-acao"
            >
              Abrir chamado
            </button>
          </div>
        ))}
        {chamados.data && visiveis.length === 0 && (
          <p className="px-5 py-[34px] text-center text-corpo text-tinta-sussurro">
            {lista.length === 0 ? 'Nenhum chamado técnico aberto na rede.' : 'Nenhum chamado nessa categoria.'}
          </p>
        )}
      </div>

      <NovoChamado aberta={criando} onFechar={fecharNovo} unidadeInicial={novo} tituloInicial={params.get('titulo') ?? ''} />
      {aberto && <DetalheChamado chamado={aberto} onFechar={() => setAberto(null)} />}
    </div>
  )
}

// ── novo chamado ─────────────────────────────────────────────────────────────

function NovoChamado({ aberta, onFechar, unidadeInicial, tituloInicial }: {
  aberta: boolean; onFechar: () => void; unidadeInicial: string | null; tituloInicial: string
}) {
  const queryClient = useQueryClient()
  const unidades = useUnidadesRede()
  const [unidade, setUnidade] = React.useState<string>(unidadeInicial || 'rede')
  const [titulo, setTitulo] = React.useState(tituloInicial)
  const [categoria, setCategoria] = React.useState<Categoria | ''>('')
  const [severidade, setSeveridade] = React.useState<Severidade | ''>('')
  const [responsavel, setResponsavel] = React.useState('')
  const [descricao, setDescricao] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)

  const abrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('abrir_chamado_tecnico', {
        p_unidade: (unidade === 'rede' ? null : unidade) as string, // nulo = chamado da rede (a função SQL aceita)
        p_titulo: titulo.trim(),
        p_categoria: categoria,
        p_severidade: severidade,
        p_descricao: descricao.trim() || undefined,
        p_responsavel: responsavel.trim() || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chamados-tecnicos'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-unidades'] })
      setTitulo(''); setCategoria(''); setSeveridade(''); setResponsavel(''); setDescricao(''); setErro(null)
      onFechar()
    },
    onError: (e: Error) => setErro(e.message),
  })

  function enviar() {
    if (titulo.trim().length < 5) return setErro('Descreva o chamado em pelo menos 5 letras.')
    if (!categoria) return setErro('Escolha a categoria.')
    if (!severidade) return setErro('Escolha a severidade.')
    setErro(null)
    abrir.mutate()
  }

  const opcoesUnidade = ['rede', ...(unidades.data ?? []).map((u) => u.unidade_id)]
  const rotulosUnidade = Object.fromEntries([['rede', 'Rede toda'], ...(unidades.data ?? []).map((u) => [u.unidade_id, u.nome])])

  return (
    <Gaveta aberta={aberta} onAbertaChange={(v) => { if (!v) onFechar() }} rotulo="Novo chamado técnico">
      <GavetaCabeca sobre="Pendências técnicas" titulo="Novo chamado" detalhe="Fica na lista da rede até ser resolvido, com o andamento registrado." />
      <div className="flex flex-col gap-4 px-[22px] py-5">
        <Campo rotulo="Unidade" largura="cheio">
          <Pilulas opcoes={opcoesUnidade} valor={unidade} onChange={setUnidade} rotulos={rotulosUnidade} rotuloAria="Unidade" />
        </Campo>
        <Texto id="ch-titulo" rotulo="O que está acontecendo" valor={titulo} onChange={setTitulo} dica="Ex.: impressora de receita sem resposta" largura="cheio" />
        <Campo rotulo="Categoria" largura="cheio">
          <Pilulas opcoes={CATEGORIAS} valor={categoria} onChange={setCategoria} rotulos={CATEGORIA} rotuloAria="Categoria" />
        </Campo>
        <Campo rotulo="Severidade" largura="cheio">
          <Pilulas opcoes={SEVERIDADES} valor={severidade} onChange={setSeveridade} rotulos={SEVERIDADE} rotuloAria="Severidade" />
        </Campo>
        <Texto id="ch-resp" rotulo="Responsável (opcional)" valor={responsavel} onChange={setResponsavel} dica="Ex.: Infraestrutura, Suporte N2" largura="cheio" />
        <Texto id="ch-desc" rotulo="Detalhes (opcional)" valor={descricao} onChange={setDescricao} longo linhas={4} />
      </div>
      <GavetaPe className="flex flex-wrap items-center gap-2.5">
        <span role={erro ? 'alert' : undefined} className="min-w-0 flex-[1_1_160px] text-apoio text-critico">{erro}</span>
        <Button variant="outline" onClick={onFechar}>Cancelar</Button>
        <Button onClick={enviar} disabled={abrir.isPending}>{abrir.isPending ? <Spinner className="size-4" /> : <Plus />} Abrir chamado</Button>
      </GavetaPe>
    </Gaveta>
  )
}

// ── detalhe do chamado ───────────────────────────────────────────────────────

function DetalheChamado({ chamado: c, onFechar }: { chamado: ChamadoTecnico; onFechar: () => void }) {
  const queryClient = useQueryClient()
  const [situacao, setSituacao] = React.useState<Situacao>(c.situacao)
  const [responsavel, setResponsavel] = React.useState(c.responsavel ?? '')
  const [nota, setNota] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)

  const andamento = useQuery({
    queryKey: ['chamado-andamento', c.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('andamento_chamado_tecnico', { p_id: c.id })
      if (error) throw error
      return data ?? []
    },
  })

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('atualizar_chamado_tecnico', {
        p_id: c.id,
        p_situacao: situacao,
        p_nota: nota.trim() || undefined,
        p_responsavel: responsavel.trim() || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chamados-tecnicos'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-unidades'] })
      onFechar()
    },
    onError: (e: Error) => setErro(e.message),
  })

  return (
    <Gaveta aberta onAbertaChange={(v) => { if (!v) onFechar() }} rotulo={`Chamado: ${c.titulo}`}>
      <GavetaCabeca
        sobre={`${CATEGORIA[c.categoria]} · ${c.unidade_nome ?? 'Rede toda'}`}
        titulo={c.titulo}
        detalhe={`Aberto em ${quando(c.aberto_em)}${c.aberto_por ? ` por ${c.aberto_por}` : ''} · severidade ${SEVERIDADE[c.severidade].toLowerCase()}`}
      />
      <div className="flex flex-col gap-4 px-[22px] py-5">
        <Campo rotulo="Situação" largura="cheio">
          <Pilulas opcoes={SITUACOES} valor={situacao} onChange={setSituacao} rotulos={SITUACAO} rotuloAria="Situação" />
        </Campo>
        <Texto id="ch-resp2" rotulo="Responsável" valor={responsavel} onChange={setResponsavel} largura="cheio" />
        <Texto id="ch-nota" rotulo={situacao === 'resolvido' ? 'O que foi feito' : 'Nota do andamento'} valor={nota} onChange={setNota} longo linhas={3}
          ajuda={situacao === 'resolvido' ? 'Obrigatório para resolver.' : undefined} />

        <div className="flex flex-col gap-2">
          <span className="rotulo text-tinta-sussurro">Andamento</span>
          {andamento.isLoading && <Spinner />}
          {andamento.data?.map((a) => (
            <div key={a.id} className="flex flex-col gap-0.5 border-l-2 border-fio pl-3">
              <span className="text-apoio font-medium text-tinta">{SITUACAO[a.situacao as Situacao] ?? a.situacao}</span>
              {a.nota && <span className="text-apoio text-pretty text-tinta-apoio">{a.nota}</span>}
              <span className="text-rotulo text-tinta-sussurro">{quando(a.em)}{a.autor ? ` · ${a.autor}` : ''}</span>
            </div>
          ))}
        </div>
      </div>
      <GavetaPe className="flex flex-wrap items-center gap-2.5">
        <span role={erro ? 'alert' : undefined} className="min-w-0 flex-[1_1_160px] text-apoio text-critico">{erro}</span>
        <Button variant="outline" onClick={onFechar}>Fechar</Button>
        <Button onClick={() => { setErro(null); salvar.mutate() }} disabled={salvar.isPending}>
          {salvar.isPending && <Spinner className="size-4" />} Salvar andamento
        </Button>
      </GavetaPe>
    </Gaveta>
  )
}
