// ─────────────────────────────────────────────────────────────────────────────
// Lista de internados no desenho do protótipo (index.html 2602–2662).
//
// Uma linha por leito: leito, nome e idade, alergia, motivo (o diagnóstico
// primário; sem ele, a queixa da porta), tempo de internação e a pendência
// mais urgente. Filtros (com/sem pendência e setor), resumo "N de M leitos",
// "Abrir leito" abre o caderno na própria linha (os outros saem de cena até
// fechar) e "Prancheta" guarda anotações soltas do médico, só neste navegador.
// Acima, as altas que você deu nas últimas 24 horas, com o cancelamento.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRightLeft, ChevronRight, ClipboardList, Copy, Hospital, Shield } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { rotuloIdade } from '@/domain/idade'
import { carregarEnvelope, novaChave, salvarEnvelope, useRascunho } from '@/pages/plantao/shared/rascunho'
import { Chip, Chips, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Spinner } from '@/components/ui/spinner'

import { LeitoAberto } from './LeitoAberto'
import { ATIVO, diaHora, hora, msg, ROTULO_ALTA, rpc, tempoDesde } from './caderno/comum'

export type PacienteDaLista = {
  id: string
  nome: string
  data_nascimento: string | null
  sexo: string | null
  setor_id: string | null
  setores: { id: string; nome: string } | null
}
type Alerta = { nivel: string; total: number }
type LinhaInternacao = {
  id: string
  paciente_id: string
  status: string
  data_admissao: string
  cid_principal: string | null
  leito: { identificador: string } | null
  episodio: { queixa: string | null } | null
}
type PendenciaLista = { id: string; paciente_id: string; tipo: string; descricao: string; prazo: string | null }
type DiagLista = { internacao_id: string; cid: string; descricao: string | null; status: string }

const FILTROS = ['Todos', 'Com pendência', 'Sem pendência'] as const
type Filtro = (typeof FILTROS)[number]

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

