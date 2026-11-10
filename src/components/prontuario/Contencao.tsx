import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Printer, ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { rass } from '@/clinico/escores/rass'
import type { OpcaoEscolha } from '@/clinico/escore'
import { DialogoIntercorrencia } from '@/components/prontuario/Intercorrencias'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  FONTES_CONTENCAO, LOCAIS, PAPEL_CONTENCAO, duracaoContencao, revisoesVigentes, rotuloLocais, rotuloPontos, rotuloRass, selosDaContencao,
  type Contencao as RegistroContencao, type LocalContencao, type RevisaoContencao, type TelaContencao,
} from '@/lib/contencao'
import { fmtDataHora } from '@/lib/datas'
import { hora } from '@/lib/formato'
import { vigentes, type Intercorrencia } from '@/lib/intercorrencia'
import { imprimirRelatorio } from '@/lib/prontuario'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Contenção mecânica (lacuna 4; RT 10/11/2026, A em K1 a K10; migration
// 20270325000001). Enfermeiro ou médico inicia; enfermeiro e técnico revisam
// (no máximo a cada 1 hora) e retiram; o médico prescreve no item "Contenção
// mecânica" da prescrição e renova a cada 24 horas. Os prazos e os selos vêm
// do servidor. Sinais vitais ficam como foram escritos.

const OPCOES_RASS = (rass.itens[0] as { opcoes: OpcaoEscolha[] }).opcoes

/** "2026-11-10T14:05" na hora local, para o campo datetime-local. */
function agoraLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
/** Relógio da tela (anda sozinho a cada 30 s). */
function useAgora() {
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  return agora
}
const paraIso = (local: string) => (local ? new Date(local).toISOString() : null)
const msg = (e: unknown) => (e as { message?: string })?.message ?? String(e)

function useTelaContencao(pacienteId: string) {
  return useQuery({
    queryKey: ['contencao', pacienteId],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contencao_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as TelaContencao
    },
  })
}

function useAtualizar(pacienteId: string) {
  const qc = useQueryClient()
  return () => {
    for (const k of [['contencao', pacienteId], ['contencoes-ativas'], ['prescricao-vigente', pacienteId], ['intercorrencias', pacienteId]]) {
      void qc.invalidateQueries({ queryKey: k })
    }
  }
}

/** Os selos do servidor como pílulas. */
export function SelosContencao({ c, className }: { c: Parameters<typeof selosDaContencao>[0]; className?: string }) {
  const selos = selosDaContencao(c)
  if (!selos.length) return null
  return (
    <span className={cn('flex flex-wrap gap-1.5', className)}>
      {selos.map((s) => <Badge key={s.texto} variant={s.tom === 'critico' ? 'destructive' : 'warning'}>{s.texto}</Badge>)}
    </span>
  )
}

type Dialogo = { tipo: 'iniciar' } | { tipo: 'revisar'; retifica: RevisaoContencao | null } | { tipo: 'retirar' } | { tipo: 'familia' }

/**
 * O bloco da contenção no leito, na gaveta da enfermagem e no atendimento:
 * a ativa (selos, ordem médica, revisões, família) com as ações de quem pode,
 * e as anteriores. Sem contenção e sem poder iniciar, não aparece.
 */
