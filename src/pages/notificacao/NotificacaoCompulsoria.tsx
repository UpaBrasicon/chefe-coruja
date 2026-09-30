// ─────────────────────────────────────────────────────────────────────────────
// Notificação compulsória (porte do protótipo: "Notificação de agravo",
// index.html ~2466 e `notifVals`; tela da enfermagem ~8204 e `sinanVals`).
//
// Atendimentos da unidade com CID da Lista Nacional de Notificação
// Compulsória, pelo período da DATA DO ATENDIMENTO. A detecção por CID só
// sugere: o caso vira notificação (e passa a impedir a alta) quando alguém a
// abre. A ficha individual do SINAN é preenchida aqui; o envio ao SINAN é à
// parte. O mapeamento CID → agravo é do protótipo e aguarda a vigilância.
// A mesma RPC (notificacao_compulsoria_periodo) alimenta a folha 08.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList, FolderOpen, HardHat, Shield, ShieldAlert, X } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useTerminologia } from '@/hooks/useTerminologia'
import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import {
  type Caso, chaveLista, codigoCid, ddmm, FONTE_LNNC, hojeSP, PENDENTE, prazo, ROTULO_SITUACAO, somarDias, useCasos, useConferencia,
} from './dados'
import { FichaSinan } from './FichaSinan'

type Filtro = 'pendentes' | 'notificados' | 'todos'
const FILTROS: [Filtro, string][] = [['pendentes', 'Pendentes'], ['notificados', 'Notificados'], ['todos', 'Todos']]

const TOM_SITUACAO: Record<Caso['situacao'], string> = {
  sugerido: 'bg-atencao/10 text-atencao',
  a_registrar: 'bg-critico/10 text-critico',
  reaberto: 'bg-critico/10 text-critico',
  notificado: 'bg-conforme/10 text-conforme',
  descartado: 'bg-trilha text-tinta-apoio',
}
const pilula = 'rounded-capsula px-2.5 py-[3px] text-apoio font-semibold whitespace-nowrap'
const caixa = 'rounded-cartao border border-fio bg-superficie shadow-repouso'

