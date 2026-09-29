// ─────────────────────────────────────────────────────────────────────────────
// Alergias e eventos adversos (protótipo, aba "Alergias e eventos adversos").
//
// Três estados, sempre à vista: tem alergia (vermelho), nega alergias (registro
// com autor e hora) e não registrada (ninguém perguntou — âmbar, porque lista
// vazia não é "nega"). Registrar alergia encerra o "nega"; "nega" só entra sem
// alergia ativa. Evento adverso ligado ao item da prescrição, grau 1–6 com
// evolução e histórico. Nada se apaga: inativar pede motivo.
//
// A alergia ativa TRAVA o item da prescrição no banco (public.prescrever), e
// nada aqui mexe nisso. Toda regra é do servidor; aqui só se mostra e se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, History, ShieldCheck, ShieldQuestion } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Gaveta, GavetaCabeca, GavetaPe } from '@/components/ui/gaveta'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

import {
  ALERGENOS, EVENTOS_COMUNS, GRAUS_EVENTO, GRAVIDADES, TIPOS_ALERGIA,
  ativas, negaVigente, normalizar, rotuloGrau, rotuloGravidade, rotuloTipo, useAlergias, useRecarregarAlergias,
  type EventoAdverso, type GravidadeAlergia, type PainelAlergias, type TipoAlergia,
} from './useAlergias'

const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : ''
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

// ── selo de alergia: o mesmo no cabeçalho, na prescrição e no painel ─────────
/**
 * Selo de alergia em três estados. Vermelho cheio quando há alergia ativa;
 * "Nenhuma alergia conhecida" em cinza quando o paciente NEGA (registro);
 * "Alergia não registrada" em âmbar quando ninguém registrou nada.
 */
export function SeloAlergia({ pacienteId, onClick, className }: { pacienteId: string; onClick?: () => void; className?: string }) {
  const q = useAlergias(pacienteId)
  const lista = ativas(q.data)
  const base = 'inline-flex items-center gap-1.5 text-apoio whitespace-normal text-left'
  let conteudo: React.ReactNode
  let estilo: string
  let dica: string
  if (q.isLoading) {
    conteudo = <><Spinner className="size-3.5" /> Alergia…</>
    estilo = 'text-tinta-sussurro'
    dica = 'Carregando alergias'
  } else if (q.error || !q.data) {
    // sem leitura não se afirma nada: nem "nega", nem "não registrada"
    conteudo = <><AlertTriangle className="size-3.5 shrink-0" aria-hidden /> Alergia não verificada</>
    estilo = 'font-medium text-atencao'
    dica = q.error ? msg(q.error) : 'Alergia não verificada'
  } else if (q.data.estado === 'tem') {
    conteudo = <><AlertTriangle className="size-3.5 shrink-0" aria-hidden /> Alergia · {lista.map((a) => a.substancia).join(', ')}</>
    estilo = 'rounded-capsula bg-critico px-[11px] py-1 font-semibold text-white'
    dica = 'Alergias ativas: ' + lista.map((a) => `${a.substancia} (${rotuloGravidade(a.gravidade).toLowerCase()})`).join('; ')
  } else if (q.data.estado === 'nega') {
    const n = negaVigente(q.data)
    conteudo = <><ShieldCheck className="size-3.5 shrink-0" aria-hidden /> Nenhuma alergia conhecida</>
    estilo = 'text-tinta-sussurro'
    dica = `Nega alergias · ${quando(n?.registrado_em)}${n?.autor ? ` · ${n.autor}` : ''}`
  } else {
    conteudo = <><ShieldQuestion className="size-3.5 shrink-0" aria-hidden /> Alergia não registrada</>
    estilo = 'font-medium text-atencao'
    dica = 'Ninguém registrou ainda se o paciente tem ou nega alergias'
  }
  if (!onClick) return <span className={cn(base, estilo, className)} title={dica}>{conteudo}</span>
  return (
    <button type="button" onClick={onClick} title={`${dica}. Abrir alergias e eventos adversos.`}
      className={cn(base, estilo, 'cursor-pointer hover:opacity-90 focus-visible:outline-2 focus-visible:outline-acao', className)}>
      {conteudo}
    </button>
  )
}