export function Contencao({ pacienteId }: { pacienteId: string }) {
  const tela = useTelaContencao(pacienteId)
  const [dialogo, setDialogo] = React.useState<Dialogo | null>(null)
  const [verAnteriores, setVerAnteriores] = React.useState(false)
  const t = tela.data
  if (!t || (!t.ativa && !t.anteriores.length && !t.pode_iniciar)) return null
  const c = t.ativa

  return (
    <section aria-label="Contenção mecânica" className="flex flex-col gap-1.5">
      {c ? (
        <CartaoContencao c={c} tela={t} aoDialogo={setDialogo} />
      ) : t.pode_iniciar ? (
        <div>
          <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: 'iniciar' })}><ShieldAlert /> Iniciar contenção mecânica</Button>
        </div>
      ) : null}
      {t.anteriores.length > 0 && (
        <div className="flex flex-col gap-1">
          <Button variant="link" size="xs" className="min-h-0 self-start px-0 text-tinta-sussurro underline hover:text-acao"
            aria-expanded={verAnteriores} onClick={() => setVerAnteriores(!verAnteriores)}>
            {t.anteriores.length === 1 ? '1 contenção anterior' : `${t.anteriores.length} contenções anteriores`}
          </Button>
          {verAnteriores && t.anteriores.map((a) => <ContencaoAnterior key={a.id} c={a} />)}
        </div>
      )}
      {dialogo?.tipo === 'iniciar' && <DialogoIniciar pacienteId={pacienteId} pediatrico={t.pediatrico} aoFechar={() => setDialogo(null)} />}
      {c && dialogo?.tipo === 'revisar' && (
        <DialogoRevisao pacienteId={pacienteId} c={c} retifica={dialogo.retifica} aoFechar={() => setDialogo(null)} />
      )}
      {c && dialogo?.tipo === 'retirar' && <DialogoRetirar pacienteId={pacienteId} c={c} aoFechar={() => setDialogo(null)} />}
      {c && dialogo?.tipo === 'familia' && <DialogoFamilia pacienteId={pacienteId} c={c} aoFechar={() => setDialogo(null)} />}
    </section>
  )
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return <span className="text-tinta"><span className="text-tinta-sussurro">{rotulo}: </span>{children}</span>
}

