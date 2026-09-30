import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LifeBuoy, Plus } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Campo, Pilulas, Texto } from '@/components/documentos/ui'
import {
  CATEGORIA, haQuanto, selo, SEVERIDADE, SITUACAO,
  type Categoria, type Severidade, type Situacao,
} from '@/pages/admin/dadosAdmin'
import { cartao } from '@/pages/admin/ui'
import type { Database } from '@/types/database'

// Chamados técnicos do gestor (decisão de 30/09/2026, migration
// 20261012000001). O gestor abre chamado DA SUA UNIDADE e acompanha: lê o
// andamento e escreve nota. Situação e responsável são do administrador, que
// vê o chamado na lista de Pendências técnicas da rede.

type Chamado = Database['public']['Functions']['chamados_tecnicos_da_unidade']['Returns'][number]

const CATEGORIAS = Object.keys(CATEGORIA) as Categoria[]
const SEVERIDADES = Object.keys(SEVERIDADE) as Severidade[]
const SELO_SEVERIDADE: Record<Severidade, string> = {
  alta: 'text-critico bg-critico/10',
  media: 'text-atencao bg-atencao/10',
  baixa: 'text-tinta-apoio bg-trilha',
}
const MARCA_SEVERIDADE: Record<Severidade, string> = { alta: 'bg-critico', media: 'bg-atencao', baixa: 'bg-fio-forte' }
const quando = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function ChamadosTecnicos() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [resolvidos, setResolvidos] = React.useState(false)
  const [criando, setCriando] = React.useState(false)
  const [aberto, setAberto] = React.useState<Chamado | null>(null)

  const chamados = useQuery({
    queryKey: ['chamados-unidade', unidadeId, resolvidos],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('chamados_tecnicos_da_unidade', { p_unidade: unidadeId!, p_incluir_resolvidos: resolvidos })
      if (error) throw error
      return data ?? []
    },
  })
  const lista = chamados.data ?? []
  const abertos = lista.filter((c) => c.situacao !== 'resolvido')

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={LifeBuoy}
        titulo="Chamados técnicos"
        descricao={chamados.data
          ? `${abertos.length} ${abertos.length === 1 ? 'chamado aberto' : 'chamados abertos'} nesta unidade · a administração da rede atende e dá a situação`
          : 'Problemas de sistema, equipamento ou integração da unidade'}
        acoes={<Button onClick={() => setCriando(true)}><Plus /> Novo chamado</Button>}
      />

      <div className={cartao}>
        <div className="flex justify-end border-b border-trilha">
          <label className="flex items-center gap-2 px-5 py-[11px] text-apoio text-tinta-apoio">
            <input type="checkbox" checked={resolvidos} onChange={(e) => setResolvidos(e.target.checked)} className="size-4 accent-[var(--color-acao)]" />
            Mostrar resolvidos
          </label>
        </div>
        {chamados.isLoading && <div className="px-5 py-5"><Spinner /></div>}
        {chamados.error && <p className="px-5 py-4 text-apoio text-critico">{(chamados.error as Error).message}</p>}
        {lista.map((c) => (
          <div key={c.id} className={cn('flex items-stretch gap-[13px] border-b border-trilha px-5 py-3.5 last:border-0 hover:bg-campo', c.situacao === 'resolvido' && 'opacity-70')}>
            <span className={cn('w-[3px] shrink-0 self-stretch rounded-capsula', MARCA_SEVERIDADE[c.severidade as Severidade])} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-[9px]">
                <span className="text-corpo font-medium text-tinta">{c.titulo}</span>
                <span className={cn(selo, SELO_SEVERIDADE[c.severidade as Severidade])}>{SEVERIDADE[c.severidade as Severidade]}</span>
              </div>
              <span className="text-apoio text-tinta-sussurro">
                {CATEGORIA[c.categoria as Categoria]} · aberto por {c.meu ? 'você' : c.aberto_por}
              </span>
              <div className="flex flex-wrap items-center gap-3.5 text-apoio text-tinta-sussurro">
                <span>{c.situacao === 'resolvido' && c.resolvido_em ? `resolvido ${haQuanto(c.resolvido_em)}` : `aberto ${haQuanto(c.aberto_em)}`}</span>
                <span>{c.responsavel ?? 'sem responsável'}</span>
                <span className={c.situacao === 'aguardando_unidade' ? 'font-medium text-atencao' : undefined}>{SITUACAO[c.situacao as Situacao]}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAberto(c)}
              className="self-center rounded-[9px] border border-fio bg-superficie px-3 py-1.5 text-apoio whitespace-nowrap text-tinta-apoio hover:border-marca hover:text-acao"
            >
              Acompanhar
            </button>
          </div>
        ))}
        {chamados.data && lista.length === 0 && (
          <p className="px-5 py-[34px] text-center text-corpo text-tinta-sussurro">
            {resolvidos ? 'Nenhum chamado técnico desta unidade.' : 'Nenhum chamado técnico aberto nesta unidade.'}
          </p>
        )}
      </div>

      {unidadeId && <NovoChamado aberta={criando} onFechar={() => setCriando(false)} unidadeId={unidadeId} />}
      {aberto && <DetalheChamado chamado={aberto} onFechar={() => setAberto(null)} />}
    </div>
  )
}

