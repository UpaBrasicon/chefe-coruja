// ─────────────────────────────────────────────────────────────────────────────
// Encaminhar paciente dentro da unidade (protótipo, etapa 10 — manual 3.13).
//
// Especialidade (obrigatória), médico (opcional), serviço e justificativa.
// Pendências do atendimento (exame sem resultado, medicação sem checagem,
// pendência impeditiva da internação) impedem. Quem recebe aceita e assume,
// ou recusa com justificativa (componente EncaminhamentosRecebidos). O
// histórico fica no paciente; o "excluir" do protótipo virou cancelar com
// motivo (nada se apaga). Toda regra é do servidor; aqui só se mostra e pede.
// ─────────────────────────────────────────────────────────────────────────────
import { AlertTriangle, ArrowRightLeft, Printer } from 'lucide-react'
import * as React from 'react'

import { imprimirRelatorio } from '@/lib/prontuario'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

import {
  ESPECIALIDADES, ROTULO_ESTADO, SERVICOS, msg, normalizar, quando,
  useEncaminhamentos, useMedicosParaEncaminhar, usePendenciasEncaminhar, useRecarregarEncaminhamentos,
  type Encaminhamento, type EstadoEncaminhamento,
} from './useEncaminhamentos'

export type AbaEncaminhamentoInternoProps = { pacienteId: string; episodioId?: string | null; internacaoId?: string | null }

const PILULA_ESTADO: Record<EstadoEncaminhamento, string> = {
  pendente: 'bg-pediatria/10 text-pediatria',
  aceito: 'bg-alerta-marca text-acao',
  atendido: 'bg-alerta-conforme text-conforme',
  recusado: 'bg-alerta-critico text-critico',
  cancelado: 'bg-trilha text-tinta-sussurro line-through',
}

const vazio = { esp: '', espOk: false, medico: '', servico: '', just: '' }