function CartaoContencao({ c, tela, aoDialogo }: { c: RegistroContencao; tela: TelaContencao; aoDialogo: (d: Dialogo) => void }) {
  const revisoes = c.lista_revisoes ?? []
  const vig = revisoesVigentes(revisoes)
  const [verTodas, setVerTodas] = React.useState(false)
  const agora = useAgora()
  const mostradas = verTodas ? [...revisoes].sort((a, b) => b.revisada_em.localeCompare(a.revisada_em)) : vig.slice(0, 3)
  return (
    <div role="note" className="flex flex-col gap-1.5 rounded-container border border-critico/30 bg-superficie px-3 py-2 text-apoio">
      <div className="flex flex-wrap items-center gap-2">
        <ShieldAlert className="size-4 shrink-0 text-critico" aria-hidden />
        <strong className="font-semibold text-tinta">Contenção mecânica · {rotuloPontos(c.pontos)}</strong>
        {c.pediatrico && <Badge variant="info">paciente pediátrico</Badge>}
        <span className="text-tinta-apoio">desde {hora(c.iniciada_em)} ({duracaoContencao(c.iniciada_em, null, agora)})</span>
        <SelosContencao c={c} />
      </div>
      <Linha rotulo="Locais">{rotuloLocais(c.locais)}</Linha>
      <Linha rotulo="Motivo">{c.motivo}</Linha>
      <Linha rotulo="Alternativas tentadas">{c.alternativas}</Linha>
      <span className="text-rotulo text-tinta-sussurro">
        Iniciada por {c.iniciada_por ?? '—'} ({PAPEL_CONTENCAO[c.papel_inicio] ?? c.papel_inicio}), {fmtDataHora(c.iniciada_em)}
      </span>
      {c.prescricao && !c.prescricao.suspenso_em ? (
        <span className="text-tinta">
          <span className="text-tinta-sussurro">Prescrição: </span>{c.prescricao.descricao}. {c.prescricao.observacao}
          <span className="text-tinta-sussurro"> ({c.prescricao.medico ?? '—'}, {fmtDataHora(c.prescricao.prescrita_em)}; vale até {c.prescricao_vence_em ? fmtDataHora(c.prescricao_vence_em) : '—'})</span>
        </span>
      ) : (
        <span className="text-critico">Sem prescrição médica: o médico de plantão foi avisado. A prescrição é o item "Contenção mecânica" da prescrição.</span>
      )}
      <span className="text-tinta">
        <span className="text-tinta-sussurro">Revisão da enfermagem: </span>
        {c.ultima_revisao_em ? `última às ${hora(c.ultima_revisao_em)}` : 'nenhuma ainda'}
        {c.proxima_revisao_em && <>; a próxima até <strong className={cn(c.revisao_atrasada && 'text-critico')}>{hora(c.proxima_revisao_em)}</strong></>}
      </span>
      <span className="text-tinta">
        <span className="text-tinta-sussurro">Família: </span>
        {c.familia_informada == null ? 'não registrado' : `${c.familia_informada ? 'informada' : 'não informada'} (${c.familia_detalhe}${c.familia_em ? `, ${fmtDataHora(c.familia_em)}` : ''})`}
      </span>
      <div className="flex flex-wrap gap-1.5 pt-1">
        {tela.pode_revisar && <Button size="sm" onClick={() => aoDialogo({ tipo: 'revisar', retifica: null })}>Registrar revisão</Button>}
        {tela.pode_retirar && <Button size="sm" variant="outline" onClick={() => aoDialogo({ tipo: 'familia' })}>Família</Button>}
        {tela.pode_retirar && <Button size="sm" variant="outline" onClick={() => aoDialogo({ tipo: 'retirar' })}>Retirar contenção</Button>}
        <BotaoImprimir c={c} />
      </div>
      {revisoes.length > 0 && (
        <div className="flex flex-col gap-1 pt-1">
          <span className="text-rotulo font-semibold uppercase tracking-[0.04em] text-tinta-sussurro">Revisões ({vig.length})</span>
          {mostradas.map((r) => <LinhaRevisao key={r.id} r={r} podeRetificar={tela.pode_revisar && !r.retificada} aoRetificar={() => aoDialogo({ tipo: 'revisar', retifica: r })} />)}
          {(vig.length > 3 || revisoes.length > vig.length) && (
            <Button variant="link" size="xs" className="min-h-0 self-start px-0 text-tinta-sussurro underline hover:text-acao" onClick={() => setVerTodas(!verTodas)}>
              {verTodas ? 'Mostrar só as últimas' : 'Ver todas, com as retificadas'}
            </Button>
          )}
        </div>
      )}
      <span className="text-rotulo text-tinta-sussurro">{FONTES_CONTENCAO}</span>
    </div>
  )
}

function LinhaRevisao({ r, podeRetificar, aoRetificar }: { r: RevisaoContencao; podeRetificar: boolean; aoRetificar: () => void }) {
  return (
    <div className={cn('flex flex-col gap-0.5 border-l-2 border-fio pl-2', r.retificada && 'text-tinta-sussurro line-through decoration-tinta-sussurro/40')}>
      <span className="flex flex-wrap items-center gap-2">
        <strong className="font-medium">{hora(r.revisada_em)}</strong>
        <span>{r.consciencia}{r.rass != null ? ` · RASS ${rotuloRass(r.rass)}` : ''}</span>
        {r.retifica_id && !r.retificada && <Badge variant="secondary">retificação</Badge>}
        {podeRetificar && <Button size="xs" variant="ghost" className="ml-auto" onClick={aoRetificar}>Retificar</Button>}
      </span>
      <span>Sinais vitais: {r.sinais_vitais}</span>
      <span>Pele: {r.pele} · Perfusão: {r.perfusao}</span>
      {r.necessidades && <span>Necessidades: {r.necessidades}</span>}
      {r.intercorrencia && <span className="text-critico">Intercorrência: {r.intercorrencia}</span>}
      {r.observacao && <span>{r.observacao}</span>}
      <span className="text-rotulo text-tinta-sussurro">{r.registrado_por ?? '—'} ({PAPEL_CONTENCAO[r.papel] ?? r.papel}), {fmtDataHora(r.registrado_em)}</span>
    </div>
  )
}

