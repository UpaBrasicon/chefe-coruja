import { useMutation, useQuery } from '@tanstack/react-query'
import { LayoutDashboard, MapPin, Search, TrendingUp } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Parametro, ResumoParametros } from '@/components/monitor/Parametros'
import { Estado, type TomEstado } from '@/components/porta/Estado'
import { Button } from '@/components/ui/button'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useUnidade } from '@/contexts/UnidadeContext'
import { hora as formatarHora, numero } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database'

import { chaveMedida, chavePainel, PAINEIS, usePanorama, type Medida } from './panorama'

// Painel do Gestor (P/index.html 6879–7019): o Panorama da unidade (os painéis
// e as medidas que o gestor escolheu em Indicadores), a pergunta sobre a gestão
// respondida pelo banco da unidade e a auditoria de check-in do dia, previsto ×
// realizado. Revisão visual 3.9 (27/10/2026, opção B do RT): os painéis viram
// abas com a contagem do que pede ação (nada roda sozinho) e cada aba usa a peça
// "primeiro o que pede ação" da 3.1; a auditoria vira tabela.

type LinhaCheckin = Database['public']['Functions']['auditoria_checkin']['Returns'][number]
type Resposta = { entendida: boolean; tema: string | null; titulo: string; resposta: string; itens: { rotulo: string; valor: string }[]; link: string | null }

const ROTULO_LINK: Record<string, string> = {
  '/indicadores': 'Abrir Indicadores',
  '/gestao/gaviao': 'Abrir Olho de Gavião',
  '/internacao': 'Abrir Internação',
  '/observacao': 'Abrir Observação',
}

// Caminho de cada medida que pede ação: a tela do gestor onde se resolve.
// "#auditoria" desce até a auditoria de check-in, nesta mesma página.
const CAMINHO: Record<string, [rotulo: string, destino: string]> = {
  ocupacao: ['Abrir Internação', '/internacao'],
  checkin: ['Ver a auditoria', '#auditoria'],
  fora_raio: ['Ver a auditoria', '#auditoria'],
  sem_checkin: ['Ver a auditoria', '#auditoria'],
  estoque: ['Abrir Farmácia', '/gestao/farmacia'],
  espera: ['Abrir Porta', '/gestao/porta'],
  reavaliacao: ['Abrir Porta', '/gestao/porta'],
  obs_prazo: ['Abrir Observação', '/observacao'],
  evolucoes: ['Abrir Internação', '/internacao'],
  bloqueados: ['Abrir Internação', '/internacao'],
  evasoes: ['Abrir Indicadores', '/indicadores'],
  vagas: ['Abrir Escala', '/escala'],
  trocas: ['Abrir Escala', '/escala'],
  solicitacoes: ['Abrir Escala', '/escala'],
}

const hora = (iso: string | null) => (iso ? formatarHora(iso) : '—')