// ── gaveta e resumo (para a prescrição) ──────────────────────────────────────
export function GavetaAlergias({ pacienteId, nome, aberta, onAbertaChange }: {
  pacienteId: string; nome: string; aberta: boolean; onAbertaChange: (v: boolean) => void
}) {
  return (
    <Gaveta aberta={aberta} onAbertaChange={onAbertaChange} rotulo="Alergias e eventos adversos">
      <GavetaCabeca sobre="Alergias e eventos adversos" titulo={nome} />
      <div className="px-[22px] py-4">
        <AlergiasEventos pacienteId={pacienteId} />
      </div>
      <GavetaPe className="[text-wrap:pretty]">
        Alergia ativa trava na prescrição o medicamento de mesmo nome — nada a contorna. "Nega alergias" é registro com autor e hora, não campo em branco.
      </GavetaPe>
    </Gaveta>
  )
}

/** Resumo para o topo da prescrição: o selo e o caminho para o painel. */
export function ResumoAlergias({ pacienteId, nome }: { pacienteId: string; nome: string }) {
  const [aberta, setAberta] = React.useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fio p-2">
      <span className="text-xs font-semibold tracking-wide text-tinta-sussurro uppercase">Alergias</span>
      <SeloAlergia pacienteId={pacienteId} onClick={() => setAberta(true)} />
      <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setAberta(true)}>Alergias e eventos adversos</Button>
      <p className="w-full text-xs text-tinta-sussurro">Alergia registrada trava o item do medicamento correspondente. Nada a contorna.</p>
      <GavetaAlergias pacienteId={pacienteId} nome={nome} aberta={aberta} onAbertaChange={setAberta} />
    </div>
  )
}