function BotaoImprimir({ c }: { c: RegistroContencao }) {
  return (
    <Button size="sm" variant="ghost" onClick={() => void imprimirRelatorio({ tipo: 'contencao', pacienteId: c.paciente_id, ids: [c.id] })}>
      <Printer /> Imprimir registro
    </Button>
  )
}

function ContencaoAnterior({ c }: { c: RegistroContencao }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-controle border border-fio bg-superficie px-3 py-2 text-apoio">
      <span className="flex flex-wrap items-center gap-2">
        <strong className="font-medium text-tinta">{rotuloPontos(c.pontos)} · {fmtDataHora(c.iniciada_em)}</strong>
        {c.pediatrico && <Badge variant="info">paciente pediátrico</Badge>}
        <span className="text-tinta-apoio">{c.retirada_em ? `por ${duracaoContencao(c.iniciada_em, c.retirada_em, 0)}` : ''}</span>
        <span className="ml-auto"><BotaoImprimir c={c} /></span>
      </span>
      <span className="text-tinta">{c.motivo}</span>
      <span className="text-tinta-apoio">
        Retirada {c.retirada_em ? fmtDataHora(c.retirada_em) : '—'}: {c.motivo_retirada}{c.retirada_por ? ` (${c.retirada_por})` : ''} · {c.revisoes} {c.revisoes === 1 ? 'revisão' : 'revisões'}
      </span>
    </div>
  )
}

// ── janelas ─────────────────────────────────────────────────────────────────

function Janela({ titulo, descricao, children, aoFechar }: { titulo: string; descricao: string; children: React.ReactNode; aoFechar: () => void }) {
  return (
    <Dialog open onOpenChange={(v) => { if (!v) aoFechar() }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-dialogo">{titulo}</DialogTitle>
          <DialogDescription className="text-controle">{descricao}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

function Campo({ id, rotulo, children }: { id: string; rotulo: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><Label htmlFor={id}>{rotulo}</Label>{children}</div>
}

function Rodape({ erro, pronto, ocupado, rotulo, aoFechar, aoConfirmar }: {
  erro: unknown; pronto: boolean; ocupado: boolean; rotulo: string; aoFechar: () => void; aoConfirmar: () => void
}) {
  return (
    <>
      {!!erro && <p role="alert" className="text-apoio text-critico">{msg(erro)}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={aoFechar}>Cancelar</Button>
        <Button disabled={!pronto || ocupado} onClick={aoConfirmar}>{rotulo}</Button>
      </div>
    </>
  )
}

function DialogoIniciar({ pacienteId, pediatrico, aoFechar }: { pacienteId: string; pediatrico: boolean; aoFechar: () => void }) {
  const atualizar = useAtualizar(pacienteId)
  const [motivo, setMotivo] = React.useState('')
  const [alternativas, setAlternativas] = React.useState('')
  const [locais, setLocais] = React.useState<LocalContencao[]>([])
  const [quando, setQuando] = React.useState(agoraLocal)
  const [familia, setFamilia] = React.useState<'' | 'sim' | 'nao'>('')
  const [familiaDetalhe, setFamiliaDetalhe] = React.useState('')
  const iniciar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('iniciar_contencao', {
        p_paciente: pacienteId,
        p_dados: {
          motivo: motivo.trim(), alternativas: alternativas.trim(), locais, iniciada_em: paraIso(quando),
          ...(familia ? { familia_informada: familia === 'sim', familia_detalhe: familiaDetalhe.trim() } : {}),
        },
      })
      if (error) throw error
    },
    onSuccess: () => { atualizar(); aoFechar() },
  })
  const pronto = motivo.trim().length >= 10 && alternativas.trim().length >= 5 && locais.length > 0 && !!quando
    && (!familia || familiaDetalhe.trim().length >= 3)
  return (
    <Janela titulo="Iniciar contenção mecânica" aoFechar={aoFechar}
      descricao="Só quando é o único meio de prevenir dano imediato ou iminente, sob supervisão direta do enfermeiro (Resolução COFEN 746/2024). Sem prescrição, o médico de plantão é avisado na hora.">
      {pediatrico && <p className="text-apoio text-tinta-apoio">Paciente pediátrico: valem as mesmas regras; o registro fica marcado.</p>}
      <Campo id="cont-motivo" rotulo="Motivo (o dano que a contenção previne)">
        <Textarea id="cont-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      <Campo id="cont-alt" rotulo="Alternativas tentadas antes">
        <Textarea id="cont-alt" rows={2} value={alternativas} onChange={(e) => setAlternativas(e.target.value)} />
      </Campo>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-apoio font-medium text-tinta-apoio">Membros e locais contidos ({rotuloPontos(locais.length)})</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {LOCAIS.map((l) => (
            <CaixaMarcar key={l.valor} marcado={locais.includes(l.valor)}
              onChange={(m) => setLocais(m ? [...locais, l.valor] : locais.filter((x) => x !== l.valor))}>
              <span className="text-apoio text-tinta">{l.rotulo}</span>
            </CaixaMarcar>
          ))}
        </div>
      </fieldset>
      <Campo id="cont-quando" rotulo="Hora de início">
        <Input id="cont-quando" type="datetime-local" className="w-56" value={quando} onChange={(e) => setQuando(e.target.value)} />
      </Campo>
      <EscolhaFamilia familia={familia} setFamilia={setFamilia} detalhe={familiaDetalhe} setDetalhe={setFamiliaDetalhe} opcional />
      <Rodape erro={iniciar.error} pronto={pronto} ocupado={iniciar.isPending} rotulo="Iniciar contenção" aoFechar={aoFechar} aoConfirmar={() => iniciar.mutate()} />
    </Janela>
  )
}