// ── Panorama em abas ────────────────────────────────────────────────────────
function Panorama({ unidadeId }: { unidadeId: string }) {
  const { data, isLoading, error } = usePanorama(unidadeId)
  const navigate = useNavigate()
  const [aba, setAba] = React.useState<string | null>(null)

  const fora = React.useMemo(() => new Set(data?.fora ?? []), [data?.fora])
  if (error) return <MensagemErro texto={`Falha ao carregar o panorama: ${(error as Error).message}`} />
  if (isLoading || !data) return <div className="flex h-40 items-center justify-center rounded-cartao border border-fio bg-superficie"><Spinner /></div>

  const paineis = PAINEIS.filter((p) => !fora.has(chavePainel(p.chave))).map((p) => {
    const medidas = p.medidas(data.n).filter((m) => !fora.has(chaveMedida(p.chave, m.chave)))
    return { ...p, medidas, pedem: medidas.filter((m) => m.nivel !== 'ok').length }
  })
  const atual = paineis.find((p) => p.chave === aba) ?? paineis[0]
  const ir = (destino: string) => {
    if (destino.startsWith('#')) document.getElementById(destino.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else navigate(destino)
  }
  const regua = (m: Medida) => {
    const caminho = m.nivel !== 'ok' ? CAMINHO[m.chave] : undefined
    return (
      <Parametro key={m.chave} grandeza={m.grandeza} rotulo={m.rotulo} valor={m.valor} estado={m.estado} nivel={m.nivel}
        acao={caminho?.[0]} onClick={caminho ? () => ir(caminho[1]) : undefined} />
    )
  }
  const escolher = (
    <Link to="/indicadores" className="inline-flex items-center gap-1.5 text-apoio font-medium text-acao hover:underline">
      <TrendingUp className="size-3.5" aria-hidden /> Escolher em Indicadores
    </Link>
  )

  if (!atual) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-cartao border border-fio bg-superficie px-5 py-4">
        <span className="text-corpo text-pretty text-tinta-apoio">Nenhum painel escolhido para o Painel do Gestor.</span>
        {escolher}
      </div>
    )
  }

  return (
    <section aria-label="Panorama da unidade" className="flex flex-col gap-2">
      <Tabs value={atual.chave} onValueChange={(v) => setAba(v as string)}>
        <TabsList aria-label="Painéis da unidade">
          {paineis.map((p) => (
            <TabsTrigger key={p.chave} value={p.chave}>
              {p.titulo}
              {p.pedem > 0 && <span className="text-rotulo font-semibold text-atencao tabular-nums" aria-label={`${p.pedem} pedem ação`}>{p.pedem}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        {atual.medidas.length === 0
          ? <p className="px-5 py-4 text-apoio text-tinta-apoio">Este painel está sem medidas escolhidas.</p>
          : <ResumoParametros>{atual.medidas.map(regua)}</ResumoParametros>}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-trilha px-5 py-2.5">
          <span className="text-rotulo text-tinta-sussurro">{atual.nota(data.n)}</span>
          {escolher}
        </div>
      </div>
    </section>
  )
}

// ── Pergunta sobre a gestão ─────────────────────────────────────────────────
function Pergunta({ unidadeId }: { unidadeId: string }) {
  const [texto, setTexto] = React.useState('')
  const perguntar = useMutation({
    mutationFn: async (q: string) => {
      const { data, error } = await supabase.rpc('perguntar_gestao', { p_unidade: unidadeId, p_pergunta: q })
      if (error) throw error
      return data as unknown as Resposta
    },
  })
  const enviar = (q: string) => {
    const t = q.trim()
    if (t.length >= 3) perguntar.mutate(t)
  }
  const r = perguntar.data

  return (
    <section aria-label="Pergunta sobre a gestão" className="flex flex-col gap-2">
      <form onSubmit={(e) => { e.preventDefault(); enviar(texto) }}
        className="flex items-center gap-2.5 rounded-controle border border-fio bg-superficie px-3.5 py-2 focus-within:border-acao">
        <Search className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />
        <input value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={300}
          placeholder="Pergunte sobre a gestão da unidade (ex.: quem está com mais plantões que o limite?)" aria-label="Pergunte sobre a gestão da unidade"
          className="min-w-0 flex-1 border-0 bg-transparent text-controle text-tinta outline-none placeholder:text-tinta-sussurro" />
        <Button type="submit" size="sm" variant="outline" disabled={perguntar.isPending || texto.trim().length < 3}>
          {perguntar.isPending ? 'Consultando…' : 'Perguntar'}
        </Button>
      </form>
      <MensagemErro texto={perguntar.error ? (perguntar.error as Error).message : null} />
      {r && (
        <div role="status" className={cn('flex flex-col gap-2 rounded-controle border px-3.5 py-3', r.entendida ? 'border-fio bg-superficie' : 'border-atencao/30 bg-alerta-atencao')}>
          <span className="text-corpo font-semibold text-tinta">{r.titulo}</span>
          <p className="text-apoio text-pretty text-tinta-apoio">{r.resposta}</p>
          {r.itens.length > 0 && (
            <ul className="flex flex-col divide-y divide-trilha rounded-controle border border-trilha bg-superficie">
              {r.itens.map((it, k) => (
                <li key={k} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2 text-apoio">
                  <span className="font-medium text-tinta">{it.rotulo}</span>
                  <span className="text-tinta-apoio tabular">{it.valor}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-rotulo text-tinta-sussurro">Respondido com os dados da unidade, agora. Nenhum nome de paciente sai daqui.</span>
            {r.link && <Link to={r.link} className="text-apoio font-medium text-acao hover:underline">{ROTULO_LINK[r.link] ?? 'Abrir'}</Link>}
          </div>
        </div>
      )}
    </section>
  )
}

// ── Auditoria de check-in ───────────────────────────────────────────────────
const SITUACAO: Record<string, { rotulo: string; tom: TomEstado }> = {
  confere: { rotulo: 'confere', tom: 'verde' },
  atraso: { rotulo: 'atraso', tom: 'ambar' },
  fora_do_raio: { rotulo: 'local divergente', tom: 'ambar' },
  atraso_fora_do_raio: { rotulo: 'atraso e local divergente', tom: 'ambar' },
  sem_checkin: { rotulo: 'sem check-in', tom: 'vermelho' },
  sem_escala: { rotulo: 'check-in sem plantão na escala', tom: 'ambar' },
  aguardando: { rotulo: 'aguardando (na tolerância)', tom: 'cinza' },
  a_comecar: { rotulo: 'a começar', tom: 'cinza' },
}
const FILTROS = ['Todos', 'Divergências', 'Em conformidade'] as const
const TURNO: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite', madrugada: 'Madrugada' }

function local(l: LinhaCheckin) {
  if (!l.realizado) return null
  if (l.dentro === false) return `fora do raio${l.distancia_m != null ? ` · ${numero(l.distancia_m)} m` : ''}`
  if (l.dentro === true) return null
  return 'sem cerca geográfica'
}

function AuditoriaCheckin({ unidadeId }: { unidadeId: string }) {
  const [filtro, setFiltro] = React.useState<(typeof FILTROS)[number]>('Todos')
  const { data, isLoading, error } = useQuery({
    queryKey: ['auditoria-checkin', unidadeId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('auditoria_checkin', { p_unidade: unidadeId })
      if (error) throw error
      return data ?? []
    },
  })
  const todas = data ?? []
  // divergências primeiro, na ordem em que o banco devolve
  const ordenadas = [...todas.filter((l) => l.divergente), ...todas.filter((l) => !l.divergente)]
  const linhas = ordenadas.filter((l) => filtro === 'Todos' || (filtro === 'Divergências' ? l.divergente : l.situacao === 'confere'))
  const contaveis = todas.filter((l) => l.situacao !== 'a_comecar')
  const div = contaveis.filter((l) => l.divergente).length

  return (
    <section id="auditoria" aria-label="Auditoria de check-in" className="scroll-mt-4 overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-trilha px-4 py-2.5">
        <span className="flex items-center gap-2 text-apoio font-semibold text-tinta"><MapPin className="size-4 text-tinta-sussurro" aria-hidden /> Auditoria de check-in</span>
        {data && <span className={cn('text-apoio', div ? 'text-atencao' : 'text-tinta-sussurro')}>{div} de {contaveis.length} com divergência hoje</span>}
        <span className="ml-auto">
          <Chips rotulo="Filtrar check-ins">
            {FILTROS.map((f) => <Chip key={f} ativo={filtro === f} onClick={() => setFiltro(f)}>{f}</Chip>)}
          </Chips>
        </span>
      </div>
      {error ? (
        <MensagemErro className="m-4" texto={`Falha ao carregar a auditoria: ${(error as Error).message}`} />
      ) : isLoading ? (
        <div className="flex h-24 items-center justify-center"><Spinner /></div>
      ) : linhas.length === 0 ? (
        <Vazio icone={MapPin} titulo={todas.length ? 'Nenhum check-in neste filtro' : 'Nenhum plantão na escala de hoje'}
          texto="A auditoria compara a escala do dia com o check-in de cada profissional." />
      ) : (
        <Table aria-label="Check-ins de hoje">
          <TableHeader><TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">Profissional</TableHead><TableHead>Previsto</TableHead><TableHead>Realizado</TableHead><TableHead className="pr-4">Situação</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {linhas.map((l) => {
              const s = SITUACAO[l.situacao] ?? { rotulo: l.situacao, tom: 'cinza' as const }
              const onde = local(l)
              return (
                <TableRow key={`${l.plantao_id ?? 'x'}-${l.presenca_id ?? 'y'}`}>
                  <TableCell className="pl-4 whitespace-normal">
                    <span className="font-medium text-tinta">{l.nome}</span>
                    <span className="block text-rotulo text-tinta-sussurro">{[l.setor, TURNO[l.turno] ?? l.turno].filter(Boolean).join(' · ')}</span>
                  </TableCell>
                  <TableCell className="text-tinta-apoio tabular">{hora(l.previsto)}</TableCell>
                  <TableCell className="tabular">
                    <span className={cn('font-medium', l.realizado ? 'text-tinta' : 'text-tinta-sussurro')}>{hora(l.realizado)}</span>
                    {l.diferenca_min != null && (
                      <span className={cn('ml-1.5 text-rotulo', l.situacao === 'confere' ? 'text-tinta-sussurro' : 'text-atencao')}>
                        {l.diferenca_min > 0 ? '+' : l.diferenca_min < 0 ? '−' : ''}{Math.abs(l.diferenca_min)} min
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 whitespace-normal">
                    <Estado tom={s.tom}>{s.rotulo}</Estado>
                    {onde && <span className={cn('block text-rotulo', l.dentro === false ? 'text-atencao' : 'text-tinta-sussurro')}>{onde}</span>}
                    {l.justificativa && <span className="block text-rotulo text-pretty text-tinta-sussurro">“{l.justificativa}”</span>}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </section>
  )
}

export default function PainelGestor() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  if (!unidadeId) return <div className="flex h-40 items-center justify-center"><Spinner /></div>

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col gap-5">
      <TituloPagina icone={LayoutDashboard} titulo="Painel do Gestor" descricao={unidadeAtiva?.unidade?.nome} />
      <Pergunta unidadeId={unidadeId} />
      <Panorama unidadeId={unidadeId} />
      <AuditoriaCheckin unidadeId={unidadeId} />
    </div>
  )
}