export default function NotificacaoCompulsoria() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const aberto = params.get('ficha')
  const abrirFicha = (id: string | null) => setParams(id ? { ficha: id } : {}, { replace: false })

  const hoje = hojeSP()
  const [de, setDe] = React.useState(somarDias(hoje, -30))
  const [ate, setAte] = React.useState(hoje)
  const [cids, setCids] = React.useState<string[]>([])
  const [filtro, setFiltro] = React.useState<Filtro>('pendentes')
  const [erro, setErro] = React.useState<string | null>(null)
  const casos = useCasos(unidadeId, de, ate, cids)
  const conferencia = useConferencia()

  const todos = casos.data ?? []
  const visiveis = todos.filter((c) =>
    filtro === 'todos' || (filtro === 'pendentes' ? PENDENTE.includes(c.situacao) : c.situacao === 'notificado'))
  const nPend = todos.filter((c) => PENDENTE.includes(c.situacao)).length
  const nImed = todos.filter((c) => PENDENTE.includes(c.situacao) && c.imediata).length

  async function abrirNotificacao(c: Caso) {
    if (c.agravo_id) return abrirFicha(c.agravo_id)
    setErro(null)
    const { data, error } = await supabase.rpc('abrir_notificacao', {
      p_paciente: c.paciente_id, p_item: c.item ?? undefined, p_cid: c.cid ?? undefined,
      p_episodio: c.episodio_id ?? undefined, p_internacao: c.internacao_id ?? undefined,
    })
    if (error) return setErro(error.message)
    void qc.invalidateQueries({ queryKey: chaveLista })
    abrirFicha(data as string)
  }

  if (aberto) {
    return (
      <>
        <TituloPagina icone={Shield} titulo="Notificação compulsória" />
        <FichaSinan agravoId={aberto} onVoltar={() => abrirFicha(null)} />
      </>
    )
  }

  const faltaConferir = conferencia.data && (conferencia.data.itens > 0 || conferencia.data.regras > 0)

  return (
    <>
      <TituloPagina icone={Shield} titulo="Notificação compulsória"
        descricao={`Os casos entram quando o atendimento registra CID de notificação compulsória (LNNC, ${FONTE_LNNC}). A ficha individual do SINAN é preenchida aqui; a digitação no SINAN é feita à parte.`} />

      {faltaConferir && (
        <div className="mb-4 flex items-start gap-2.5 rounded-controle border border-nota bg-alerta-atencao px-3.5 py-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-atencao" aria-hidden />
          <span className="text-apoio leading-[1.5] text-pretty text-atencao">
            O catálogo aguarda a conferência da vigilância: a portaria não traz CID, e o mapeamento CID → agravo veio do protótipo
            ({conferencia.data!.itens} de 70 agravos e {conferencia.data!.regras} faixas de CID sem conferência). Por isso a lista só
            sugere: nada é notificado sozinho. Confira na lista do Ministério da Saúde antes de descartar um caso.
          </span>
        </div>
      )}

      <div className={cn(caixa, 'mb-4 flex flex-col gap-3.5 p-4 sm:px-5')}>
        <span className="text-controle leading-[1.5] text-pretty text-tinta-apoio">
          Atendimentos cujo diagnóstico tem CID de notificação compulsória. O período é o da data do atendimento, não o do registro do CID.
        </span>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-[0_1_160px] flex-col gap-1 text-apoio font-medium text-grafite">
            Atendimento de
            <Input type="date" value={de} max={ate || hoje} onChange={(e) => setDe(e.target.value)} />
          </label>
          <label className="flex flex-[0_1_160px] flex-col gap-1 text-apoio font-medium text-grafite">
            Até
            <Input type="date" value={ate} min={de || undefined} max={hoje} onChange={(e) => setAte(e.target.value)} />
          </label>
          <IncluirCid cids={cids} incluir={(c) => setCids((x) => (x.includes(c) ? x : [...x, c]))} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-apoio font-medium text-grafite">CIDs considerados:</span>
          {cids.length === 0 && <span className="text-apoio text-tinta-sussurro">todos os notificáveis</span>}
          {cids.map((c) => (
            <span key={c} className="inline-flex items-center gap-1.5 rounded-capsula border border-marca/40 bg-marca/10 py-1 pr-1.5 pl-[11px] text-apoio font-medium text-acao">
              {c}
              <button type="button" aria-label={`Excluir ${c}`} onClick={() => setCids((x) => x.filter((y) => y !== c))} className="flex p-0.5">
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Chips rotulo="Filtrar casos">
          {FILTROS.map(([k, r]) => <Chip key={k} ativo={filtro === k} onClick={() => setFiltro(k)}>{r}</Chip>)}
        </Chips>
        <span className="text-apoio text-tinta-sussurro">
          {todos.length} {todos.length === 1 ? 'caso' : 'casos'} · {nPend} sem notificação registrada{nImed ? ` · ${nImed} de notificação imediata` : ''}
        </span>
      </div>

      {erro && <p role="alert" className="mb-3 rounded-controle border border-critico/30 bg-critico/[0.06] p-3 text-apoio text-critico">{erro}</p>}

      {casos.isLoading ? (
        <div className="flex h-32 items-center justify-center"><Spinner /></div>
      ) : casos.error ? (
        <p className="text-apoio text-critico">{(casos.error as Error).message}</p>
      ) : visiveis.length === 0 ? (
        <Vazio icone={Shield} titulo={filtro === 'pendentes' ? 'Nenhuma notificação pendente' : 'Nenhum atendimento notificável com esses filtros'}
          texto="Mude o período, os CIDs ou o filtro." />
      ) : (
        <div className={cn(caixa, 'overflow-hidden')}>
          {visiveis.map((c) => <LinhaCaso key={c.chave} c={c} abrir={() => void abrirNotificacao(c)} />)}
        </div>
      )}

      <AcidenteTrabalho unidadeId={unidadeId} aoAbrir={abrirFicha} aoErro={setErro} />
    </>
  )
}

function LinhaCaso({ c, abrir }: { c: Caso; abrir: () => void }) {
  const falta = (c.situacao === 'a_registrar' || c.situacao === 'reaberto') ? c.pendencias ?? [] : []
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-b-0 hover:bg-campo">
      <span className="w-12 shrink-0 text-controle font-semibold text-tinta tabular-nums">{ddmm(c.atendimento_em)}</span>
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <span className="text-corpo font-medium text-tinta">{c.paciente_nome}</span>
        <span className="text-apoio text-tinta-sussurro">{[c.local, c.origem].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="flex min-w-0 flex-[2_1_240px] flex-col gap-0.5">
        <span className="text-controle text-tinta">{c.agravo}{c.item ? ` (item ${c.item})` : ''}</span>
        <span className="text-apoio text-tinta-sussurro">
          <b className="font-semibold text-acao">{c.cid ?? 'sem CID próprio'}</b>{c.cid_descricao ? ` · ${c.cid_descricao}` : ''}
        </span>
        {falta.length > 0 && <span className="text-apoio text-critico">Falta para registrar: {falta.map((t) => t.split(':')[0]).join(', ')}</span>}
        {c.situacao === 'reaberto' && c.motivo_reabertura && <span className="text-apoio text-atencao">Reaberto: {c.motivo_reabertura}</span>}
      </div>
      <span className={cn(pilula, c.imediata ? 'bg-critico/10 text-critico' : 'bg-trilha text-tinta-apoio')}>{prazo(c)}</span>
      <span className={cn(pilula, TOM_SITUACAO[c.situacao])}
        title={c.situacao === 'notificado' ? [c.registrado_por, c.numero_sinan && `SINAN ${c.numero_sinan}`].filter(Boolean).join(' · ') : undefined}>
        {ROTULO_SITUACAO[c.situacao]}{c.situacao === 'notificado' && c.numero_sinan ? ` · ${c.numero_sinan}` : ''}
      </span>
      <div className="flex shrink-0 gap-[7px]">
        {c.no_acesso && (
          <Button variant="outline" size="sm" render={<Link to={`/prontuarios/${c.paciente_id}`} />} nativeButton={false}>
            <FolderOpen aria-hidden /> Paciente
          </Button>
        )}
        <Button variant={c.situacao === 'sugerido' ? 'default' : 'outline'} size="sm" onClick={abrir}>
          <ClipboardList aria-hidden /> {c.situacao === 'sugerido' ? 'Abrir notificação' : 'Ficha SINAN'}
        </Button>
      </div>
    </div>
  )
}

/** Incluir CID no filtro: só entra CID notificável (conferido na LNNC do banco). */
function IncluirCid({ cids, incluir }: { cids: string[]; incluir: (c: string) => void }) {
  const [texto, setTexto] = React.useState('')
  const [foco, setFoco] = React.useState(false)
  const [aviso, setAviso] = React.useState('')
  const busca = useTerminologia('cid10', foco ? texto : '', 12)
  const sugestoes = foco && texto.trim().length >= 2 ? busca.data ?? [] : []
  const codigos = sugestoes.map((s) => s.codigo)
  const notificaveis = useQuery({
    queryKey: ['lnnc-dos-cids', [...codigos].sort()],
    enabled: codigos.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('notificacao_compulsoria_dos_cids', { p_cids: codigos })
      if (error) throw error
      return new Set((data ?? []).map((x) => x.cid.replace('.', '')))
    },
  })
  const lista = sugestoes.filter((s) => notificaveis.data?.has(s.codigo.replace('.', '')))

  async function conferirEIncluir(bruto: string) {
    const cod = codigoCid(bruto)
    if (!cod) return
    const { data, error } = await supabase.rpc('notificacao_compulsoria_dos_cids', { p_cids: [cod] })
    if (error) return setAviso(error.message)
    const achado = data?.[0]
    if (!achado) return setAviso(`${cod} não está marcado como notificável.`)
    if (cids.includes(achado.cid)) return setAviso(`${achado.cid} já está no filtro.`)
    setAviso('')
    setTexto('')
    incluir(achado.cid)
  }

  return (
    <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1">
      <label htmlFor="notif-cid" className="text-apoio font-medium text-grafite">Incluir CID notificável</label>
      <div className="relative flex flex-wrap gap-2">
        <Input id="notif-cid" className="min-w-0 flex-[1_1_200px]" placeholder="Código ou nome, ex.: A90" autoComplete="off" value={texto}
          onChange={(e) => { setTexto(e.target.value); setAviso('') }} onFocus={() => setFoco(true)} onBlur={() => setTimeout(() => setFoco(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter') void conferirEIncluir(texto) }} />
        <Button variant="outline" disabled={!codigoCid(texto)} onClick={() => void conferirEIncluir(texto)}>Incluir</Button>
        {lista.length > 0 && (
          <div role="listbox" className="absolute top-full right-0 left-0 z-30 mt-0.5 max-h-[280px] overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
            {lista.map((r) => (
              <button key={r.codigo} type="button" role="option" aria-selected={false}
                onMouseDown={(e) => e.preventDefault()} onClick={() => { setFoco(false); void conferirEIncluir(r.codigo) }}
                className="block w-full border-b border-trilha px-3 py-2 text-left text-controle text-tinta last:border-b-0 hover:bg-campo">
                {r.codigo} — {r.descricao}
              </button>
            ))}
          </div>
        )}
      </div>
      {aviso && <span className="text-apoio text-atencao">{aviso}</span>}
    </div>
  )
}

/**
 * Acidente de trabalho (LNNC 1a e 1b) não tem CID próprio no atendimento: a
 * notificação é aberta aqui, para paciente com atendimento aberto nos setores
 * do seu plantão (protótipo, "Abrir notificação de acidente de trabalho").
 */
function AcidenteTrabalho({ unidadeId, aoAbrir, aoErro }: { unidadeId: string | undefined; aoAbrir: (id: string) => void; aoErro: (m: string | null) => void }) {
  const qc = useQueryClient()
  const [paciente, setPaciente] = React.useState<string | null>(null)
  const [tipo, setTipo] = React.useState<'1a' | '1b' | null>(null)
  const pacientes = useQuery({
    queryKey: ['notificacao-pacientes-plantao', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.from('episodios').select('paciente_id, pacientes(nome)')
        .eq('unidade_id', unidadeId!).neq('etapa', 'encerrado').order('chegada_em', { ascending: false }).limit(60)
      if (error) throw error
      const vistos = new Map<string, string>()
      for (const e of data ?? []) {
        const nome = (e.pacientes as { nome: string } | null)?.nome
        if (nome && !vistos.has(e.paciente_id)) vistos.set(e.paciente_id, nome)
      }
      return [...vistos.entries()].map(([id, nome]) => ({ id, nome }))
    },
  })
  const lista = pacientes.data ?? []

  async function abrir() {
    if (!paciente || !tipo) return
    aoErro(null)
    const { data, error } = await supabase.rpc('abrir_notificacao', { p_paciente: paciente, p_item: tipo })
    if (error) return aoErro(error.message)
    void qc.invalidateQueries({ queryKey: chaveLista })
    setPaciente(null)
    setTipo(null)
    aoAbrir(data as string)
  }

  return (
    <section className={cn(caixa, 'mt-4 flex flex-col gap-3 p-4 sm:px-5')} aria-label="Abrir notificação de acidente de trabalho">
      <h2 className="flex items-center gap-2 text-corpo font-semibold text-tinta">
        <HardHat className="size-4 text-acao" aria-hidden /> Abrir notificação de acidente de trabalho
      </h2>
      <span className="text-apoio leading-[1.5] text-pretty text-tinta-sussurro">
        Acidente de trabalho não tem CID próprio no atendimento. Escolha o paciente do plantão e o tipo; a ficha abre em seguida.
      </span>
      <span className="text-apoio font-medium text-grafite">Paciente</span>
      <div role="group" aria-label="Paciente" className="flex flex-wrap gap-1.5">
        {lista.map((p) => <Chip key={p.id} ativo={paciente === p.id} onClick={() => setPaciente(paciente === p.id ? null : p.id)}>{p.nome}</Chip>)}
        {!pacientes.isLoading && lista.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum paciente com atendimento aberto no seu plantão.</span>}
      </div>
      <span className="text-apoio font-medium text-grafite">Tipo</span>
      <div role="group" aria-label="Tipo" className="flex flex-wrap gap-1.5">
        <Chip ativo={tipo === '1a'} onClick={() => setTipo('1a')}>Acidente de trabalho com exposição a material biológico</Chip>
        <Chip ativo={tipo === '1b'} onClick={() => setTipo('1b')}>Acidente de trabalho</Chip>
      </div>
      <div className="flex justify-end">
        <Button disabled={!paciente || !tipo} onClick={() => void abrir()}><Shield aria-hidden /> Abrir ficha</Button>
      </div>
    </section>
  )
}