function EscolhaFamilia({ familia, setFamilia, detalhe, setDetalhe, opcional = false }: {
  familia: '' | 'sim' | 'nao'; setFamilia: (v: '' | 'sim' | 'nao') => void; detalhe: string; setDetalhe: (v: string) => void; opcional?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-apoio font-medium text-tinta-apoio">Família informada{opcional ? ' (pode registrar depois)' : ''}</span>
      <div role="radiogroup" aria-label="Família informada" className="grid gap-1.5 sm:grid-cols-2">
        {([['sim', 'Sim'], ['nao', 'Não']] as const).map(([v, r]) => (
          <BotaoLinha key={v} variante="cartao" role="radio" aria-checked={familia === v} onClick={() => setFamilia(familia === v && opcional ? '' : v)}
            className={cn(familia === v && 'border-acao ring-1 ring-acao')}>
            <span className="text-apoio font-medium text-tinta">{r}</span>
          </BotaoLinha>
        ))}
      </div>
      {familia && (
        <Input aria-label={familia === 'sim' ? 'Quem foi informado e como' : 'Por que não foi informada'} value={detalhe} onChange={(e) => setDetalhe(e.target.value)}
          placeholder={familia === 'sim' ? 'Quem foi informado e como (ex.: filha, por telefone)' : 'Por que não foi informada (ex.: sem acompanhante)'} />
      )}
    </div>
  )
}