// ── peças visuais ────────────────────────────────────────────────────────────
function Chip({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
      className={cn('rounded-capsula border px-3 py-1 text-apoio transition-colors disabled:opacity-45',
        on ? 'border-acao bg-acao/10 font-medium text-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
      {children}
    </button>
  )
}

// cores do protótipo (algCor): leve verde, moderado laranja, grave vermelho,
// risco de morte vermelho escuro, morte preto, desconhecido cinza
const PILULA_GRAVIDADE: Record<GravidadeAlergia, string> = {
  leve: 'bg-alerta-conforme text-conforme',
  moderada: 'bg-alerta-atencao text-atencao',
  grave: 'bg-alerta-critico text-critico',
  desconhecida: 'bg-trilha text-tinta-apoio',
}
const PILULA_GRAU = ['bg-alerta-conforme text-conforme', 'bg-alerta-conforme text-conforme', 'bg-alerta-atencao text-atencao',
  'bg-alerta-critico text-critico', 'bg-critico/15 font-bold text-critico', 'bg-tinta text-white']
function Pilula({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap', className)}>{children}</span>
}

function Sugestoes<T>({ itens, chave, rotulo, sub, usar }: {
  itens: T[]; chave: (x: T) => string; rotulo: (x: T) => string; sub?: (x: T) => string; usar: (x: T) => void
}) {
  if (itens.length === 0) return null
  return (
    <div className="relative z-30 h-0">
      <div role="listbox" className="absolute inset-x-0 top-1 max-h-60 overflow-y-auto rounded-controle border border-fio bg-superficie shadow-lg">
        {itens.map((x) => (
          <button key={chave(x)} type="button" role="option" aria-selected={false} onClick={() => usar(x)}
            className="flex w-full items-baseline gap-2.5 border-b border-trilha px-3 py-2 text-left last:border-0 hover:bg-campo">
            <span className="text-controle text-tinta">{rotulo(x)}</span>
            {sub && <span className="text-rotulo text-tinta-sussurro">{sub(x)}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── o painel ─────────────────────────────────────────────────────────────────
type Registro = {
  chave: string // 'a:<id>' | 'e:<id>'
  categoria: string // tipo da alergia ou 'evento'
  ativo: boolean
  titulo: string
  pilula: { texto: string; classe: string }
  sub: string
  meta: string
  evento?: EventoAdverso
  busca: string
}

function registrosDe(p: PainelAlergias): Registro[] {
  const r: Registro[] = []
  for (const a of p.alergias) {
    r.push({
      chave: `a:${a.id}`, categoria: a.tipo, ativo: !a.inativada_em, titulo: a.substancia,
      pilula: { texto: rotuloGravidade(a.gravidade), classe: PILULA_GRAVIDADE[a.gravidade] ?? PILULA_GRAVIDADE.desconhecida },
      sub: [rotuloTipo(a.tipo), rotuloGravidade(a.gravidade), a.reacao].filter(Boolean).join(' · '),
      meta: a.inativada_em
        ? `Inativada em ${quando(a.inativada_em)} por ${a.inativada_por ?? '—'} (${a.motivo_inativacao}) · incluída em ${quando(a.registrado_em)}`
        : `Incluída em ${quando(a.registrado_em)} por ${a.autor ?? '—'}`,
      busca: normalizar([a.substancia, a.reacao, a.autor, a.inativada_por].join(' ')),
    })
  }
  for (const e of p.eventos) {
    r.push({
      chave: `e:${e.id}`, categoria: 'evento', ativo: !e.inativado_em, titulo: e.evento, evento: e,
      pilula: { texto: rotuloGrau(e.grau), classe: PILULA_GRAU[e.grau - 1] ?? PILULA_GRAU[0] },
      sub: ['Evento adverso', rotuloGrau(e.grau), e.item_descricao, e.observacao].filter(Boolean).join(' · '),
      meta: e.inativado_em
        ? `Inativado em ${quando(e.inativado_em)} por ${e.inativado_por ?? '—'} (${e.motivo_inativacao})`
        : `Último grau em ${quando(e.grau_em)} · incluído por ${e.autor ?? '—'}`,
      busca: normalizar([e.evento, e.item_descricao, e.observacao, e.autor, ...(e.graus ?? []).map((g) => g.autor)].join(' ')),
    })
  }
  return r
}

export function AlergiasEventos({ pacienteId }: { pacienteId: string }) {
  const q = useAlergias(pacienteId)
  const recarregar = useRecarregarAlergias(pacienteId)
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [aberto, setAberto] = React.useState<'nova' | 'evento' | null>(null)
  const [busca, setBusca] = React.useState('')
  const [filtros, setFiltros] = React.useState<Record<string, boolean>>({})
  const [sel, setSel] = React.useState<Record<string, boolean>>({})
  const [inativando, setInativando] = React.useState<'sel' | 'tudo' | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [hist, setHist] = React.useState<Record<string, boolean>>({})
  const [histNega, setHistNega] = React.useState(false)
  const [ocupado, setOcupado] = React.useState(false)

  const executar = async (fn: () => PromiseLike<{ error: unknown }>, ok?: string) => {
    setOcupado(true)
    try {
      const { error } = await fn()
      if (error) { setErro(msg(error)); setAviso(null); return false }
      setErro(null); setAviso(ok ?? null); recarregar(); return true
    } finally { setOcupado(false) }
  }

  if (q.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (q.error || !q.data) return <p className="rounded-controle border border-critico/30 bg-alerta-critico p-3 text-apoio text-critico">{q.error ? msg(q.error) : 'Sem dados.'}</p>

  const p = q.data
  const listaAtivas = ativas(p)
  const nega = negaVigente(p)
  const regs = registrosDe(p)
  const categorias = [
    ['evento', 'Eventos adversos'] as const,
    ...TIPOS_ALERGIA.map((t) => [t.valor, t.rotulo] as const),
  ].map(([k, l]) => ({ k, l, n: regs.filter((r) => r.categoria === k).length })).filter((c) => c.n > 0)
  const algumFiltro = Object.values(filtros).some(Boolean)
  const termo = normalizar(busca)
  const visiveis = regs
    .filter((r) => (!algumFiltro || filtros[r.categoria]) && (!termo || r.busca.includes(termo)))
    .sort((x, y) => Number(y.ativo) - Number(x.ativo))
  const chavesAtivas = regs.filter((r) => r.ativo).map((r) => r.chave)
  const selecionadas = Object.keys(sel).filter((k) => sel[k] && chavesAtivas.includes(k))
  const alvo = inativando === 'tudo' ? chavesAtivas : selecionadas

  async function inativar() {
    const ids = (pref: string) => alvo.filter((k) => k.startsWith(pref)).map((k) => k.slice(2))
    const ok = await executar(() => supabase.rpc('inativar_registros_alergia', {
      p_alergias: ids('a:'), p_eventos: ids('e:'), p_motivo: motivo,
    }), `${alvo.length === 1 ? '1 registro inativado' : `${alvo.length} registros inativados`}. Continuam no histórico.`)
    if (ok) { setInativando(null); setMotivo(''); setSel({}) }
  }

  return (
    <section className="flex flex-col gap-3 text-controle">
      {/* estado e situação */}
      <div className="flex flex-wrap items-center gap-2.5">
        <SeloAlergia pacienteId={pacienteId} />
        {nega && (
          <Pilula className="bg-alerta-conforme text-conforme">
            Nega alergias · {quando(nega.registrado_em)}{nega.autor ? ` · ${nega.autor}` : ''}
          </Pilula>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={aberto === 'nova' ? 'default' : 'outline'} onClick={() => setAberto(aberto === 'nova' ? null : 'nova')}>+ Nova alergia</Button>
        <Button size="sm" variant={aberto === 'evento' ? 'default' : 'outline'} onClick={() => setAberto(aberto === 'evento' ? null : 'evento')}>+ Evento adverso</Button>
        <Button size="sm" variant="outline" disabled={ocupado || listaAtivas.length > 0}
          title={listaAtivas.length > 0 ? 'Há alergia ativa: para registrar que nega, inative antes cada uma, com o motivo.' : undefined}
          onClick={() => void executar(() => supabase.rpc('registrar_nega_alergia', { p_paciente: pacienteId }),
            nega ? '"Nega alergias" reconfirmado agora.' : '"Nega alergias" registrado.')}>
          <ShieldCheck /> {nega ? 'Reconfirmar: nega alergias' : 'Nega alergias'}
        </Button>
      </div>
      {listaAtivas.length > 0 && (
        <p className="text-rotulo text-tinta-sussurro">"Nega alergias" só é aceito sem alergia ativa: inative antes, com o motivo.</p>
      )}

      {erro && <p role="alert" className="rounded-controle border border-critico/30 bg-alerta-critico p-2.5 text-apoio text-critico">{erro}</p>}
      {aviso && <p role="status" className="rounded-controle border border-conforme/30 bg-alerta-conforme p-2.5 text-apoio text-conforme">{aviso}</p>}

      {aberto === 'nova' && (
        <NovaAlergia pacienteId={pacienteId} ocupado={ocupado} executar={executar} fechar={() => setAberto(null)} />
      )}
      {aberto === 'evento' && (
        <NovoEvento pacienteId={pacienteId} ocupado={ocupado} executar={executar} fechar={() => setAberto(null)} />
      )}

      {/* busca e filtros */}
      {regs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <Input className="min-w-0 flex-[1_1_200px]" placeholder="Pesquisar: descrição, autor, item de prescrição" aria-label="Pesquisar"
            value={busca} onChange={(e) => setBusca(e.target.value)} />
          {categorias.length > 1 && categorias.map((c) => (
            <Chip key={c.k} on={!!filtros[c.k]} onClick={() => setFiltros({ ...filtros, [c.k]: !filtros[c.k] })}>{c.l} ({c.n})</Chip>
          ))}
        </div>
      )}

      {/* lista */}
      <div className="flex flex-col gap-2">
        {visiveis.map((r) => (
          <div key={r.chave} className={cn('flex flex-col gap-1.5 rounded-[10px] border px-3 py-2.5',
            r.ativo ? 'border-fio bg-superficie' : 'border-trilha bg-campo opacity-75')}>
            <div className="flex flex-wrap items-center gap-2.5">
              {r.ativo && (
                <input type="checkbox" className="size-4 accent-[var(--color-acao)]" aria-label={`Selecionar ${r.titulo}`}
                  checked={!!sel[r.chave]} onChange={() => setSel({ ...sel, [r.chave]: !sel[r.chave] })} />
              )}
              <span className="min-w-0 flex-[1_1_160px] text-controle font-semibold text-tinta">{r.titulo}</span>
              <Pilula className={r.pilula.classe}>{r.pilula.texto}</Pilula>
              {!r.ativo && <span className="text-rotulo font-semibold text-tinta-sussurro">Inativo</span>}
            </div>
            <span className="text-apoio text-tinta-apoio [text-wrap:pretty]">{r.sub}</span>
            <span className="text-rotulo text-tinta-sussurro">{r.meta}</span>
            {r.evento && r.ativo && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-rotulo text-tinta-apoio">Evoluir grau:</span>
                {GRAUS_EVENTO.map((g, i) => (
                  <Chip key={g} on={r.evento!.grau === i + 1} disabled={ocupado}
                    onClick={() => { if (r.evento!.grau !== i + 1) void executar(() => supabase.rpc('evoluir_grau_evento', { p_evento: r.evento!.id, p_grau: i + 1 }), `Grau evoluído para ${g}.`) }}>
                    {g}
                  </Chip>
                ))}
              </div>
            )}
            {r.evento && (
              <>
                <button type="button" onClick={() => setHist({ ...hist, [r.chave]: !hist[r.chave] })}
                  className="self-start text-rotulo text-acao hover:text-acao-pressionada">
                  <History className="mr-1 inline size-3" aria-hidden />{hist[r.chave] ? 'Ocultar histórico do evento' : 'Histórico do evento'}
                </button>
                {hist[r.chave] && (
                  <ul className="flex flex-col gap-0.5 text-rotulo text-tinta-apoio">
                    {(r.evento.graus ?? []).map((g, j) => (
                      <li key={j}>{j === 0 ? 'Inclusão' : 'Evolução'} · {rotuloGrau(g.grau)} · {quando(g.registrado_em)} · {g.autor ?? '—'}</li>
                    ))}
                    {r.evento.inativado_em && <li>Inativado · {quando(r.evento.inativado_em)} · {r.evento.inativado_por ?? '—'}</li>}
                  </ul>
                )}
              </>
            )}
          </div>
        ))}
        {visiveis.length === 0 && (
          <span className="text-apoio text-tinta-sussurro">
            {regs.length ? 'Nenhum registro com esses filtros.' : 'Nenhuma alergia ou evento adverso registrado.'}
          </span>
        )}
      </div>

      {/* inativar selecionados / tudo */}
      {chavesAtivas.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="destructive" disabled={selecionadas.length === 0 || ocupado}
              onClick={() => { setInativando('sel'); setMotivo('') }}>
              Inativar selecionados{selecionadas.length ? ` (${selecionadas.length})` : ''}
            </Button>
            <Button size="sm" variant="destructive" disabled={ocupado} onClick={() => { setInativando('tudo'); setMotivo('') }}>Inativar tudo</Button>
            {/* Onda 6 (folhas e assinatura): "Imprimir" (folha de alergias e eventos
                adversos, montarAlgHtml do protótipo) e "Assinar" (retrato assinado;
                mudança depois deixa pendência de assinatura) entram aqui. */}
          </div>
          {inativando && alvo.length > 0 && (
            <div className="flex flex-col gap-2 rounded-controle border border-critico/30 bg-alerta-critico p-2.5">
              <span className="text-apoio text-critico">
                Inativar {alvo.length} {alvo.length === 1 ? 'registro ativo' : 'registros ativos'}? Continuam no histórico; diga por quê.
              </span>
              <Input aria-label="Motivo da inativação" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <div className="flex gap-1.5">
                <Button size="sm" variant="destructive" disabled={motivo.trim().length < 10 || ocupado} onClick={() => void inativar()}>Confirmar</Button>
                <Button size="sm" variant="ghost" onClick={() => setInativando(null)}>Não</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* histórico do "nega" */}
      {p.negacoes.length > 0 && (
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => setHistNega(!histNega)} className="self-start text-rotulo text-acao hover:text-acao-pressionada">
            <History className="mr-1 inline size-3" aria-hidden />{histNega ? 'Ocultar histórico de "nega alergias"' : `Histórico de "nega alergias" (${p.negacoes.length})`}
          </button>
          {histNega && (
            <ul className="flex flex-col gap-0.5 text-rotulo text-tinta-apoio">
              {p.negacoes.map((n) => (
                <li key={n.id}>
                  Nega alergias · {quando(n.registrado_em)} · {n.autor ?? '—'}
                  {n.encerrada_em ? ` — encerrado em ${quando(n.encerrada_em)} por ${n.encerrada_por ?? '—'} (${n.motivo_encerramento})` : ' — vigente'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

type Executar = (fn: () => PromiseLike<{ error: unknown }>, ok?: string) => Promise<boolean>

// ── nova alergia ─────────────────────────────────────────────────────────────
function NovaAlergia({ pacienteId, ocupado, executar, fechar }: { pacienteId: string; ocupado: boolean; executar: Executar; fechar: () => void }) {
  const vazio = { tipo: null as TipoAlergia | null, gravidade: null as GravidadeAlergia | null, sub: '', obs: '', medicamentoId: null as string | null, classe: false }
  const [f, setF] = React.useState(vazio)
  const [focado, setFocado] = React.useState(false)
  const termo = normalizar(f.sub)

  const doCatalogo = termo.length >= 1 && focado
    ? ALERGENOS.filter((a) => (!f.tipo || a.tipo === f.tipo) && normalizar(a.nome + ' ' + a.sub).includes(termo) && normalizar(a.nome) !== termo).slice(0, 8)
    : []
  const doCadastro = useQuery({
    queryKey: ['alergia-busca-medicamento', termo],
    enabled: focado && termo.length >= 3 && (!f.tipo || f.tipo === 'medicamento') && !f.medicamentoId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('medicamento').select('id, principio_ativo')
        .eq('ativo', true).ilike('principio_ativo', `%${f.sub.trim()}%`).order('principio_ativo').limit(8)
      if (error) throw error
      // um princípio ativo por nome (o cadastro repete por apresentação)
      const vistos = new Set<string>()
      return (data ?? []).filter((m) => (vistos.has(m.principio_ativo) ? false : (vistos.add(m.principio_ativo), true)))
    },
  })
  const sugestoes = [
    ...doCatalogo.map((a) => ({ k: `c:${a.nome}`, nome: a.nome, sub: a.sub, tipo: a.tipo, medicamentoId: null as string | null, classe: !!a.classe })),
    ...(doCadastro.data ?? []).filter((m) => normalizar(m.principio_ativo) !== termo)
      .map((m) => ({ k: `m:${m.id}`, nome: m.principio_ativo, sub: 'cadastro de medicamentos', tipo: 'medicamento' as TipoAlergia, medicamentoId: m.id, classe: false })),
  ]
  const ok = !!f.tipo && !!f.gravidade && f.sub.trim().length >= 3

  async function inserir(eNovo: boolean) {
    if (!ok) return
    const feito = await executar(() => supabase.rpc('registrar_alergia', {
      p_paciente: pacienteId, p_substancia: f.sub.trim(), p_reacao: f.obs.trim() || undefined,
      p_tipo: f.tipo!, p_gravidade: f.gravidade!, p_medicamento: f.medicamentoId ?? undefined,
    }), `Alergia a ${f.sub.trim()} registrada.`)
    if (!feito) return
    setF(vazio)
    if (!eNovo) fechar()
  }

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-fio bg-campo p-3">
      <span className="text-apoio font-semibold text-tinta">Nova alergia · tipo, gravidade e substância são obrigatórios</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo">
        {TIPOS_ALERGIA.map((t) => (
          <Chip key={t.valor} on={f.tipo === t.valor}
            onClick={() => setF({ ...f, tipo: t.valor, medicamentoId: t.valor === 'medicamento' ? f.medicamentoId : null })}>{t.rotulo}</Chip>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Gravidade">
        {GRAVIDADES.map((g) => <Chip key={g.valor} on={f.gravidade === g.valor} onClick={() => setF({ ...f, gravidade: g.valor })}>{g.rotulo}</Chip>)}
      </div>
      <div>
        <Input aria-label="Substância" placeholder="Substância, alimento ou outra, ex.: penicilina" value={f.sub}
          onFocus={() => setFocado(true)} onBlur={() => window.setTimeout(() => setFocado(false), 150)}
          onChange={(e) => setF({ ...f, sub: e.target.value, medicamentoId: null, classe: false })} />
        <Sugestoes itens={sugestoes} chave={(s) => s.k} rotulo={(s) => s.nome} sub={(s) => s.sub}
          usar={(s) => { setF({ ...f, sub: s.nome, tipo: s.tipo, medicamentoId: s.medicamentoId, classe: s.classe }); setFocado(false) }} />
      </div>
      {f.medicamentoId && <span className="text-rotulo text-conforme">Ligada ao cadastro de medicamentos.</span>}
      {f.classe && (
        <span className="text-rotulo text-tinta-sussurro [text-wrap:pretty]">
          Classe de medicamentos: a prescrição trava todos os princípios ativos da classe (grupo ATC da OMS). Outra classe
          com reação cruzada (ex.: cefalosporinas para quem tem alergia a penicilinas) não trava sozinha: registre à parte se for o caso.
        </span>
      )}
      <Input aria-label="Observação" placeholder="Observação: reação apresentada, quando, quem informou" value={f.obs}
        onChange={(e) => setF({ ...f, obs: e.target.value })} />
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button size="sm" variant="outline" disabled={!ok || ocupado} onClick={() => void inserir(true)}>Inserir e novo</Button>
        <Button size="sm" disabled={!ok || ocupado} onClick={() => void inserir(false)}>Inserir</Button>
      </div>
    </div>
  )
}

// ── evento adverso ───────────────────────────────────────────────────────────
type ItemPrescricao = { id: string; tipo: string; descricao: string; dose: string | null; via: string | null }

function NovoEvento({ pacienteId, ocupado, executar, fechar }: { pacienteId: string; ocupado: boolean; executar: Executar; fechar: () => void }) {
  const vazio = { item: null as string | null, evento: '', grau: null as number | null, obs: '' }
  const [f, setF] = React.useState(vazio)
  const [focado, setFocado] = React.useState(false)
  const itens = useQuery({
    queryKey: ['prescricao-vigente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ItemPrescricao[]
    },
  })
  const termo = normalizar(f.evento)
  const sugestoes = focado && termo ? EVENTOS_COMUNS.filter((e) => normalizar(e).includes(termo) && normalizar(e) !== termo).slice(0, 8) : []
  const ok = f.evento.trim().length >= 3 && !!f.grau
  const itensMed = (itens.data ?? []).filter((i) => i.tipo === 'medicamento')

  async function inserir(eNovo: boolean) {
    if (!ok) return
    const feito = await executar(() => supabase.rpc('registrar_evento_adverso', {
      p_paciente: pacienteId, p_evento: f.evento.trim(), p_grau: f.grau!, p_item: f.item ?? undefined, p_observacao: f.obs.trim() || undefined,
    }), `Evento adverso "${f.evento.trim()}" registrado.`)
    if (!feito) return
    setF(vazio)
    if (!eNovo) fechar()
  }

  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-fio bg-campo p-3">
      <span className="text-apoio font-semibold text-tinta">Evento adverso · item de prescrição, evento e grau</span>
      <span className="text-rotulo text-tinta-apoio">Item da prescrição (quando houver)</span>
      <div className="flex flex-wrap gap-1.5">
        {itens.isLoading && <Spinner className="size-4" />}
        {itensMed.map((i) => (
          <Chip key={i.id} on={f.item === i.id} onClick={() => setF({ ...f, item: f.item === i.id ? null : i.id })}>
            {i.descricao}{i.dose ? ` — ${i.dose}` : ''}{i.via ? ` · ${i.via}` : ''}
          </Chip>
        ))}
        {itens.error && <span className="text-apoio text-tinta-sussurro">Prescrição indisponível para você: o evento fica sem item.</span>}
        {itens.data && itensMed.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum medicamento na prescrição vigente.</span>}
      </div>
      <div>
        <Input aria-label="Evento adverso" placeholder="Evento adverso, ex.: cefaleia, exantema" value={f.evento}
          onFocus={() => setFocado(true)} onBlur={() => window.setTimeout(() => setFocado(false), 150)}
          onChange={(e) => setF({ ...f, evento: e.target.value })} />
        <Sugestoes itens={sugestoes} chave={(s) => s} rotulo={(s) => s} usar={(s) => { setF({ ...f, evento: s }); setFocado(false) }} />
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Grau">
        {GRAUS_EVENTO.map((g, i) => <Chip key={g} on={f.grau === i + 1} onClick={() => setF({ ...f, grau: i + 1 })}>{g}</Chip>)}
      </div>
      <Input aria-label="Observação do evento" placeholder="Observação (opcional)" value={f.obs} onChange={(e) => setF({ ...f, obs: e.target.value })} />
      <div className="flex flex-wrap justify-end gap-1.5">
        <Button size="sm" variant="outline" disabled={!ok || ocupado} onClick={() => void inserir(true)}>Inserir e novo</Button>
        <Button size="sm" disabled={!ok || ocupado} onClick={() => void inserir(false)}>Inserir</Button>
      </div>
    </div>
  )
}