export function ListaInternados({ unidadeId, setores, pacientes, carregando, ehGestor, podeDarAlta, alertasSepse, onTransferir }: {
  unidadeId?: string
  setores: { id: string; nome: string }[]
  pacientes: PacienteDaLista[]
  carregando: boolean
  ehGestor: boolean
  /** plantonista: vê as altas que deu, para cancelar em 24 h */
  podeDarAlta: boolean
  alertasSepse?: Map<string, Alerta>
  onTransferir: (p: PacienteDaLista) => void
}) {
  const [filtro, setFiltro] = React.useState<Filtro>('Todos')
  const [setor, setSetor] = React.useState<string | null>(null)
  const [aberto, setAberto] = React.useState<string | null>(null)
  const [prancheta, setPrancheta] = React.useState<PacienteDaLista | null>(null)
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const { perfil } = useAuth()

  const doSetor = React.useMemo(() => {
    const ids = new Set(setores.map((s) => s.id))
    return pacientes.filter((p) => p.setor_id && ids.has(p.setor_id))
  }, [pacientes, setores])
  const ids = doSetor.map((p) => p.id)
  const chaveIds = [...ids].sort().join(',')

  const internacoes = useQuery({
    queryKey: ['internados-leitos', unidadeId, chaveIds],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internacoes')
        .select('id, paciente_id, status, data_admissao, cid_principal, leito:leitos!internacoes_leito_atual_id_fkey(identificador), episodio:episodios!internacoes_episodio_id_fkey(queixa)')
        .in('paciente_id', ids)
        .in('status', ATIVO)
      if (error) throw error
      return new Map(((data ?? []) as unknown as LinhaInternacao[]).map((i) => [i.paciente_id, i]))
    },
  })
  const pendencias = useQuery({
    queryKey: ['pendencias-lista', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pendencias').select('id, paciente_id, tipo, descricao, prazo')
        .eq('unidade_id', unidadeId!).eq('situacao', 'aberta')
      if (error) throw error
      const m = new Map<string, PendenciaLista[]>()
      for (const p of (data ?? []) as PendenciaLista[]) m.set(p.paciente_id, [...(m.get(p.paciente_id) ?? []), p])
      for (const l of m.values()) l.sort((a, b) => (a.prazo ? Date.parse(a.prazo) : Infinity) - (b.prazo ? Date.parse(b.prazo) : Infinity))
      return m
    },
  })
  const internacaoIds = [...(internacoes.data?.values() ?? [])].map((i) => i.id)
  const diagnosticos = useQuery({
    queryKey: ['diagnosticos-lista', [...internacaoIds].sort().join(',')],
    enabled: internacaoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('diagnosticos_episodio').select('internacao_id, cid, descricao, status')
        .in('internacao_id', internacaoIds).eq('tipo', 'primario').is('encerrado_em', null)
      if (error) throw error
      return new Map(((data ?? []) as DiagLista[]).map((d) => [d.internacao_id, d]))
    },
  })
  const alergias = useQuery({
    queryKey: ['alergias-lista', chaveIds],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('alergias_paciente').select('paciente_id, substancia')
        .in('paciente_id', ids).is('inativada_em', null)
      if (error) throw error
      const m = new Map<string, string[]>()
      for (const a of data ?? []) m.set(a.paciente_id, [...(m.get(a.paciente_id) ?? []), a.substancia])
      return m
    },
  })

  const linhas = doSetor
    .filter((p) => !setor || p.setor_id === setor)
    .filter((p) => {
      const tem = (pendencias.data?.get(p.id) ?? []).length > 0
      return filtro === 'Todos' || (filtro === 'Com pendência' ? tem : !tem)
    })
    .sort((a, b) => (internacoes.data?.get(a.id)?.leito?.identificador ?? 'zz').localeCompare(internacoes.data?.get(b.id)?.leito?.identificador ?? 'zz', 'pt-BR', { numeric: true }))
  const abertoLinha = aberto ? doSetor.find((p) => p.id === aberto) : undefined
  const visiveis = abertoLinha ? [abertoLinha] : linhas
  const leitoDe = (p: PacienteDaLista) => internacoes.data?.get(p.id)?.leito?.identificador ?? null
  const setoresTexto = setores.map((s) => s.nome).join(', ') || 'nenhum'

  return (
    <div className="flex flex-col gap-3.5">
      <p className="flex items-center gap-[7px] text-apoio text-pretty text-tinta-sussurro">
        <Shield className="size-3.5 shrink-0" aria-hidden />
        {ehGestor
          ? `Censo dos setores de internação da unidade: ${setoresTexto}.`
          : `Internados dos setores do seu plantão hoje: ${setoresTexto}. Encerrados ficam em Prontuário; o censo de todos os setores é do gestor.`}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3.5">
        <Chips rotulo="Filtrar internados">
          {FILTROS.map((f) => <Chip key={f} ativo={filtro === f} onClick={() => { setFiltro(f); setAberto(null) }}>{f}</Chip>)}
          {setores.length > 1 && setores.map((s) => (
            <Chip key={s.id} ativo={setor === s.id} onClick={() => { setSetor(setor === s.id ? null : s.id); setAberto(null) }}>{s.nome}</Chip>
          ))}
        </Chips>
        <span className="text-apoio text-tinta-sussurro">
          {abertoLinha
            ? `${leitoDe(abertoLinha) ? `Leito ${leitoDe(abertoLinha)}` : abertoLinha.nome} aberto · os outros voltam quando você fechar`
            : `${linhas.length} de ${doSetor.length} ${doSetor.length === 1 ? 'leito' : 'leitos'}`}
        </span>
      </div>

      {podeDarAlta && unidadeId && <AltasRecentes unidadeId={unidadeId} />}

      {carregando ? (
        <div className="flex h-32 items-center justify-center"><Spinner /></div>
      ) : visiveis.length === 0 ? (
        <Vazio icone={Hospital}
          titulo={doSetor.length === 0 ? 'Nenhum paciente internado' : filtro === 'Com pendência' ? 'Nenhum leito com pendência agora' : 'Nenhum leito neste filtro'}
          texto={doSetor.length === 0 ? 'Quando alguém for internado num setor do seu plantão, aparece aqui.' : undefined} />
      ) : (
        <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
          {visiveis.map((p) => {
            const i = internacoes.data?.get(p.id)
            const pend = pendencias.data?.get(p.id) ?? []
            const primeira = pend[0]
            const vencida = !!primeira?.prazo && Date.parse(primeira.prazo) < agora
            const diag = i ? diagnosticos.data?.get(i.id) : undefined
            const motivo = diag
              ? `${diag.cid}${diag.descricao ? ` — ${diag.descricao}` : ''}${diag.status === 'hipotese' ? ' (hipótese)' : ''}`
              : i?.cid_principal ?? i?.episodio?.queixa ?? 'Sem diagnóstico registrado'
            const alg = alergias.data?.get(p.id) ?? []
            const eAberto = aberto === p.id
            const alerta = alertasSepse?.get(p.id)
            const pranchetaEm = quandoPrancheta(p.id, unidadeId, perfil?.id)
            return (
              <div key={p.id} className="border-b border-trilha last:border-b-0">
                <div className="flex flex-wrap items-center gap-3.5 px-5 py-[13px] hover:bg-campo">
                  <span className="shrink-0 rounded-capsula bg-marca/10 px-[9px] py-1 text-apoio font-semibold text-acao tabular-nums">
                    {leitoDe(p) ?? p.setores?.nome ?? 'sem leito'}
                  </span>
                  <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                    <span className="text-corpo font-medium text-tinta">
                      {p.nome}{' '}
                      <span className="text-apoio font-normal text-tinta-sussurro">{p.data_nascimento ? rotuloIdade(p.data_nascimento, hojeSP()) : ''}</span>
                    </span>
                    {alg.length > 0 && (
                      <span className="flex items-center gap-[5px] text-apoio font-semibold text-critico">
                        <AlertTriangle className="size-[13px] shrink-0" aria-hidden /> Alergia · {alg.join(', ')}
                      </span>
                    )}
                    <span className="flex flex-wrap items-center gap-1.5 text-apoio text-tinta-sussurro">
                      {motivo}
                      {alerta?.nivel === 'choque' && <Badge variant="destructive">Phoenix {alerta.total} · choque séptico?</Badge>}
                      {alerta?.nivel === 'sepse' && <Badge variant="destructive">Phoenix {alerta.total} · sepse?</Badge>}
                      {alerta?.nivel === 'rastreio' && <Badge variant="outline">Phoenix {alerta.total}</Badge>}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-apoio text-tinta-apoio tabular-nums">{i ? tempoDesde(i.data_admissao, agora) : '—'}</span>
                    <span className={cn('max-w-[260px] truncate text-apoio', primeira ? (vencida ? 'font-semibold text-critico' : 'text-atencao') : 'text-tinta-sussurro')}
                      title={pend.map((x) => x.descricao).join(' · ') || undefined}>
                      {primeira
                        ? `${vencida ? 'Vencida: ' : ''}${primeira.descricao}${primeira.prazo ? ` · ${hora(primeira.prazo)}` : ''}${pend.length > 1 ? ` (+${pend.length - 1})` : ''}`
                        : 'Sem pendência'}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-[7px]">
                    <button type="button" onClick={() => setAberto(eAberto ? null : p.id)} aria-expanded={eAberto}
                      className={cn('flex items-center gap-1.5 rounded-[9px] border px-[11px] py-1.5 text-apoio font-medium whitespace-nowrap',
                        eAberto ? 'border-marca/35 bg-marca/10 text-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-marca hover:text-acao')}>
                      <ChevronRight className={cn('size-3.5 transition-transform duration-200', eAberto ? '-rotate-90' : 'rotate-90')} aria-hidden />
                      {eAberto ? 'Fechar' : 'Abrir leito'}
                    </button>
                    <button type="button" onClick={() => setPrancheta(p)}
                      className={cn('flex items-center gap-1.5 rounded-[9px] border px-[11px] py-1.5 text-apoio whitespace-nowrap',
                        pranchetaEm ? 'border-marca/35 bg-marca/10 font-medium text-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-marca hover:text-acao')}>
                      <ClipboardList className="size-3.5" aria-hidden /> {pranchetaEm ? `Prancheta · ${pranchetaEm}` : 'Prancheta'}
                    </button>
                  </div>
                </div>
                {eAberto && (
                  <div className="animate-cc-abre-leito px-5 pt-0.5 pb-5">
                    <LeitoAberto modo="caderno" pacienteId={p.id} pacienteNome={p.nome} ehGestor={ehGestor}
                      acoesTopo={
                        <Button size="xs" variant="outline" onClick={() => onTransferir(p)}>
                          <ArrowRightLeft /> Transferir de setor
                        </Button>
                      } />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {prancheta && (
        <Prancheta paciente={prancheta} leito={leitoDe(prancheta)} unidadeId={unidadeId} perfilId={perfil?.id}
          aoFechar={() => setPrancheta(null)} />
      )}
    </div>
  )
}

// ── altas dadas (24 h: a janela de cancelar_alta) ──────────────────────────
type AltaRecente = {
  internacao_id: string
  paciente_nome: string
  leito: string | null
  setor_nome: string | null
  status: string
  data_alta: string | null
  cid_alta: string | null
  pacote_id: string | null
}

function AltasRecentes({ unidadeId }: { unidadeId: string }) {
  const qc = useQueryClient()
  const [cancelando, setCancelando] = React.useState<string | null>(null)
  const [texto, setTexto] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [ok, setOk] = React.useState<string | null>(null)
  const altas = useQuery({
    queryKey: ['altas-recentes', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_altas_recentes', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as AltaRecente[]
    },
  })
  const lista = altas.data ?? []
  if (lista.length === 0 && !ok) return null

  async function confirmar(a: AltaRecente) {
    try {
      await rpc('cancelar_alta', { p_internacao: a.internacao_id, p_justificativa: texto.trim() })
      setErro(null)
      setOk(`Alta de ${a.paciente_nome} cancelada: o paciente voltou ao censo.`)
      setCancelando(null)
      setTexto('')
      for (const k of ['altas-recentes', 'pacientes-internados', 'internados-leitos', 'leito-aberto', 'ocupacao-setores', 'pendencias-lista'])
        void qc.invalidateQueries({ queryKey: [k] })
    } catch (e) {
      setErro(msg(e))
    }
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-cartao border border-fio bg-superficie px-[18px] py-3">
      <span className="text-controle font-semibold text-tinta">Altas dadas nas últimas 24 horas</span>
      {ok && <span className="text-apoio text-conforme">{ok}</span>}
      {lista.map((a) => {
        const aqui = cancelando === a.internacao_id
        return (
          <div key={a.internacao_id} className="flex flex-col gap-1.5 border-t border-trilha py-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-px">
                <span className="text-controle text-tinta">{a.paciente_nome}{a.leito ? ` · leito ${a.leito}` : a.setor_nome ? ` · ${a.setor_nome}` : ''}</span>
                <span className="text-[12px] text-tinta-sussurro">
                  {ROTULO_ALTA[a.status] ?? 'Alta'} · {diaHora(a.data_alta)}{a.cid_alta ? ` · CID ${a.cid_alta}` : ''}
                </span>
              </div>
              {a.pacote_id && (
                // mesma aba: a sessão sem "manter conectado" mora no sessionStorage
                <Button size="sm" variant="outline" onClick={() => window.location.assign(`/alta/equipe?pacote=${a.pacote_id}`)}>Imprimir alta</Button>
              )}
              {!aqui && (
                <Button size="sm" variant="outline" className="hover:border-critico/40 hover:text-critico"
                  onClick={() => { setCancelando(a.internacao_id); setTexto(''); setErro(null); setOk(null) }}>
                  Cancelar alta
                </Button>
              )}
            </div>
            {aqui && (
              <div className="flex flex-wrap gap-1.5">
                <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Justificativa do cancelamento (mínimo 10 caracteres)"
                  aria-label="Justificativa do cancelamento"
                  className="min-w-0 flex-[1_1_260px] rounded-[10px] border border-fio bg-campo px-[11px] py-2 text-controle text-tinta outline-none focus:border-marca" />
                <Button size="sm" variant="outline" onClick={() => setCancelando(null)}>Voltar</Button>
                <Button size="sm" variant="outline" className="border-critico/40 text-critico" disabled={texto.trim().length < 10} onClick={() => void confirmar(a)}>
                  Confirmar cancelamento
                </Button>
              </div>
            )}
            {aqui && erro && <span className="text-apoio text-critico">{erro}</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── prancheta ───────────────────────────────────────────────────────────────
// Anotação solta do médico sobre o paciente, salva a cada tecla neste
// navegador (12 h, apagada ao sair). Nada daqui vai para o prontuário sozinho.
type NotaPrancheta = { texto: string; quando: string }
const NOTA_VAZIA: NotaPrancheta = { texto: '', quando: '' }
const carregarNota = (chave: string): NotaPrancheta => carregarEnvelope<NotaPrancheta>(chave)?.dados ?? NOTA_VAZIA
const nsPrancheta = (pacienteId: string) => `prancheta:${pacienteId}`

function quandoPrancheta(pacienteId: string, unidadeId?: string, perfilId?: string): string | null {
  const n = carregarNota(novaChave(nsPrancheta(pacienteId), unidadeId, perfilId))
  return n.texto.trim() ? n.quando || 'anotada' : null
}

function Prancheta({ paciente, leito, unidadeId, perfilId, aoFechar }: {
  paciente: PacienteDaLista; leito: string | null; unidadeId?: string; perfilId?: string; aoFechar: () => void
}) {
  const { dados, atualizar, limpar, chave } = useRascunho<NotaPrancheta>(nsPrancheta(paciente.id), unidadeId, perfilId, carregarNota)
  const [copiado, setCopiado] = React.useState(false)
  const fechar = () => {
    // o salvamento automático espera meio segundo; fechar antes não pode perder a última tecla
    try {
      if (dados.texto.trim()) salvarEnvelope(chave, dados)
    } catch {
      // armazenamento indisponível: fica o que o salvamento automático já gravou
    }
    aoFechar()
  }
  return (
    <Gaveta aberta onAbertaChange={(v) => { if (!v) fechar() }} rotulo={`Prancheta de ${paciente.nome}`}>
      <GavetaCabeca sobre="Prancheta de anotações" titulo={paciente.nome} detalhe={leito ? `Leito ${leito}` : paciente.setores?.nome} />
      <div className="flex flex-1 flex-col gap-2.5 px-[22px] py-4">
        <textarea value={dados.texto} autoFocus rows={12} aria-label="Anotações"
          onChange={(e) => atualizar({ texto: e.target.value, quando: hora(new Date().toISOString()) })}
          placeholder="O que você quer lembrar deste paciente: exame a conferir, conversa com a família, dose a rever…"
          className="w-full flex-1 resize-none rounded-[10px] border border-fio bg-campo px-3 py-2.5 text-corpo leading-[1.5] text-tinta outline-none focus:border-marca" />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!dados.texto.trim()}
            onClick={() => void navigator.clipboard?.writeText(dados.texto).then(() => setCopiado(true))}>
            <Copy /> {copiado ? 'Copiado' : 'Copiar'}
          </Button>
          <Button size="sm" variant="ghost" disabled={!dados.texto.trim()} onClick={limpar}>Apagar</Button>
        </div>
      </div>
      <GavetaPe>
        {dados.quando ? `Salvo às ${dados.quando}. ` : 'Nada anotado ainda. '}
        Fica só neste navegador, por 12 horas, e some quando você sai do sistema. Nada daqui vai para o prontuário sozinho: cole na evolução o que for registro.
      </GavetaPe>
    </Gaveta>
  )
}
