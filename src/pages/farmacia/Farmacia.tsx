// ─────────────────────────────────────────────────────────────────────────────
// Farmácia (Fase 4.5 e 4.9): validação da prescrição, disponibilidade, faltas
// e diluição padrão. Toda regra é do servidor; aqui só se mostra e se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, FlaskConical } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Diluicoes from './Diluicoes'

const ABAS = [['validacao', 'Validação'], ['disponibilidade', 'Disponibilidade'], ['faltas', 'Faltas'], ['diluicao', 'Diluição padrão']] as const
type Aba = (typeof ABAS)[number][0]
const hora = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '—')

export default function Farmacia() {
  const [aba, setAba] = React.useState<Aba>('validacao')
  const { unidadeAtiva } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id
  return (
    <>
      {aba !== 'diluicao' && (
        <TituloPagina icone={FlaskConical} titulo="Farmácia" descricao={unidadeAtiva?.unidade.nome ?? ''} />
      )}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ABAS.map(([k, r]) => <Button key={k} size="sm" variant={aba === k ? 'default' : 'outline'} onClick={() => setAba(k)}>{r}</Button>)}
      </div>
      {aba === 'diluicao' && <Diluicoes />}
      {unidade && aba === 'validacao' && <Validacao unidade={unidade} />}
      {unidade && aba === 'disponibilidade' && <Disponibilidade unidade={unidade} />}
      {unidade && aba === 'faltas' && <Faltas unidade={unidade} />}
    </>
  )
}

type ItemFila = {
  item_id: string; paciente_nome: string; local: string | null; descricao: string; dose: string | null; via: string | null
  posologia: string | null; se_necessario: boolean; peso_kg: number | null; diluicao_versao: number | null; diluicao_texto: string | null
  diluicao_divergente: boolean; justificativa_divergencia: string | null; incompatibilidades: string[] | null
  alta_vigilancia: boolean; prescrito_por: string | null; prescrito_em: string; ultima_situacao: string | null; ultimo_motivo: string | null
}

function Validacao({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const fila = useQuery({
    queryKey: ['fila-validacao', unidade],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_validacao', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as ItemFila[]
    },
  })
  if (fila.data?.length === 0) return <Vazio icone={CheckCircle2} titulo="Nada para validar" texto="Itens novos de prescrição aparecem aqui até serem conferidos." />
  return (
    <div className="flex flex-col gap-3">
      {erro && <p className="rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-sm text-critico">{erro}</p>}
      {(fila.data ?? []).map((i) => (
        <LinhaValidacao key={i.item_id} i={i} aoErro={setErro} aoMudar={() => void qc.invalidateQueries({ queryKey: ['fila-validacao'] })} />
      ))}
    </div>
  )
}