function DialogoRevisao({ pacienteId, c, retifica, aoFechar }: { pacienteId: string; c: RegistroContencao; retifica: RevisaoContencao | null; aoFechar: () => void }) {
  const atualizar = useAtualizar(pacienteId)
  const [quando, setQuando] = React.useState(() => {
    if (!retifica) return agoraLocal()
    const d = new Date(retifica.revisada_em)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [f, setF] = React.useState({
    consciencia: retifica?.consciencia ?? '', rass: retifica?.rass != null ? String(retifica.rass) : '',
    sinais_vitais: retifica?.sinais_vitais ?? '', pele: retifica?.pele ?? '', perfusao: retifica?.perfusao ?? '',
    necessidades: retifica?.necessidades ?? '', intercorrencia_id: retifica?.intercorrencia_id ?? '', observacao: retifica?.observacao ?? '',
  })
  const [novaIntercorrencia, setNovaIntercorrencia] = React.useState(false)
  const inter = useQuery({
    queryKey: ['intercorrencias', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('intercorrencias_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as Intercorrencia[]
    },
  })
  // as intercorrências da contenção: as que ocorreram depois do início
  const daContencao = vigentes(inter.data ?? []).filter((x) => Date.parse(x.ocorrida_em) >= Date.parse(c.iniciada_em) - 5 * 60_000)
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('revisar_contencao', {
        p_contencao: c.id,
        p_dados: {
          revisada_em: paraIso(quando), consciencia: f.consciencia.trim(), rass: f.rass === '' ? null : Number(f.rass),
          sinais_vitais: f.sinais_vitais.trim(), pele: f.pele.trim(), perfusao: f.perfusao.trim(),
          necessidades: f.necessidades.trim() || null, intercorrencia_id: f.intercorrencia_id || null, observacao: f.observacao.trim() || null,
        },
        p_retifica: retifica?.id ?? undefined,
      })
      if (error) throw error
    },
    onSuccess: () => { atualizar(); aoFechar() },
  })
  const campo = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }) })
  const pronto = !!quando && f.consciencia.trim().length >= 3 && f.sinais_vitais.trim().length >= 3 && f.pele.trim().length >= 3 && f.perfusao.trim().length >= 3
  return (
    <Janela titulo={retifica ? 'Retificar revisão da contenção' : 'Revisão da contenção'} aoFechar={aoFechar}
      descricao={retifica ? 'A versão anterior fica guardada e visível como retificada.'
        : 'Consciência, sinais vitais, pele e circulação nos membros contidos, em intervalo de no máximo 1 hora (Nota Técnica ANVISA 07/2026).'}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="rev-quando" rotulo="Hora da revisão">
          <Input id="rev-quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
        </Campo>
        {!c.pediatrico ? (
          <Campo id="rev-rass" rotulo="RASS (opcional)">
            <CampoSelecao id="rev-rass" className="text-controle" {...campo('rass')}>
              <option value="">Não avaliado</option>
              {OPCOES_RASS.map((o) => <option key={o.valor} value={o.valor}>{o.rotulo}</option>)}
            </CampoSelecao>
          </Campo>
        ) : (
          <p className="self-end text-rotulo text-tinta-sussurro">Paciente pediátrico: o RASS do app é escala de adulto; descreva a consciência.</p>
        )}
      </div>
      <Campo id="rev-consc" rotulo="Consciência"><Input id="rev-consc" {...campo('consciencia')} /></Campo>
      <Campo id="rev-sv" rotulo="Sinais vitais (como aferidos)"><Input id="rev-sv" {...campo('sinais_vitais')} /></Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="rev-pele" rotulo="Pele nos locais contidos"><Input id="rev-pele" {...campo('pele')} /></Campo>
        <Campo id="rev-perf" rotulo="Circulação (perfusão) dos membros"><Input id="rev-perf" {...campo('perfusao')} /></Campo>
      </div>
      <Campo id="rev-nec" rotulo="Necessidades fisiológicas (opcional)"><Input id="rev-nec" {...campo('necessidades')} /></Campo>
      <Campo id="rev-inter" rotulo="Evento adverso ligado (intercorrência registrada)">
        <div className="flex flex-wrap items-center gap-2">
          <CampoSelecao id="rev-inter" className="min-w-0 flex-1 text-controle" {...campo('intercorrencia_id')}>
            <option value="">Nenhum</option>
            {daContencao.map((x) => <option key={x.id} value={x.id}>{x.tipo_rotulo} ({x.gravidade}), {fmtDataHora(x.ocorrida_em)}</option>)}
          </CampoSelecao>
          <Button size="sm" variant="outline" onClick={() => setNovaIntercorrencia(true)}>Registrar intercorrência</Button>
        </div>
      </Campo>
      <Campo id="rev-obs" rotulo="Observação (opcional)"><Textarea id="rev-obs" rows={2} {...campo('observacao')} /></Campo>
      <Rodape erro={salvar.error} pronto={pronto} ocupado={salvar.isPending} rotulo={retifica ? 'Retificar' : 'Registrar revisão'}
        aoFechar={aoFechar} aoConfirmar={() => salvar.mutate()} />
      {novaIntercorrencia && (
        <DialogoIntercorrencia pacienteId={pacienteId} episodioId={c.episodio_id} internacaoId={c.internacao_id} retifica={null}
          aoFechar={() => setNovaIntercorrencia(false)} />
      )}
    </Janela>
  )
}