export function AbaEncaminhamentoInterno({ pacienteId, episodioId, internacaoId }: AbaEncaminhamentoInternoProps) {
  const lista = useEncaminhamentos(pacienteId)
  const pend = usePendenciasEncaminhar(pacienteId, episodioId, internacaoId)
  const medicos = useMedicosParaEncaminhar(pacienteId)
  const recarregar = useRecarregarEncaminhamentos()
  const [f, setF] = React.useState(vazio)
  const [focado, setFocado] = React.useState(false)
  const [filtro, setFiltro] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const [cancelando, setCancelando] = React.useState<string | null>(null)
  const [motivo, setMotivo] = React.useState('')

  const executar = async (fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setOcupado(true)
    try {
      const { error } = await fn()
      if (error) { setErro(msg(error)); setAviso(null); return false }
      setErro(null); setAviso(ok); recarregar(); return true
    } finally { setOcupado(false) }
  }

  const hist = lista.data ?? []
  const aberto = hist.find((e) => e.estado === 'pendente') ?? null
  const pendencias = pend.data ?? []
  const termo = normalizar(f.esp)
  const sugestoes = focado && !f.espOk && termo
    ? ESPECIALIDADES.filter((e) => normalizar(e).includes(termo) && normalizar(e) !== termo).slice(0, 8)
    : []
  const ok = f.esp.trim().length >= 3 && f.just.trim().length >= 10 && pendencias.length === 0 && !aberto && !pend.isLoading && !ocupado
  const especialidades = Array.from(new Set(hist.map((e) => e.especialidade)))
  const visiveis = hist.filter((e) => !filtro || e.especialidade === filtro)

  async function encaminhar() {
    const esp = f.esp.trim()
    const feito = await executar(() => supabase.rpc('encaminhar_interno', {
      p_paciente: pacienteId, p_especialidade: esp, p_justificativa: f.just.trim(),
      p_medico: f.medico || undefined, p_servico: f.servico || undefined,
      p_episodio: episodioId ?? undefined, p_internacao: internacaoId ?? undefined,
    }), `Paciente encaminhado para ${esp}. Fica aguardando até alguém aceitar.`)
    if (feito) setF(vazio)
  }

  async function cancelar(e: Encaminhamento) {
    const feito = await executar(() => supabase.rpc('cancelar_encaminhamento', { p_encaminhamento: e.id, p_motivo: motivo }),
      'Encaminhamento cancelado. Continua no histórico.')
    if (feito) { setCancelando(null); setMotivo('') }
  }

  return (
    <section className="flex flex-col gap-2.5 rounded-menu border border-fio bg-superficie p-4 text-controle">
      <h3 className="flex items-center gap-2 text-corpo font-semibold text-tinta">
        <ArrowRightLeft className="size-4 text-acao" aria-hidden /> Encaminhar paciente (dentro da unidade)
      </h3>
      <p className="text-apoio text-tinta-sussurro [text-wrap:pretty]">
        Passa o atendimento para outra especialidade ou médico. Quem recebe aceita e assume, ou recusa com justificativa.
        Para referência a outro serviço use o documento de Encaminhamento.
      </p>
      {aberto && (
        <p className="text-apoio font-medium text-pediatria">
          Aguardando aceite de {aberto.especialidade}{aberto.medico_destino ? ` · ${aberto.medico_destino}` : ''} desde {quando(aberto.encaminhado_em)}.
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
          <label htmlFor="enc-esp" className="text-apoio font-medium text-grafite">Especialidade</label>
          <Input id="enc-esp" placeholder="Ex.: Cirurgia geral" value={f.esp} autoComplete="off"
            onFocus={() => setFocado(true)} onBlur={() => setTimeout(() => setFocado(false), 150)}
            onChange={(e) => setF({ ...f, esp: e.target.value, espOk: false })} />
          {sugestoes.length > 0 && (
            <div className="relative z-30 h-0">
              <div role="listbox" className="absolute inset-x-0 top-1 max-h-60 overflow-y-auto rounded-controle border border-fio bg-superficie shadow-lg">
                {sugestoes.map((s) => (
                  <button key={s} type="button" role="option" aria-selected={false}
                    onMouseDown={(ev) => ev.preventDefault()} onClick={() => setF({ ...f, esp: s, espOk: true })}
                    className="block w-full border-b border-trilha px-3 py-2 text-left text-controle text-tinta last:border-0 hover:bg-campo">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
          <label htmlFor="enc-med" className="text-apoio font-medium text-grafite">Médico (opcional)</label>
          <select id="enc-med" value={f.medico} onChange={(e) => setF({ ...f, medico: e.target.value })}
            className="min-h-9 w-full rounded-controle border border-fio bg-campo px-[11px] py-[7px] text-controle text-tinta outline-none focus-visible:border-marca">
            <option value="">Qualquer médico do plantão</option>
            {(medicos.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.nome}{m.registro ? ` · ${m.registro}` : ''}</option>)}
          </select>
        </div>
      </div>

      <span className="text-apoio font-medium text-grafite">Serviço</span>
      <div role="group" aria-label="Serviço" className="flex flex-wrap gap-1.5">
        {SERVICOS.map((s) => (
          <Chip key={s} ativo={f.servico === s} onClick={() => setF({ ...f, servico: f.servico === s ? '' : s })}>{s}</Chip>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="enc-just" className="text-apoio font-medium text-grafite">Observação ou justificativa</label>
        <Textarea id="enc-just" rows={2} placeholder="Por que encaminhar (mínimo de 10 letras)" value={f.just}
          onChange={(e) => setF({ ...f, just: e.target.value })} />
      </div>

      {pendencias.length > 0 && (
        <div role="alert" className="flex flex-col gap-0.5 text-apoio text-critico">
          <span className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="size-3.5" aria-hidden /> Pendências em aberto impedem o encaminhamento:</span>
          {pendencias.map((p) => <span key={p}>{p}</span>)}
        </div>
      )}
      {pend.error && <p className="text-apoio text-critico">{msg(pend.error)}</p>}
      {erro && <p role="alert" className="rounded-controle border border-critico/30 bg-alerta-critico p-2.5 text-apoio text-critico">{erro}</p>}
      {aviso && <p role="status" className="rounded-controle border border-conforme/30 bg-alerta-conforme p-2.5 text-apoio text-conforme">{aviso}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => { setF(vazio); setErro(null) }}>Limpar</Button>
        <Button size="sm" disabled={!ok} onClick={() => void encaminhar()}
          title={aberto ? 'Já há um encaminhamento aguardando aceite.' : undefined}>
          {ocupado ? <Spinner className="size-3.5" /> : null} Encaminhar
        </Button>
      </div>

      {/* histórico */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-trilha pt-2.5">
        <span className="mr-1 text-apoio font-semibold text-grafite">Histórico de encaminhamentos</span>
        {especialidades.length > 1 && (
          <>
            <Chip ativo={!filtro} onClick={() => setFiltro('')}>Todas</Chip>
            {especialidades.map((e) => <Chip key={e} ativo={filtro === e} onClick={() => setFiltro(e)}>{e}</Chip>)}
          </>
        )}
        {/* folha "Encaminhamento interno" (montarEncIntHtml do protótipo): os que estão na lista */}
        {visiveis.length > 0 && (
          <Button size="sm" variant="outline" className="ml-auto"
            onClick={() => void imprimirRelatorio({ tipo: 'encaminhamento_interno', pacienteId, internacaoId, ids: visiveis.map((e) => e.id) })}>
            <Printer /> Imprimir
          </Button>
        )}
      </div>
      {lista.isLoading && <div className="flex justify-center py-4"><Spinner /></div>}
      {lista.error && <p className="text-apoio text-critico">{msg(lista.error)}</p>}
      {visiveis.map((e) => (
        <div key={e.id} className="flex flex-col gap-1 border-b border-trilha py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-[1_1_200px] text-controle font-medium text-tinta">
              {[e.especialidade, e.medico_destino, e.servico].filter(Boolean).join(' · ')}
            </span>
            <span className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap', PILULA_ESTADO[e.estado])}>
              {ROTULO_ESTADO[e.estado]}
            </span>
          </div>
          <span className="text-rotulo text-tinta-sussurro">
            Encaminhado por {e.encaminhado_por ?? '—'} em {quando(e.encaminhado_em)}
            {e.respondido_em && e.estado !== 'recusado' ? ` · aceito por ${e.respondido_por ?? '—'} em ${quando(e.respondido_em)}` : ''}
            {e.estado === 'recusado' ? ` · recusado por ${e.respondido_por ?? '—'} em ${quando(e.respondido_em)}` : ''}
            {e.atendido_em ? ` · atendido em ${quando(e.atendido_em)}` : ''}
            {e.cancelado_em ? ` · cancelado por ${e.cancelado_por ?? '—'} em ${quando(e.cancelado_em)}` : ''}
          </span>
          <span className="text-apoio text-tinta-apoio [text-wrap:pretty]">{e.justificativa}</span>
          {e.motivo_recusa && <span className="text-apoio text-critico">Justificativa de rejeição: {e.motivo_recusa}</span>}
          {e.motivo_cancelamento && <span className="text-apoio text-tinta-sussurro">Motivo do cancelamento: {e.motivo_cancelamento}</span>}
          {e.sou_quem_encaminhou && (e.estado === 'pendente' || e.estado === 'aceito') && (
            cancelando === e.id ? (
              <div className="flex flex-col gap-2 rounded-controle border border-critico/30 bg-alerta-critico p-2.5">
                <span className="text-apoio text-critico">Cancelar o encaminhamento? Continua no histórico; diga por quê.</span>
                <Input aria-label="Motivo do cancelamento" placeholder="Motivo (mínimo de 10 letras)" value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
                <div className="flex gap-1.5">
                  <Button size="sm" variant="destructive" disabled={motivo.trim().length < 10 || ocupado} onClick={() => void cancelar(e)}>Confirmar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setCancelando(null)}>Não</Button>
                </div>
              </div>
            ) : (
              <Button size="xs" variant="outline" className="self-start" onClick={() => { setCancelando(e.id); setMotivo('') }}>Cancelar encaminhamento</Button>
            )
          )}
        </div>
      ))}
      {!lista.isLoading && visiveis.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum encaminhamento para este paciente.</span>}
    </section>
  )
}
