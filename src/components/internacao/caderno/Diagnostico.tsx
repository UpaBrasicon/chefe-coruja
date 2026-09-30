// Diagnóstico do episódio (protótipo, index.html 3050–3113; ESTADO.md etapa 5;
// manual PEP 3.5): CID-10 em português, um primário obrigatório com status
// hipótese/confirmado e tempo da doença, secundários só com primário. Cada
// troca grava uma linha nova e encerra a anterior: o histórico fica.
import { AlertTriangle, ClipboardList, History, Shield } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useTerminologia } from '@/hooks/useTerminologia'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import { Chip } from './caixas'
import { type Acao, diaHora } from './comum'
import { type DiagnosticoLinha as Linha, useDiagnosticos } from './diagnosticos'
import { FONTE_LNNC, useNotificacaoCompulsoria } from './notificacao'

const STATUS = [['hipotese', 'Hipótese'], ['confirmado', 'Confirmado']] as const
const UNIDADES = [['horas', 'Horas'], ['dias', 'Dias'], ['meses', 'Meses'], ['anos', 'Anos']] as const
const ROTULO_STATUS: Record<string, string> = { hipotese: 'hipótese', confirmado: 'confirmado' }
const ROTULO_UNIDADE: Record<string, string> = { horas: 'hora(s)', dias: 'dia(s)', meses: 'mês(es)', anos: 'ano(s)' }

/** "J18.9 — Pneumonia…" → "J18.9". */
const codigo = (t: string) => t.trim().split(/\s|—/)[0].toUpperCase()
const rotuloCid = (l: { cid: string; descricao: string | null }) => (l.descricao ? `${l.cid} — ${l.descricao}` : l.cid)