function NovoChamado({ aberta, onFechar, unidadeId }: { aberta: boolean; onFechar: () => void; unidadeId: string }) {
  const queryClient = useQueryClient()
  const [titulo, setTitulo] = React.useState('')
  const [categoria, setCategoria] = React.useState<Categoria | ''>('')
  const [severidade, setSeveridade] = React.useState<Severidade | ''>('')
  const [descricao, setDescricao] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)

  const abrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('abrir_chamado_tecnico', {
        p_unidade: unidadeId,
        p_titulo: titulo.trim(),
        p_categoria: categoria,
        p_severidade: severidade,
        p_descricao: descricao.trim() || undefined,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chamados-unidade', unidadeId] })
      setTitulo(''); setCategoria(''); setSeveridade(''); setDescricao(''); setErro(null)
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

  return (
    <Gaveta aberta={aberta} onAbertaChange={(v) => { if (!v) onFechar() }} rotulo="Novo chamado técnico">
      <GavetaCabeca sobre="Chamados técnicos" titulo="Novo chamado" detalhe="Vai para a administração da rede, que atende e registra o andamento aqui." />
      <div className="flex flex-col gap-4 px-[22px] py-5">
        <Texto id="chg-titulo" rotulo="O que está acontecendo" valor={titulo} onChange={setTitulo} dica="Ex.: impressora de receita sem resposta" largura="cheio" />
        <Campo rotulo="Categoria" largura="cheio">
          <Pilulas opcoes={CATEGORIAS} valor={categoria} onChange={setCategoria} rotulos={CATEGORIA} rotuloAria="Categoria" />
        </Campo>
        <Campo rotulo="Severidade" largura="cheio">
          <Pilulas opcoes={SEVERIDADES} valor={severidade} onChange={setSeveridade} rotulos={SEVERIDADE} rotuloAria="Severidade" />
        </Campo>
        <Texto id="chg-desc" rotulo="Detalhes (opcional)" valor={descricao} onChange={setDescricao} longo linhas={4}
          ajuda="Desde quando, em qual computador ou setor, e o que já foi tentado." />
      </div>
      <GavetaPe className="flex flex-wrap items-center gap-2.5">
        <span role={erro ? 'alert' : undefined} className="min-w-0 flex-[1_1_160px] text-apoio text-critico">{erro}</span>
        <Button variant="outline" onClick={onFechar}>Cancelar</Button>
        <Button onClick={enviar} disabled={abrir.isPending}>{abrir.isPending ? <Spinner className="size-4" /> : <Plus />} Abrir chamado</Button>
      </GavetaPe>
    </Gaveta>
  )
}

function DetalheChamado({ chamado: c, onFechar }: { chamado: Chamado; onFechar: () => void }) {
  const queryClient = useQueryClient()
  const [nota, setNota] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const resolvido = c.situacao === 'resolvido'

  const andamento = useQuery({
    queryKey: ['chamado-andamento', c.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('andamento_chamado_tecnico', { p_id: c.id })
      if (error) throw error
      return data ?? []
    },
  })

  const comentar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('comentar_chamado_tecnico', { p_id: c.id, p_nota: nota.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setNota('')
      void queryClient.invalidateQueries({ queryKey: ['chamado-andamento', c.id] })
      void queryClient.invalidateQueries({ queryKey: ['chamados-unidade'] })
    },
    onError: (e: Error) => setErro(e.message),
  })

  return (
    <Gaveta aberta onAbertaChange={(v) => { if (!v) onFechar() }} rotulo={`Chamado: ${c.titulo}`}>
      <GavetaCabeca
        sobre={`${CATEGORIA[c.categoria as Categoria]} · ${SITUACAO[c.situacao as Situacao]}`}
        titulo={c.titulo}
        detalhe={`Aberto em ${quando(c.aberto_em)}${c.aberto_por ? ` por ${c.aberto_por}` : ''} · severidade ${SEVERIDADE[c.severidade as Severidade].toLowerCase()} · ${c.responsavel ?? 'sem responsável'}`}
      />
      <div className="flex flex-col gap-4 px-[22px] py-5">
        {c.descricao && <p className="text-apoio text-pretty text-tinta-apoio">{c.descricao}</p>}
        {!resolvido && (
          <Texto id="chg-nota" rotulo="Nota para a administração" valor={nota} onChange={setNota} longo linhas={3}
            ajuda="A situação e o responsável são definidos pela administração da rede." />
        )}
        <div className="flex flex-col gap-2">
          <span className="rotulo text-tinta-sussurro">Andamento</span>
          {andamento.isLoading && <Spinner />}
          {andamento.error && <p className="text-apoio text-critico">{(andamento.error as Error).message}</p>}
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
        {!resolvido && (
          <Button onClick={() => { setErro(null); if (nota.trim().length < 3) { setErro('Escreva a nota.'); return } comentar.mutate() }} disabled={comentar.isPending}>
            {comentar.isPending && <Spinner className="size-4" />} Enviar nota
          </Button>
        )}
      </GavetaPe>
    </Gaveta>
  )
}