function LinhaValidacao({ i, aoErro, aoMudar }: { i: ItemFila; aoErro: (m: string | null) => void; aoMudar: () => void }) {
  const [motivo, setMotivo] = React.useState('')
  const validar = async (confere: boolean) => {
    const { error } = await supabase.rpc('validar_item', { p_item: i.item_id, p_confere: confere, p_motivo: confere ? undefined : motivo })
    if (error) return aoErro(error.message)
    aoErro(null); setMotivo(''); aoMudar()
  }
  return (
    <Card>
      <CardContent className="flex flex-col gap-1.5 pt-4 text-sm">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium text-tinta">{i.descricao}</span>
          <span>{i.dose} · {i.via} · {i.posologia}{i.se_necessario ? ' · se necessário' : ''}</span>
          {i.alta_vigilancia && <Badge variant="warning">alta vigilância</Badge>}
          {i.ultima_situacao === 'devolvido' && <Badge variant="destructive">devolvido</Badge>}
          <span className="ml-auto text-xs text-tinta-sussurro">{i.paciente_nome} · {i.local ?? '—'} · {i.prescrito_por} · {hora(i.prescrito_em)}</span>
        </div>
        {i.peso_kg && <p className="text-xs text-tinta-apoio">Peso de referência: {i.peso_kg} kg</p>}
        {i.diluicao_texto && (
          <p className={`text-xs ${i.diluicao_divergente ? 'text-atencao' : 'text-tinta-apoio'}`}>
            {i.diluicao_divergente ? `Diluição fora do padrão: ${i.diluicao_texto} — ${i.justificativa_divergencia}` : `Diluição padrão v${i.diluicao_versao}: ${i.diluicao_texto}`}
          </p>
        )}
        {i.incompatibilidades?.length ? <p className="text-xs text-atencao">Incompatibilidades (diluição publicada): {i.incompatibilidades.join(', ')}</p> : null}
        {i.ultima_situacao === 'devolvido' && <p className="text-xs text-critico">Devolvido: {i.ultimo_motivo}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="xs" onClick={() => void validar(true)}>Confere</Button>
          <Input className="h-8 min-w-56 flex-1" placeholder="Motivo para devolver ao médico (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="xs" variant="outline" disabled={motivo.trim().length < 10} onClick={() => void validar(false)}>Devolver para correção</Button>
        </div>
      </CardContent>
    </Card>
  )
}

type Disp = { medicamento_id: string; principio_ativo: string; apresentacao: string | null; quantidade: number | null
  limite_critico: number | null; limite_falta: number | null; situacao: string; atualizado_em: string | null }
const SELO: Record<string, { rotulo: string; variante: 'destructive' | 'warning' | 'success' | 'secondary' }> = {
  falta: { rotulo: 'em falta', variante: 'destructive' }, critico: { rotulo: 'crítico', variante: 'warning' },
  ok: { rotulo: 'ok', variante: 'success' }, nao_informado: { rotulo: 'não informado', variante: 'secondary' },
}

function Disponibilidade({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const [filtro, setFiltro] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const lista = useQuery({
    queryKey: ['disponibilidade', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('disponibilidade', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as Disp[]
    },
  })
  const visiveis = (lista.data ?? []).filter((d) => d.principio_ativo.toLowerCase().includes(filtro.trim().toLowerCase()))
  return (
    <div className="flex flex-col gap-2 text-sm">
      {erro && <p className="rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-critico">{erro}</p>}
      <Input placeholder="Filtrar medicamento" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <p className="text-xs text-tinta-sussurro">O selo é a comparação da quantidade com os limites que você define (crítico ≤ e em falta ≤). Em falta primeiro.</p>
      {visiveis.slice(0, 80).map((d) => <LinhaDisp key={d.medicamento_id} d={d} unidade={unidade} aoErro={setErro}
        aoMudar={() => void qc.invalidateQueries({ queryKey: ['disponibilidade'] })} />)}
    </div>
  )
}

function LinhaDisp({ d, unidade, aoErro, aoMudar }: { d: Disp; unidade: string; aoErro: (m: string | null) => void; aoMudar: () => void }) {
  const [q, setQ] = React.useState(d.quantidade?.toString() ?? '')
  const [c, setC] = React.useState(d.limite_critico?.toString() ?? '')
  const [f, setF] = React.useState(d.limite_falta?.toString() ?? '')
  const s = SELO[d.situacao] ?? SELO.nao_informado
  const num = (x: string) => (x.trim() === '' ? undefined : Number(x.replace(',', '.')))
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fio px-3 py-1.5">
      <span className="min-w-48 flex-1"><span className="font-medium">{d.principio_ativo}</span> <span className="text-tinta-apoio">{d.apresentacao}</span></span>
      <Badge variant={s.variante}>{s.rotulo}</Badge>
      <Input aria-label="Quantidade" className="h-8 w-20" value={q} onChange={(e) => setQ(e.target.value)} placeholder="qtd" />
      <Input aria-label="Crítico" className="h-8 w-20" value={c} onChange={(e) => setC(e.target.value)} placeholder="crítico ≤" />
      <Input aria-label="Em falta" className="h-8 w-20" value={f} onChange={(e) => setF(e.target.value)} placeholder="falta ≤" />
      <Button size="xs" variant="outline" disabled={q.trim() === ''} onClick={async () => {
        const { error } = await supabase.rpc('atualizar_estoque', { p_unidade: unidade, p_medicamento: d.medicamento_id,
          p_quantidade: num(q)!, p_limite_critico: num(c), p_limite_falta: num(f) })
        if (error) return aoErro(error.message)
        aoErro(null); aoMudar()
      }}>Salvar</Button>
      <span className="text-xs text-tinta-sussurro">{hora(d.atualizado_em)}</span>
    </div>
  )
}

type Falta = { id: string; situacao: string; observacao: string | null; sinalizada_em: string; medicamento: { principio_ativo: string; apresentacao: string | null } | null }
const SIT_FALTA: Record<string, string> = { registrada: 'Registrada', em_cotacao: 'Em cotação', reposta: 'Reposta' }

function Faltas({ unidade }: { unidade: string }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const lista = useQuery({
    queryKey: ['faltas', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.from('faltas_medicamento')
        .select('id, situacao, observacao, sinalizada_em, medicamento:medicamento(principio_ativo, apresentacao)')
        .eq('unidade_id', unidade).order('sinalizada_em', { ascending: false }).limit(100)
      if (error) throw error
      return (data ?? []) as unknown as Falta[]
    },
  })
  const avancar = async (id: string, situacao: string) => {
    const { error } = await supabase.rpc('avancar_falta', { p_falta: id, p_situacao: situacao })
    if (error) return setErro(error.message)
    setErro(null); void qc.invalidateQueries({ queryKey: ['faltas'] })
  }
  if (lista.data?.length === 0) return <Vazio icone={AlertTriangle} titulo="Nenhuma falta sinalizada" texto="O plantão sinaliza pela prescrição; você acompanha aqui." />
  return (
    <div className="flex flex-col gap-2 text-sm">
      {erro && <p className="rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-critico">{erro}</p>}
      {(lista.data ?? []).map((f) => (
        <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-fio px-3 py-2">
          <span className="flex-1"><span className="font-medium">{f.medicamento?.principio_ativo}</span> <span className="text-tinta-apoio">{f.medicamento?.apresentacao}</span>
            {f.observacao && <span className="block text-xs text-tinta-sussurro">{f.observacao}</span>}</span>
          <Badge variant={f.situacao === 'reposta' ? 'success' : f.situacao === 'em_cotacao' ? 'warning' : 'destructive'}>{SIT_FALTA[f.situacao]}</Badge>
          <span className="text-xs text-tinta-sussurro">{hora(f.sinalizada_em)}</span>
          {f.situacao === 'registrada' && <Button size="xs" variant="outline" onClick={() => void avancar(f.id, 'em_cotacao')}>Em cotação</Button>}
          {f.situacao !== 'reposta' && <Button size="xs" onClick={() => void avancar(f.id, 'reposta')}>Reposta</Button>}
        </div>
      ))}
    </div>
  )
}