/** Campo de CID com as sugestões da tabela CID-10 (terminologia_buscar). */
function CampoCid({ id, valor, mudar, desabilitado, placeholder, rotulo }: {
  id: string; valor: string; mudar: (v: string) => void; desabilitado?: boolean; placeholder: string; rotulo: string
}) {
  const [foco, setFoco] = React.useState(false)
  const busca = useTerminologia('cid10', foco ? valor : '', 8)
  const lista = foco && valor.trim().length >= 2 ? busca.data ?? [] : []
  return (
    <div className="relative">
      <input id={id} value={valor} disabled={desabilitado} placeholder={placeholder} aria-label={rotulo} autoComplete="off"
        onChange={(e) => mudar(e.target.value)} onFocus={() => setFoco(true)} onBlur={() => setTimeout(() => setFoco(false), 150)}
        className="w-full rounded-[10px] border border-fio bg-campo px-3 py-2.5 text-corpo text-tinta outline-none focus:border-marca disabled:cursor-not-allowed disabled:opacity-60" />
      {lista.length > 0 && (
        <div role="listbox" className="absolute top-full right-0 left-0 z-30 mt-0.5 max-h-[280px] overflow-y-auto rounded-[10px] border border-fio bg-superficie shadow-[0_12px_32px_rgba(15,23,42,0.14)]">
          {lista.map((r) => (
            <button key={r.codigo} type="button" role="option" aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { mudar(`${r.codigo} — ${r.descricao}`); setFoco(false) }}
              className="block w-full border-b border-trilha px-3 py-2 text-left text-controle text-tinta last:border-b-0 hover:bg-campo">
              {r.codigo} — {r.descricao}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function AbaDiagnostico({ internacaoId, podeEditar, acao, onAbrirNotificacao }: {
  internacaoId: string
  podeEditar: boolean
  acao: Acao
  /** Leva à notificação de agravo (hoje, a aba Exames: "Exames e agravos"). */
  onAbrirNotificacao: () => void
}) {
  const q = useDiagnosticos(internacaoId)
  const linhas = q.data ?? []
  const vigentes = linhas.filter((l) => !l.encerrado_em)
  // a internação manda; sem primário dela, o da porta aparece como ponto de partida
  const primario = vigentes.find((l) => l.tipo === 'primario' && l.origem === 'internacao')
    ?? vigentes.find((l) => l.tipo === 'primario')
  const secundarios = vigentes.filter((l) => l.tipo === 'secundario' && l.origem === 'internacao')
  const lnnc = useNotificacaoCompulsoria(vigentes.map((l) => l.cid))

  if (q.isLoading) return <Spinner />
  if (q.error) return <p className="text-apoio text-critico">{(q.error as Error).message}</p>

  const itens = lnnc.data?.itens ?? []
  const imediatas = itens.filter((x) => x.imediata)
  const semanais = itens.filter((x) => !x.imediata)
  const itemTxt = (x: (typeof itens)[number]) => `${x.cid} · ${x.agravo}${x.item ? ` (item ${x.item})` : ''}`

  return (
    <div className="grid gap-3.5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-3.5 rounded-[14px] border border-fio bg-superficie p-4">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="flex items-center gap-[7px] text-corpo font-semibold text-tinta">
            <ClipboardList className="size-[15px] text-acao" aria-hidden /> Diagnóstico
          </span>
          <span className="text-apoio text-tinta-sussurro">CID-10 · português · um primário, secundários opcionais</span>
        </div>

        {imediatas.length > 0 && (
          <div role="alert" className="flex items-start gap-2 rounded-[10px] border border-critico/30 bg-critico/[0.06] px-3 py-2.5">
            <AlertTriangle className="mt-0.5 size-[15px] shrink-0 text-critico" aria-hidden />
            <span className="flex-1 text-controle leading-[1.45] text-pretty text-critico">
              Notificação imediata, até 24 h: {imediatas.map((x) => `${itemTxt(x)}${x.destino ? ` para ${x.destino}` : ''}`).join('; ')}.
              {' '}Comunique a vigilância agora e registre a notificação de agravo. {FONTE_LNNC}.
            </span>
          </div>
        )}

        {podeEditar ? (
          <FormPrimario key={primario ? `${primario.id}` : 'novo'} internacaoId={internacaoId} primario={primario ?? null} acao={acao} />
        ) : primario ? (
          <p className="text-controle text-tinta">
            <span className="font-medium">{rotuloCid(primario)}</span> · {ROTULO_STATUS[primario.status]}
            {primario.tempo_doenca !== null && ` · há ${primario.tempo_doenca} ${ROTULO_UNIDADE[primario.tempo_unidade ?? ''] ?? ''}`}
          </p>
        ) : (
          <p className="text-apoio text-atencao">Sem diagnóstico primário registrado.</p>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-apoio font-medium text-grafite">Diagnósticos secundários</span>
          {secundarios.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum.</span>}
          {secundarios.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5 rounded-[10px] border border-fio bg-campo px-3 py-2">
              <span className="min-w-0 flex-1 text-controle text-tinta">{rotuloCid(s)} <span className="text-tinta-sussurro">· {ROTULO_STATUS[s.status]}</span></span>
              {podeEditar && (
                <button type="button" className="text-apoio text-critico hover:underline"
                  onClick={() => void acao(async () => {
                    const { error } = await supabase.rpc('retirar_diagnostico', { p_diagnostico: s.id })
                    if (error) throw error
                  },
                    `${s.cid} retirado dos secundários (fica no histórico).`)}>
                  Remover
                </button>
              )}
            </div>
          ))}
          {podeEditar && (
            <IncluirSecundario internacaoId={internacaoId} temPrimario={!!primario && primario.origem === 'internacao'} acao={acao} />
          )}
        </div>

        {vigentes.length > 0 && lnnc.data && !lnnc.data.catalogo && (
          <p className="flex items-start gap-2 text-apoio text-pretty text-tinta-sussurro">
            <Shield className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            O catálogo de notificação compulsória (LNNC) ainda não está carregado: confira na lista do Ministério da Saúde se algum destes CIDs é de notificação.
          </p>
        )}
        {itens.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[#F59E0B66] bg-nota px-3 py-2">
            <Shield className="size-[15px] shrink-0 text-observacao" aria-hidden />
            <span className="flex-[1_1_240px] text-apoio leading-[1.45] text-pretty text-atencao">
              {semanais.length > 0 && <>Notificação compulsória: {semanais.map((x) => `${itemTxt(x)}${x.condicao ? `, imediata se ${x.condicao}` : ', semanal'}`).join('; ')}. </>}
              Registre a notificação de agravo: suspeita sem notificação impede a alta.
            </span>
            <Button size="xs" variant="outline" onClick={onAbrirNotificacao}>Abrir notificação</Button>
          </div>
        )}
      </div>

      <Historico linhas={linhas} />
    </div>
  )
}

function FormPrimario({ internacaoId, primario, acao }: { internacaoId: string; primario: Linha | null; acao: Acao }) {
  const daInternacao = primario?.origem === 'internacao'
  const [texto, setTexto] = React.useState(primario ? rotuloCid(primario) : '')
  const [status, setStatus] = React.useState<'hipotese' | 'confirmado'>(primario?.status ?? 'hipotese')
  const [tempo, setTempo] = React.useState(primario?.tempo_doenca != null ? String(primario.tempo_doenca) : '')
  const [unidade, setUnidade] = React.useState(primario?.tempo_unidade ?? 'dias')
  const cod = codigo(texto)
  const mudou = !daInternacao || !primario || cod !== primario.cid || status !== primario.status
    || (tempo ? Number(tempo) : null) !== primario.tempo_doenca || (tempo ? unidade : null) !== primario.tempo_unidade
  const salvar = () =>
    acao(async () => {
      const { error } = await supabase.rpc('registrar_diagnostico', {
        p_internacao: internacaoId, p_tipo: 'primario', p_cid: cod, p_status: status,
        p_tempo: tempo ? Number(tempo) : undefined, p_tempo_unidade: tempo ? unidade : undefined,
      })
      if (error) throw error
    }, primario && daInternacao ? 'Diagnóstico primário atualizado; o anterior fica no histórico.' : 'Diagnóstico primário registrado.')

  return (
    <div className="flex flex-col gap-3.5">
      {primario && !daInternacao && (
        <p className="text-apoio text-tinta-sussurro">Veio do atendimento da porta. Confirme ou troque para registrá-lo na internação.</p>
      )}
      <div className="flex flex-col gap-1.5">
        <span className="text-apoio font-medium text-grafite">Status</span>
        <div role="radiogroup" aria-label="Status do diagnóstico" className="flex flex-wrap gap-1.5">
          {STATUS.map(([k, r]) => (
            <Chip key={k} forte role="radio" aria-checked={status === k} ativo={status === k} onClick={() => setStatus(k)}>{r}</Chip>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-[3_1_280px] flex-col gap-1.5">
          <label htmlFor="diag-primario" className="text-apoio font-medium text-grafite">Diagnóstico primário · obrigatório</label>
          <CampoCid id="diag-primario" rotulo="Diagnóstico primário" valor={texto} mudar={setTexto} placeholder="Código ou nome, ex.: J44.1" />
        </div>
        <div className="flex flex-[1_1_260px] flex-col gap-1.5">
          <span className="text-apoio font-medium text-grafite">Tempo da doença</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <input value={tempo} onChange={(e) => setTempo(e.target.value.replace(/\D/g, '').slice(0, 3))} inputMode="numeric"
              maxLength={3} placeholder="—" aria-label="Tempo da doença"
              className="w-16 rounded-[10px] border border-fio bg-campo px-2.5 py-[9px] text-corpo text-tinta tabular-nums outline-none focus:border-marca" />
            {UNIDADES.map(([k, r]) => (
              <Chip key={k} ativo={unidade === k} onClick={() => setUnidade(k)} aria-pressed={unidade === k}>{r}</Chip>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!cod && <span className="mr-auto text-apoio text-atencao">Informe o diagnóstico primário.</span>}
        <Button size="sm" className="ml-auto" disabled={!cod || !mudou} onClick={() => void salvar()}>
          {primario && daInternacao ? 'Atualizar primário' : 'Registrar primário'}
        </Button>
      </div>
    </div>
  )
}

function IncluirSecundario({ internacaoId, temPrimario, acao }: { internacaoId: string; temPrimario: boolean; acao: Acao }) {
  const [texto, setTexto] = React.useState('')
  const [status, setStatus] = React.useState<'hipotese' | 'confirmado'>('hipotese')
  const cod = codigo(texto)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-0 flex-[1_1_240px]">
        <CampoCid id="diag-secundario" rotulo="CID secundário" valor={texto} mudar={setTexto} desabilitado={!temPrimario}
          placeholder={temPrimario ? 'Código ou nome do CID secundário' : 'Informe primeiro o diagnóstico primário'} />
      </div>
      {STATUS.map(([k, r]) => (
        <Chip key={k} ativo={status === k} disabled={!temPrimario} onClick={() => setStatus(k)} aria-pressed={status === k}>{r}</Chip>
      ))}
      <Button size="sm" variant="outline" disabled={!temPrimario || !cod}
        onClick={() => void acao(async () => {
          const { error } = await supabase.rpc('registrar_diagnostico', { p_internacao: internacaoId, p_tipo: 'secundario', p_cid: cod, p_status: status })
          if (error) throw error
        }, `${cod} incluído nos secundários.`).then((r) => { if (r !== null) setTexto('') })}>
        Incluir
      </Button>
    </div>
  )
}

function Historico({ linhas }: { linhas: Linha[] }) {
  return (
    <div className="flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-fio bg-superficie">
      <div className="flex items-center gap-2 border-b border-trilha px-4 py-3 text-apoio font-semibold tracking-[0.05em] text-tinta-sussurro uppercase">
        <History className="size-3.5" aria-hidden /> Histórico
      </div>
      {linhas.length === 0 && <p className="px-4 py-3 text-apoio text-tinta-sussurro">Nada registrado ainda.</p>}
      {linhas.map((l) => (
        <div key={l.id} className={cn('flex flex-col gap-0.5 border-b border-trilha px-4 py-2.5 last:border-b-0', l.encerrado_em && 'opacity-70')}>
          <span className={cn('text-controle text-tinta', l.encerrado_em && 'line-through decoration-tinta-sussurro')}>{rotuloCid(l)}</span>
          <span className="text-apoio text-tinta-sussurro">
            {l.tipo === 'primario' ? 'Primário' : 'Secundário'} · {ROTULO_STATUS[l.status]}
            {l.tempo_doenca !== null && ` · há ${l.tempo_doenca} ${ROTULO_UNIDADE[l.tempo_unidade ?? ''] ?? ''}`}
            {l.origem === 'porta' && ' · da porta'}
          </span>
          <span className="text-apoio text-tinta-sussurro">{l.autor_nome ?? 'Profissional'} · {diaHora(l.registrado_em)}</span>
          {l.encerrado_em && (
            <span className="text-apoio text-tinta-sussurro">
              {l.encerramento === 'substituido' ? 'Substituído' : 'Retirado'} {diaHora(l.encerrado_em)}
              {l.encerrado_por_nome ? ` por ${l.encerrado_por_nome}` : ''}{l.motivo_encerramento ? ` · ${l.motivo_encerramento}` : ''}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
