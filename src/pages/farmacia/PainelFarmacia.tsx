import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { TituloSecao, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'

// Painel da farmácia (Fase 2, tarefa 9; migration 20261031000008). Junta o
// que é crítico: faltas abertas priorizadas (alta vigilância, pacientes
// afetados, setores), estoque crítico, validação pendente de alta vigilância
// e administradas sem liberação da farmácia. A farmácia dá retorno em cada falta; o plantão
// vê o retorno ao escolher o medicamento na prescrição.

export type FaltaPriorizada = {
  id: string; medicamento_id: string; principio_ativo: string; apresentacao: string | null; situacao: string
  observacao: string | null; sinalizada_em: string; sinalizada_por: string | null; alta_vigilancia: boolean
  pacientes: number; setores: string[]; retorno: { texto: string; por: string | null; em: string } | null
}
const SIT: Record<string, string> = { registrada: 'Registrada', em_cotacao: 'Em cotação', reposta: 'Reposta' }

export function PainelFarmacia({ unidade, podeAgir, irPara, semNumeros = false }: {
  unidade: string; podeAgir: boolean; irPara?: (aba: 'faltas' | 'validacao' | 'disponibilidade') => void
  /** O farmacêutico já vê os números na faixa do topo da Central: não repetir. */
  semNumeros?: boolean
}) {
  const faltas = useQuery({
    queryKey: ['faltas-priorizadas', unidade],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('faltas_priorizadas', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as unknown as FaltaPriorizada[]
    },
  })
  // as chaves 'farmacia-estoque' e 'sem-liberacao' são as mesmas da aba
  // Disponibilidade e da tela Alta vigilância: o cache guarda a lista inteira e
  // o painel só filtra ou conta na leitura (select), senão uma tela quebra a outra
  const estoque = useQuery({
    queryKey: ['farmacia-estoque', unidade],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('farmacia_estoque', { p_unidade: unidade })
      if (error) throw error
      return data ?? []
    },
    select: (lista) => lista.filter((e) => e.situacao === 'falta' || e.situacao === 'critico'),
  })
  const validacao = useQuery({
    queryKey: ['fila-validacao-av', unidade],
    enabled: podeAgir,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_validacao', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []).filter((i) => i.alta_vigilancia && !i.ultima_situacao).length
    },
  })
  // alta vigilância administrada sem a liberação da farmácia (decisão do RT de 09/10/2026)
  const semLiberacao = useQuery({
    queryKey: ['sem-liberacao', unidade],
    enabled: !semNumeros,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('administracoes_sem_liberacao', { p_unidade: unidade })
      if (error) throw error
      return (data ?? []) as unknown as unknown[]
    },
    select: (lista) => (Array.isArray(lista) ? lista.length : 0),
  })

  return (
    <div className="flex flex-col gap-5">
      {!semNumeros && <div className="grid gap-3 sm:grid-cols-4">
        <Numero rotulo="Faltas abertas" valor={faltas.data?.length} destaque={(faltas.data ?? []).some((f) => f.alta_vigilancia)} />
        <Numero rotulo="Estoque crítico ou em falta" valor={estoque.data?.length} onClick={irPara ? () => irPara('disponibilidade') : undefined} />
        {podeAgir && <Numero rotulo="Validação pendente (alta vigilância)" valor={validacao.data} destaque={(validacao.data ?? 0) > 0} onClick={irPara ? () => irPara('validacao') : undefined} />}
        <Numero rotulo="Administradas sem liberação" valor={semLiberacao.data} destaque={(semLiberacao.data ?? 0) > 0} href="/alta-vigilancia" />
      </div>}
      <section className="flex flex-col gap-2">
        <TituloSecao>Faltas abertas, por prioridade</TituloSecao>
        <span className="text-rotulo text-tinta-sussurro">Primeiro alta vigilância, depois quantos pacientes têm o medicamento prescrito agora, depois a mais antiga.</span>
        {faltas.isLoading ? <Spinner /> : faltas.error ? (
          <p role="alert" className="text-apoio text-critico">{(faltas.error as Error).message}</p>
        ) : (faltas.data ?? []).length === 0 ? (
          <Vazio icone={AlertTriangle} titulo="Nenhuma falta aberta" />
        ) : (faltas.data ?? []).map((f) => <LinhaFalta key={f.id} f={f} unidade={unidade} podeAgir={podeAgir} />)}
      </section>
      {(estoque.data ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <TituloSecao>Estoque crítico ou em falta</TituloSecao>
          <div className="flex flex-wrap gap-1.5">
            {(estoque.data ?? []).map((e) => (
              <Badge key={e.medicamento_id} variant={e.situacao === 'falta' ? 'destructive' : 'warning'}>
                {e.alta_vigilancia && <ShieldAlert className="size-3" />} {e.principio_ativo} · {e.quantidade ?? '—'}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Numero({ rotulo, valor, destaque, onClick, href }: { rotulo: string; valor: number | undefined; destaque?: boolean; onClick?: () => void; href?: string }) {
  const corpo = (
    <>
      <span className="text-apoio text-tinta-sussurro">{rotulo}</span>
      <span className={`text-titulo font-semibold ${destaque ? 'text-critico' : 'text-tinta'}`}>{valor ?? '—'}</span>
    </>
  )
  const cls = 'flex flex-col gap-0.5 rounded-cartao border border-fio bg-superficie px-4 py-3 text-left'
  if (href) return <Link to={href} className={cls}>{corpo}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{corpo}</button>
  return <div className={cls}>{corpo}</div>
}

function LinhaFalta({ f, unidade, podeAgir }: { f: FaltaPriorizada; unidade: string; podeAgir: boolean }) {
  const qc = useQueryClient()
  const [texto, setTexto] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['faltas-priorizadas', unidade] })
    void qc.invalidateQueries({ queryKey: ['faltas', unidade] })
    void qc.invalidateQueries({ queryKey: ['farmacia-estoque', unidade] })
  }
  async function chamar(p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p
    if (error) return setErro(error.message)
    setErro(null); setTexto(''); recarregar()
  }
  return (
    <div className={`flex flex-col gap-1.5 rounded-lg border bg-superficie px-4 py-3 text-apoio ${f.alta_vigilancia ? 'border-critico/40' : 'border-fio'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-tinta">{f.principio_ativo}</span>
        <span className="text-tinta-apoio">{f.apresentacao}</span>
        {f.alta_vigilancia && <Badge variant="destructive"><ShieldAlert className="size-3" /> alta vigilância</Badge>}
        <Badge variant={f.situacao === 'em_cotacao' ? 'warning' : 'destructive'} className="ml-auto">{SIT[f.situacao] ?? f.situacao}</Badge>
      </div>
      <span className="text-tinta">
        {f.pacientes > 0 ? `${f.pacientes} paciente(s) com o medicamento prescrito agora` : 'Nenhum paciente com o medicamento prescrito agora'}
        {f.setores.length > 0 ? ` · ${f.setores.join(', ')}` : ''}
      </span>
      <span className="text-xs text-tinta-sussurro">Sinalizada por {f.sinalizada_por ?? '—'}, {fmtDataHora(f.sinalizada_em)}{f.observacao ? ` — “${f.observacao}”` : ''}</span>
      {f.retorno && <span className="text-xs text-conforme">Retorno da farmácia: “{f.retorno.texto}” ({f.retorno.por ?? '—'}, {fmtDataHora(f.retorno.em)})</span>}
      {podeAgir && (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="h-8 min-w-56 flex-1" placeholder="Retorno ao plantão: substituto, previsão ou conduta" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <Button size="xs" disabled={texto.trim().length < 5} onClick={() => void chamar(supabase.rpc('registrar_retorno_falta', { p_falta: f.id, p_texto: texto.trim() }))}>Enviar retorno</Button>
          {f.situacao === 'registrada' && <Button size="xs" variant="outline" onClick={() => void chamar(supabase.rpc('avancar_falta', { p_falta: f.id, p_situacao: 'em_cotacao' }))}>Em cotação</Button>}
          <Button size="xs" variant="outline" onClick={() => void chamar(supabase.rpc('avancar_falta', { p_falta: f.id, p_situacao: 'reposta' }))}>Reposta</Button>
        </div>
      )}
      {erro && <span role="alert" className="text-xs text-critico">{erro}</span>}
    </div>
  )
}
