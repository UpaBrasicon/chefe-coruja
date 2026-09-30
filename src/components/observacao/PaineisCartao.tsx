// ─────────────────────────────────────────────────────────────────────────────
// Painéis que abrem embaixo do box (protótipo, index.html 3612–3693):
// reavaliar às, desfecho da observação, protocolo e passagem de plantão.
// Toda regra mora no servidor (migration 20261004000007); aqui só se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { PassagensDoPlantao } from '@/components/internacao/PassagensDoPlantao'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import { DESFECHOS, RELATO_DESFECHO, hhmm, rpc, type Acao, type Desfecho, type LinhaObservacao } from './modelo'

export function Painel({ titulo, children, erro }: { titulo?: React.ReactNode; children: React.ReactNode; erro?: string | null }) {
  return (
    <div className="mx-5 mb-3.5 flex flex-col gap-2.5 rounded-container border border-fio bg-campo px-3.5 py-3">
      {titulo && <span className="text-apoio font-semibold text-grafite">{titulo}</span>}
      {children}
      {erro && <span className="text-apoio text-critico">{erro}</span>}
    </div>
  )
}

/** Opção em cápsula, como os chips do protótipo. */
export function Opcao({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={ativa} onClick={onClick}
      className={cn('rounded-capsula border px-[11px] py-[5px] text-left text-apoio transition-colors',
        ativa ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
      {children}
    </button>
  )
}

/** Hora "HH:MM" de hoje; se já passou, o dia seguinte (reavaliação) ou o anterior (óbito). */
function horaDoDia(hm: string, sentido: 'futuro' | 'passado') {
  const [h, m] = hm.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  if (sentido === 'futuro' && d.getTime() < Date.now()) d.setDate(d.getDate() + 1)
  if (sentido === 'passado' && d.getTime() > Date.now() + 60_000) d.setDate(d.getDate() - 1)
  return d.toISOString()
}

// ── reavaliar às ────────────────────────────────────────────────────────────
export function PainelReavaliar({ linha, acao, fechar, erro }: { linha: LinhaObservacao; acao: Acao; fechar: () => void; erro: string | null }) {
  const [hora, setHora] = React.useState('')
  return (
    <Painel erro={erro}>
      <div className="flex flex-wrap items-end gap-2.5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`reav-${linha.internacao_id}`}>Reavaliar às</Label>
          <Input id={`reav-${linha.internacao_id}`} type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-[130px]" />
        </div>
        <Button size="sm" disabled={!hora}
          onClick={() => void acao(() => rpc('observacao_reavaliar', { p_internacao: linha.internacao_id, p_quando: horaDoDia(hora, 'futuro') })).then((ok) => ok && fechar())}>
          Colocar em reavaliação
        </Button>
        <Button size="sm" variant="outline" onClick={fechar}>Cancelar</Button>
      </div>
    </Painel>
  )
}

// ── desfecho da observação ──────────────────────────────────────────────────
export function PainelDesfecho({ linha, unidadeId, acao, fechar, erro }: {
  linha: LinhaObservacao; unidadeId: string; acao: Acao; fechar: () => void; erro: string | null
}) {
  const [desfecho, setDesfecho] = React.useState<Desfecho | ''>('')
  const [cid, setCid] = React.useState('')
  const [destino, setDestino] = React.useState('')
  const [horaObito, setHoraObito] = React.useState('')
  const [numeroDo, setNumeroDo] = React.useState('')
  const [relato, setRelato] = React.useState('')
  const [setor, setSetor] = React.useState('')
  const [leito, setLeito] = React.useState('')
  const [falta, setFalta] = React.useState<string | null>(null)

  const setores = useQuery({
    queryKey: ['setores-internacao', unidadeId],
    enabled: desfecho === 'internacao',
    queryFn: async () => (await rpc('setores_internacao', { p_unidade: unidadeId })) as { id: string; nome: string }[],
  })
  const leitos = useQuery({
    queryKey: ['leitos-livres', setor],
    enabled: desfecho === 'internacao' && !!setor,
    queryFn: async () => {
      const { data, error } = await supabase.from('leitos').select('id, identificador').eq('setor_id', setor).eq('ativo', true).eq('status', 'livre').order('identificador')
      if (error) throw error
      return data ?? []
    },
  })

  const pedeRelato = desfecho ? RELATO_DESFECHO[desfecho] : undefined
  const ehAlta = !!desfecho && desfecho !== 'internacao'

  function confirmar() {
    if (!desfecho) return setFalta('Escolha o desfecho.')
    if (ehAlta && cid.trim().length < 3) return setFalta('Informe o CID de alta.')
    if (desfecho === 'transferencia' && destino.trim().length < 3) return setFalta('Informe o serviço de destino.')
    if (desfecho === 'obito' && !horaObito) return setFalta('Informe a hora do óbito.')
    if (desfecho === 'obito' && numeroDo.trim().length < 3) return setFalta('Informe o número da Declaração de Óbito.')
    if (desfecho === 'internacao' && !setor) return setFalta('Escolha o setor de internação.')
    if (pedeRelato && relato.trim().length < 15) return setFalta(`${pedeRelato}: escreva ao menos 15 caracteres.`)
    setFalta(null)
    const detalhes: Record<string, string> = {}
    if (desfecho === 'transferencia') detalhes.destino = destino.trim()
    if (desfecho === 'obito') { detalhes.hora_obito = horaDoDia(horaObito, 'passado'); detalhes.numero_do = numeroDo.trim() }
    if (desfecho === 'internacao') { detalhes.setor_id = setor; if (leito) detalhes.leito_id = leito }
    void acao(() => rpc('finalizar_observacao', {
      p_internacao: linha.internacao_id, p_desfecho: desfecho, p_cid: ehAlta ? cid.trim() : null,
      p_relato: relato.trim() || null, p_detalhes: detalhes,
    })).then((ok) => ok && fechar())
  }

  return (
    <Painel titulo="Desfecho da observação" erro={falta ?? erro}>
      <div className="flex flex-wrap gap-[7px]">
        {DESFECHOS.map(([k, r]) => <Opcao key={k} ativa={desfecho === k} onClick={() => { setDesfecho(k); setFalta(null) }}>{r}</Opcao>)}
      </div>
      {desfecho === 'internacao' && (
        <div className="grid max-w-[520px] gap-2.5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Setor de internação</Label>
            <Select items={Object.fromEntries((setores.data ?? []).map((s) => [s.id, s.nome]))} value={setor || null} onValueChange={(v) => { setSetor(v ?? ''); setLeito('') }}>
              <SelectTrigger className="w-full"><SelectValue placeholder={setores.isLoading ? 'Carregando…' : 'Escolha o setor'} /></SelectTrigger>
              <SelectContent>{(setores.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Leito (opcional)</Label>
            <Select items={Object.fromEntries((leitos.data ?? []).map((l) => [l.id, l.identificador]))} value={leito || null} onValueChange={(v) => setLeito(v ?? '')}>
              <SelectTrigger className="w-full" disabled={!setor}><SelectValue placeholder={setor && leitos.data?.length === 0 ? 'Sem leito livre' : 'Sem leito ainda'} /></SelectTrigger>
              <SelectContent>{(leitos.data ?? []).map((l) => <SelectItem key={l.id} value={l.id}>{l.identificador}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <span className="text-apoio text-tinta-apoio sm:col-span-2">O box é liberado e o paciente passa ao setor escolhido; o laudo de AIH é feito no documento de internação.</span>
        </div>
      )}
      {ehAlta && (
        <div className="flex max-w-[170px] flex-col gap-1.5">
          <Label htmlFor={`cid-${linha.internacao_id}`}>CID de alta</Label>
          <Input id={`cid-${linha.internacao_id}`} value={cid} onChange={(e) => setCid(e.target.value.toUpperCase())} placeholder="Ex.: A90" />
        </div>
      )}
      {desfecho === 'transferencia' && (
        <div className="flex max-w-[420px] flex-col gap-1.5">
          <Label htmlFor={`dest-${linha.internacao_id}`}>Serviço de destino</Label>
          <Input id={`dest-${linha.internacao_id}`} value={destino} onChange={(e) => setDestino(e.target.value)} />
        </div>
      )}
      {desfecho === 'obito' && (
        <div className="flex flex-wrap gap-2.5">
          <div className="flex w-[170px] flex-col gap-1.5">
            <Label htmlFor={`hob-${linha.internacao_id}`}>Hora do óbito</Label>
            <Input id={`hob-${linha.internacao_id}`} type="time" value={horaObito} onChange={(e) => setHoraObito(e.target.value)} />
          </div>
          <div className="flex w-[220px] flex-col gap-1.5">
            <Label htmlFor={`do-${linha.internacao_id}`}>Nº da Declaração de Óbito</Label>
            <Input id={`do-${linha.internacao_id}`} value={numeroDo} onChange={(e) => setNumeroDo(e.target.value)} />
          </div>
        </div>
      )}
      {pedeRelato && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`rel-${linha.internacao_id}`}>{pedeRelato}</Label>
          <Textarea id={`rel-${linha.internacao_id}`} rows={2} value={relato} onChange={(e) => setRelato(e.target.value)} />
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={confirmar}>Confirmar desfecho</Button>
        <Button size="sm" variant="outline" onClick={fechar}>Cancelar</Button>
      </div>
    </Painel>
  )
}

// ── protocolo ───────────────────────────────────────────────────────────────
type ItemCatalogo = { sigla: string; nome: string; publico: string; fonte: string }

export function PainelEscolherProtocolo({ linha, pediatrico, acao, fechar, erro }: {
  linha: LinhaObservacao; pediatrico: boolean; acao: Acao; fechar: () => void; erro: string | null
}) {
  const catalogo = useQuery({
    queryKey: ['protocolos-observacao'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('protocolos_observacao').select('sigla, nome, publico, fonte').eq('ativo', true).order('sigla')
      if (error) throw error
      return (data ?? []) as ItemCatalogo[]
    },
  })
  const opcoes = (catalogo.data ?? []).filter((p) => p.publico === 'todos' || p.publico === (pediatrico ? 'pediatrico' : 'adulto'))
  return (
    <Painel titulo="Inserir no protocolo" erro={erro}>
      <div className="flex flex-wrap gap-[7px]">
        {opcoes.map((p) => (
          <Opcao key={p.sigla} ativa={false} onClick={() => void acao(() => rpc('observacao_iniciar_protocolo', { p_internacao: linha.internacao_id, p_sigla: p.sigla }))}>
            {p.sigla} · {p.nome}
          </Opcao>
        ))}
        {catalogo.data && opcoes.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum protocolo com fonte para esta idade.</span>}
      </div>
      <span className="text-rotulo text-tinta-sussurro">Só entram protocolos cuja sequência tem fonte declarada.</span>
      <Button size="sm" variant="outline" className="self-start" onClick={fechar}>Cancelar</Button>
    </Painel>
  )
}

export function PainelProtocoloAberto({ linha, acao, fechar, erro }: { linha: LinhaObservacao; acao: Acao; fechar: () => void; erro: string | null }) {
  const pr = linha.protocolo!
  const [motivo, setMotivo] = React.useState('')
  const [falta, setFalta] = React.useState<string | null>(null)
  const ultima = pr.etapa_atual >= pr.etapas.length - 1
  return (
    <Painel titulo={`${pr.sigla} · ${pr.nome}`} erro={falta ?? erro}>
      <ol className="flex flex-col gap-1">
        {pr.etapas.map((e, i) => {
          const feita = pr.historico.find((h) => h.etapa === i)
          return (
            <li key={i} className={cn('text-apoio', i < pr.etapa_atual ? 'text-conforme' : i === pr.etapa_atual ? 'font-semibold text-tinta' : 'text-tinta-sussurro')}>
              <span className={cn(i < pr.etapa_atual && 'line-through')}>{i + 1}. {e.texto}</span>
              {e.referencia && <span className="font-normal text-tinta-sussurro"> · {e.referencia}</span>}
              {feita && <span className="font-normal text-tinta-sussurro"> · feita às {hhmm(feita.em)}{feita.por ? ` por ${feita.por}` : ''}</span>}
            </li>
          )
        })}
      </ol>
      <span className="text-rotulo text-tinta-sussurro">
        Etapas de processo, sem dose. Fonte: {pr.fonte} Iniciado às {hhmm(pr.iniciado_em)}{pr.iniciado_por ? ` por ${pr.iniciado_por}` : ''}.
      </span>
      <Input value={motivo} onChange={(e) => { setMotivo(e.target.value); setFalta(null) }} placeholder="Para encerrar: justificativa, mínimo 15 caracteres" aria-label="Justificativa de encerramento" />
      <div className="flex flex-wrap gap-2">
        {!ultima && (
          <Button size="sm" onClick={() => void acao(() => rpc('observacao_avancar_protocolo', { p_protocolo: pr.id }))}>Avançar etapa</Button>
        )}
        <Button size="sm" variant="destructive" className="text-critico"
          onClick={() => {
            if (motivo.trim().length < 15) return setFalta('Para encerrar o protocolo, justifique com ao menos 15 caracteres.')
            void acao(() => rpc('observacao_encerrar_protocolo', { p_protocolo: pr.id, p_motivo: motivo.trim() })).then((ok) => ok && fechar())
          }}>
          Encerrar protocolo
        </Button>
        <Button size="sm" variant="outline" onClick={fechar}>Fechar</Button>
      </div>
    </Painel>
  )
}

// ── passagem de plantão ─────────────────────────────────────────────────────
const PILULA_PASSAGEM = {
  aguardando: 'bg-observacao/10 text-observacao',
  aceita: 'bg-conforme/10 text-conforme',
  recusada: 'bg-critico/10 text-critico',
}

/** O que o box mostra da passagem: estado, resumo, e a ação de quem recebe ou de quem passou. */
export function BlocoPassagemBox({ linha }: { linha: LinhaObservacao }) {
  const ps = linha.passagem!
  const rotulo = ps.situacao === 'aceita'
    ? `Aceita às ${hhmm(ps.respondida_em)}${ps.para_nome ? ` · ${ps.para_nome}` : ''}`
    : ps.situacao === 'recusada' ? `Recusada · “${ps.motivo_recusa ?? ''}”` : `Aguardando aceite${ps.para_nome ? ` de ${ps.para_nome}` : ''}`
  return (
    <Painel>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-apoio font-semibold text-grafite">Passagem de plantão</span>
        <span className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold', PILULA_PASSAGEM[ps.situacao])}>{rotulo}</span>
      </div>
      <p className="rounded-controle border border-fio bg-superficie px-[11px] py-2 text-controle whitespace-pre-wrap text-tinta">{ps.resumo}</p>
      {ps.situacao === 'aguardando' && <PassagensDoPlantao pacienteId={linha.paciente_id} />}
      <span className="text-rotulo text-tinta-sussurro">
        Enviada às {hhmm(ps.enviada_em)}{ps.de_nome ? ` por ${ps.de_nome}` : ''}
        {ps.situacao === 'recusada' ? ' · o box volta para quem passou: corrija o resumo e reenvie' : ps.situacao === 'aguardando' ? ' · check-out de quem passou bloqueado até o aceite' : ''}
      </span>
    </Painel>
  )
}

/** Enviar a passagem deste box: para quem está na escala do setor agora ou nas próximas 12 h. */
export function PainelPassar({ linha, acao, fechar, erro }: { linha: LinhaObservacao; acao: Acao; fechar: () => void; erro: string | null }) {
  const [para, setPara] = React.useState('')
  const [resumo, setResumo] = React.useState(() => [linha.queixa, linha.reavaliar_em ? `reavaliar às ${hhmm(linha.reavaliar_em)}` : null].filter(Boolean).join(' · '))
  const colegas = useQuery({
    queryKey: ['colegas-passagem', linha.internacao_id],
    queryFn: async () => (await rpc('colegas_para_passagem', { p_internacao: linha.internacao_id })) as { perfil_id: string; nome: string; inicio: string }[],
  })
  return (
    <Painel titulo="Passar plantão" erro={erro}>
      <Select items={Object.fromEntries((colegas.data ?? []).map((c) => [c.perfil_id, `${c.nome} · a partir de ${hhmm(c.inicio)}`]))} value={para || null} onValueChange={(x) => setPara(x ?? '')}>
        <SelectTrigger className="w-full max-w-[420px]"><SelectValue placeholder={colegas.isLoading ? 'Carregando a escala…' : 'Para quem (escala do setor, agora ou nas próximas 12h)'} /></SelectTrigger>
        <SelectContent>
          {(colegas.data ?? []).map((c) => <SelectItem key={c.perfil_id} value={c.perfil_id}>{c.nome} · a partir de {hhmm(c.inicio)}</SelectItem>)}
        </SelectContent>
      </Select>
      {colegas.data && colegas.data.length === 0 && <span className="text-apoio text-atencao">Ninguém na escala deste setor agora nem nas próximas 12 horas.</span>}
      <Textarea rows={2} value={resumo} onChange={(e) => setResumo(e.target.value)} aria-label="Resumo da passagem"
        placeholder="O que o próximo plantonista precisa saber deste box (mínimo de 15 letras)" />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!para || resumo.trim().length < 15}
          onClick={() => void acao(() => rpc('enviar_passagem', { p_internacao: linha.internacao_id, p_para: para, p_resumo: resumo })).then((ok) => ok && fechar())}>
          Enviar passagem
        </Button>
        <Button size="sm" variant="outline" onClick={fechar}>Cancelar</Button>
      </div>
    </Painel>
  )
}