function DialogoRetirar({ pacienteId, c, aoFechar }: { pacienteId: string; c: RegistroContencao; aoFechar: () => void }) {
  const atualizar = useAtualizar(pacienteId)
  const [motivo, setMotivo] = React.useState('')
  const [quando, setQuando] = React.useState(agoraLocal)
  const retirar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('retirar_contencao', { p_contencao: c.id, p_motivo: motivo.trim(), p_retirada_em: paraIso(quando) ?? undefined })
      if (error) throw error
    },
    onSuccess: () => { atualizar(); aoFechar() },
  })
  return (
    <Janela titulo="Retirar contenção" aoFechar={aoFechar}
      descricao="A contenção sai assim que os critérios que a justificaram deixam de existir. A ordem de contenção da prescrição é encerrada junto.">
      {c.prescricao?.observacao && <p className="text-apoio text-tinta-apoio">{c.prescricao.observacao}</p>}
      <Campo id="ret-motivo" rotulo="Motivo da retirada (critério atingido)">
        <Textarea id="ret-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Campo>
      <Campo id="ret-quando" rotulo="Hora da retirada">
        <Input id="ret-quando" type="datetime-local" className="w-56" value={quando} onChange={(e) => setQuando(e.target.value)} />
      </Campo>
      <Rodape erro={retirar.error} pronto={motivo.trim().length >= 5 && !!quando} ocupado={retirar.isPending} rotulo="Retirar"
        aoFechar={aoFechar} aoConfirmar={() => retirar.mutate()} />
    </Janela>
  )
}

function DialogoFamilia({ pacienteId, c, aoFechar }: { pacienteId: string; c: RegistroContencao; aoFechar: () => void }) {
  const atualizar = useAtualizar(pacienteId)
  const [familia, setFamilia] = React.useState<'' | 'sim' | 'nao'>(c.familia_informada == null ? '' : c.familia_informada ? 'sim' : 'nao')
  const [detalhe, setDetalhe] = React.useState(c.familia_detalhe ?? '')
  const gravar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('informar_familia_contencao', { p_contencao: c.id, p_informada: familia === 'sim', p_detalhe: detalhe.trim() })
      if (error) throw error
    },
    onSuccess: () => { atualizar(); aoFechar() },
  })
  return (
    <Janela titulo="Família" aoFechar={aoFechar} descricao="A família é informada da contenção (Nota Técnica ANVISA 07/2026). Fica com o seu nome e a hora.">
      <EscolhaFamilia familia={familia} setFamilia={setFamilia} detalhe={detalhe} setDetalhe={setDetalhe} />
      <Rodape erro={gravar.error} pronto={!!familia && detalhe.trim().length >= 3} ocupado={gravar.isPending} rotulo="Registrar"
        aoFechar={aoFechar} aoConfirmar={() => gravar.mutate()} />
    </Janela>
  )
}
