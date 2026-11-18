// Agenda de consultas da UBS (5A, tarefa 3, parte 3.2; decisões F1 a F6 e
// opção B do RT em 02/11/2026): a lista do dia em ordem de horário, com
// Chegou, Falta e Cancelar na linha, e o painel de marcar com o calendário e
// os horários livres do profissional (ref. Cal.com, escolha de horário). O
// gestor tem também a configuração (grade e fechamento). Tudo pelas RPCs da
// agenda; o servidor confere de novo as regras do Manual do PEC.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, ChevronLeft, ChevronRight, CircleAlert } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { Chip, TituloPagina } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  MOTIVOS_RESERVA, horariosLivres,
  type MotivoReserva, servicosDoPapel, SERVICOS, type Servico,
} from '@/domain/agenda'
import { rotuloIdade } from '@/domain/idade'
import { dataIso, dataPura, diaMes, hora, mesAno, semanaCurta } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import { ConfiguracaoAgenda } from './ConfiguracaoAgenda'
import { useAgendaDia, useAgora, useConfiguracaoAgenda } from '@/hooks/useAgenda'
import { ListaDoDia } from '@/components/agenda/ListaDoDia'
import { useValorAdiado } from '@/hooks/useValorAdiado'

type Achado = { id: string; nome: string; nome_social: string | null; data_nascimento: string | null }

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
const somarDias = (iso: string, n: number) => {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
// meio-dia em UTC cai no mesmo dia em Brasília
const rotuloDia = (iso: string) => `${semanaCurta(iso + 'T12:00:00Z')}, ${diaMes(iso + 'T12:00:00Z')}`

export default function AgendaConsultas() {
  const { unidadeAtiva, ehGestor } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [busca, setBusca] = useSearchParams()
  const hoje = dataIso()
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(busca.get('data') ?? '') ? busca.get('data')! : hoje
  const aba = ehGestor && busca.get('aba') === 'configuracao' ? 'configuracao' : 'dia'
  const trocar = (k: string, v: string | null) =>
    setBusca((b) => { const n = new URLSearchParams(b); if (v) n.set(k, v); else n.delete(k); return n }, { replace: true })

  return (
    <>
      <TituloPagina
        titulo="Agenda de consultas"
        descricao="Consultas e reservas por profissional: marcar, chegou, falta e cancelar."
        acoes={aba === 'dia' && (
          <div className="flex items-center gap-1.5">
            <Button size="icon-sm" variant="outline" aria-label="Dia anterior" onClick={() => trocar('data', somarDias(dia, -1))}><ChevronLeft /></Button>
            <Button size="sm" variant="outline" onClick={() => trocar('data', null)}>{dia === hoje ? 'Hoje' : 'Ir para hoje'} · {rotuloDia(dia)}</Button>
            <Button size="icon-sm" variant="outline" aria-label="Próximo dia" onClick={() => trocar('data', somarDias(dia, 1))}><ChevronRight /></Button>
          </div>
        )}
      />
      {ehGestor && (
        <Tabs value={aba} onValueChange={(v) => trocar('aba', v === 'dia' ? null : String(v))} className="mb-3">
          <TabsList aria-label="Agenda" className="gap-5">
            <TabsTrigger value="dia">Dia</TabsTrigger>
            <TabsTrigger value="configuracao">Configuração</TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {!unidadeId ? null : aba === 'configuracao' ? <ConfiguracaoAgenda unidadeId={unidadeId} /> : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <ListaDoDia unidadeId={unidadeId} dia={dia} hoje={hoje} />
          <MarcarConsulta unidadeId={unidadeId} diaInicial={dia >= hoje ? dia : hoje} hoje={hoje}
            pacienteUrl={busca.get('paciente')} origemUrl={busca.get('origem')}
            tipoUrl={busca.get('consulta') === 'consulta_programada' ? 'consulta_programada' : 'consulta_agendada'} />
        </div>
      )}
    </>
  )
}

// ── lista do dia ────────────────────────────────────────────────────────────
function Calendario({ valor, onEscolher, hoje, diasComAgenda }: {
  valor: string; onEscolher: (iso: string) => void; hoje: string; diasComAgenda: Set<number>
}) {
  const [mes, setMes] = React.useState(valor.slice(0, 7))
  const primeiro = new Date(mes + '-01T12:00:00Z')
  const dias = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1, 0)).getUTCDate()
  const desloc = primeiro.getUTCDay()
  const trocarMes = (n: number) => {
    const d = new Date(Date.UTC(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + n, 1, 12))
    setMes(d.toISOString().slice(0, 7))
  }
  const rotuloMes = mesAno(primeiro.getUTCFullYear(), primeiro.getUTCMonth() + 1)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Button size="icon-xs" variant="ghost" aria-label="Mês anterior" onClick={() => trocarMes(-1)}><ChevronLeft /></Button>
        <span className="text-apoio font-medium text-tinta first-letter:uppercase">{rotuloMes}</span>
        <Button size="icon-xs" variant="ghost" aria-label="Próximo mês" onClick={() => trocarMes(1)}><ChevronRight /></Button>
      </div>
      <div role="grid" aria-label="Escolha o dia" className="grid grid-cols-7 gap-1 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i} className="text-rotulo text-tinta-sussurro">{d}</span>)}
        {Array.from({ length: desloc }, (_, i) => <span key={`v${i}`} />)}
        {Array.from({ length: dias }, (_, i) => {
          const iso = `${mes}-${String(i + 1).padStart(2, '0')}`
          const dow = (desloc + i) % 7
          const pode = iso >= hoje && diasComAgenda.has(dow)
          return (
            <Button key={iso} size="xs" variant={iso === valor ? 'default' : 'ghost'} disabled={!pode}
              aria-pressed={iso === valor} className="tabular-nums" onClick={() => onEscolher(iso)}>
              {i + 1}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function MarcarConsulta({ unidadeId, diaInicial, hoje, pacienteUrl, origemUrl, tipoUrl }: {
  unidadeId: string; diaInicial: string; hoje: string
  /** F6: vindo da conduta ou da escuta, o paciente e o episódio de origem chegam pela URL */
  pacienteUrl: string | null; origemUrl: string | null; tipoUrl: 'consulta_agendada' | 'consulta_programada'
}) {
  const qc = useQueryClient()
  const config = useConfiguracaoAgenda(unidadeId)
  const comAgenda = (config.data ?? []).filter((p) => p.horarios.length > 0)
  const [modo, setModo] = React.useState<'consulta' | 'reserva'>('consulta')
  const [perfil, setPerfil] = React.useState('')
  const prof = comAgenda.find((p) => p.perfil_id === perfil) ?? (comAgenda.length === 1 ? comAgenda[0] : undefined)
  const [data, setData] = React.useState(diaInicial)
  const [inicio, setInicio] = React.useState<string | null>(null)
  const [termo, setTermo] = React.useState('')
  const [escolhido, setPaciente] = React.useState<Achado | null>(null)
  const [usarUrl, setUsarUrl] = React.useState(!!pacienteUrl)
  const daUrl = useQuery({
    queryKey: ['agenda-paciente-url', pacienteUrl],
    enabled: !!pacienteUrl && usarUrl,
    queryFn: async () => {
      const { data: r, error } = await supabase.from('pacientes').select('id, nome, nome_social, data_nascimento').eq('id', pacienteUrl!).maybeSingle()
      if (error) throw error
      return r as Achado | null
    },
  })
  const paciente = escolhido ?? (usarUrl ? daUrl.data ?? null : null)
  const origem = usarUrl && !escolhido && paciente?.id === pacienteUrl ? origemUrl : null
  const [tipo, setTipo] = React.useState<'consulta_agendada' | 'consulta_programada'>(tipoUrl)
  const [obs, setObs] = React.useState('')
  // U6: o serviço da consulta, entre os do profissional (o primeiro é o padrão)
  const servicos = prof ? servicosDoPapel(prof.papel) : []
  const [servicoEscolhido, setServico] = React.useState<Servico | null>(null)
  const servico = servicoEscolhido && servicos.includes(servicoEscolhido) ? servicoEscolhido : servicos[0] ?? null
  const [motivo, setMotivo] = React.useState<MotivoReserva | null>(null)
  const [especifique, setEspecifique] = React.useState('')
  const [aviso, setAviso] = React.useState<string | null>(null)

  const doDia = useAgendaDia(unidadeId, data)
  const agora = useAgora()
  const livres = horariosLivres(doDia.data?.profissionais.find((p) => p.perfil_id === prof?.perfil_id), agora)
  const slot = livres.find((h) => h.inicio === inicio)
  const fechado = doDia.data?.profissionais.find((p) => p.perfil_id === prof?.perfil_id)?.fechamento

  const t = useValorAdiado(termo.trim())
  const achados = useQuery({
    queryKey: ['agenda-busca-paciente', unidadeId, t],
    enabled: modo === 'consulta' && t.length >= 3 && !paciente,
    queryFn: async (): Promise<Achado[]> => {
      const { data: r, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId, p_termo: t })
      if (error) throw error
      return (r ?? []).slice(0, 8)
    },
  })

  const marcar = useMutation({
    mutationFn: async () => {
      if (modo === 'consulta') {
        const { error } = await supabase.rpc('agenda_marcar', {
          p_unidade: unidadeId, p_perfil: prof!.perfil_id, p_inicio: inicio!, p_paciente: paciente!.id,
          p_tipo_atendimento: tipo, p_observacao: obs.trim() || undefined, p_origem_episodio: origem ?? undefined,
          p_servico: servico ?? undefined,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.rpc('agenda_reservar', {
          p_unidade: unidadeId, p_perfil: prof!.perfil_id, p_inicio: inicio!, p_motivo: motivo!, p_especifique: especifique.trim() || undefined,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      setAviso(modo === 'consulta'
        ? `Consulta marcada: ${paciente!.nome_social || paciente!.nome}, ${dataPura(data)} às ${hora(inicio!)} com ${prof!.nome}.`
        : `Horário reservado: ${dataPura(data)} às ${hora(inicio!)} com ${prof!.nome}.`)
      setInicio(null); setPaciente(null); setUsarUrl(false); setTermo(''); setObs(''); setMotivo(null); setEspecifique('')
      void qc.invalidateQueries({ queryKey: ['agenda-dia'] })
    },
  })
  const pronto = !!prof && !!slot && (modo === 'consulta' ? !!paciente : !!motivo && (motivo !== 'outro' || especifique.trim().length >= 3))

  return (
    <section aria-label="Marcar" className="flex flex-col gap-3 rounded-cartao border border-fio bg-campo p-4">
      <div role="radiogroup" aria-label="O que marcar" className="flex gap-2">
        <Chip variante="opcao" radio ativo={modo === 'consulta'} onClick={() => { setModo('consulta'); setAviso(null) }}>Marcar consulta</Chip>
        <Chip variante="opcao" radio ativo={modo === 'reserva'} onClick={() => { setModo('reserva'); setAviso(null) }}>Reservar horário</Chip>
      </div>
      {aviso && <p role="status" className="rounded-container border border-acao/25 bg-acao/5 px-3 py-2 text-apoio text-acao">{aviso}</p>}

      {modo === 'consulta' && (paciente ? (
        <div className="flex items-center justify-between rounded-controle border border-fio bg-superficie px-3 py-2 text-apoio">
          <span className="font-medium text-tinta">{paciente.nome_social || paciente.nome}
            {paciente.data_nascimento && <span className="font-normal text-tinta-sussurro"> · {rotuloIdade(paciente.data_nascimento, hoje)}</span>}</span>
          <Button size="xs" variant="outline" onClick={() => { setPaciente(null); setUsarUrl(false) }}>Trocar</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agenda-paciente">Paciente (nome, CPF, CNS ou prontuário)</Label>
          <Input id="agenda-paciente" value={termo} autoComplete="off" onChange={(e) => setTermo(e.target.value)} />
          {achados.isLoading && <Spinner />}
          {(achados.data ?? []).length > 0 && (
            <ul className="flex flex-col rounded-controle border border-fio bg-superficie">
              {(achados.data ?? []).map((a) => (
                <li key={a.id}>
                  <BotaoLinha variante="linha" onClick={() => setPaciente(a)} className="py-2 text-apoio">
                    {a.nome_social || a.nome}
                    {a.data_nascimento && <span className="text-tinta-sussurro"> · {dataPura(a.data_nascimento)}</span>}
                  </BotaoLinha>
                </li>
              ))}
            </ul>
          )}
          {t.length >= 3 && achados.isSuccess && (achados.data ?? []).length === 0 && (
            <span className="text-rotulo text-tinta-sussurro">Ninguém com esse nome ou documento. O cadastro é feito na Nova ficha.</span>
          )}
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="agenda-profissional">Profissional</Label>
        <CampoSelecao id="agenda-profissional" value={prof?.perfil_id ?? ''} onChange={(e) => { setPerfil(e.target.value); setInicio(null) }}>
          {comAgenda.length !== 1 && <option value="">Escolha…</option>}
          {comAgenda.map((p) => <option key={p.perfil_id} value={p.perfil_id}>{p.nome}</option>)}
        </CampoSelecao>
        {config.isSuccess && comAgenda.length === 0 && <span className="text-rotulo text-atencao">Nenhum profissional com agenda configurada. O gestor configura na aba Configuração.</span>}
      </div>

      {prof && (
        <>
          <Calendario valor={data} hoje={hoje} diasComAgenda={new Set(prof.horarios.map((h) => h.dia))}
            onEscolher={(iso) => { setData(iso); setInicio(null) }} />
          <span className="rotulo text-tinta-sussurro">Horários livres · {rotuloDia(data)}</span>
          {fechado && <span className="text-apoio text-tinta-apoio">Agenda fechada neste dia ({fechado.especifique || fechado.motivo}).</span>}
          {doDia.isLoading && <Spinner />}
          {!fechado && doDia.isSuccess && livres.length === 0 && <span className="text-apoio text-tinta-sussurro">Sem horário livre neste dia.</span>}
          <div role="radiogroup" aria-label="Horário" className="grid grid-cols-3 gap-1.5">
            {livres.map((h) => (
              <Chip key={h.inicio} variante="opcao" radio ativo={inicio === h.inicio} titulo={h.na_escala ? undefined : 'Fora da escala do profissional'}
                onClick={() => setInicio(h.inicio)}>
                <span className={cn('w-full text-center tabular-nums', !h.na_escala && 'text-atencao')}>{hora(h.inicio)}{!h.na_escala && ' *'}</span>
              </Chip>
            ))}
          </div>
          {slot && !slot.na_escala && (
            <span className="flex items-start gap-1.5 text-rotulo text-atencao">
              <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              Fora da escala do profissional neste horário: sem a escala, ele não consegue abrir a consulta.
            </span>
          )}
        </>
      )}

      {modo === 'consulta' ? (
        <>
          {servicos.length > 0 && (
            <div role="radiogroup" aria-label="Serviço" className="flex flex-wrap gap-2">
              {SERVICOS.filter((x) => servicos.includes(x.valor)).map((x) => (
                <Chip key={x.valor} variante="opcao" radio ativo={servico === x.valor} onClick={() => setServico(x.valor)}>{x.rotulo}</Chip>
              ))}
            </div>
          )}
          <div role="radiogroup" aria-label="Tipo da consulta" className="flex flex-wrap gap-2">
            <Chip variante="opcao" radio ativo={tipo === 'consulta_agendada'} onClick={() => setTipo('consulta_agendada')}>Consulta agendada</Chip>
            <Chip variante="opcao" radio ativo={tipo === 'consulta_programada'} onClick={() => setTipo('consulta_programada')}>Cuidado continuado</Chip>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agenda-obs">Observação <span className="font-normal text-tinta-sussurro">(opcional)</span></Label>
            <Textarea id="agenda-obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
          </div>
        </>
      ) : (
        <>
          <div role="radiogroup" aria-label="Motivo da reserva" className="flex flex-wrap gap-2">
            {MOTIVOS_RESERVA.map((m) => <Chip key={m.valor} variante="opcao" radio ativo={motivo === m.valor} onClick={() => setMotivo(m.valor)}>{m.rotulo}</Chip>)}
          </div>
          {motivo === 'outro' && <Input aria-label="Especifique" placeholder="Especifique" value={especifique} onChange={(e) => setEspecifique(e.target.value)} />}
          <span className="text-rotulo text-tinta-sussurro">Reserva é para atividade curta dentro do turno. Período maior (férias, licença) é fechamento, com o gestor.</span>
        </>
      )}

      {marcar.error && <p role="alert" className="text-apoio text-critico">{msg(marcar.error)}</p>}
      <Button disabled={!pronto || marcar.isPending} onClick={() => marcar.mutate()}>
        <CalendarCheck /> {modo === 'consulta' ? 'Marcar' : 'Reservar'}{slot ? ` ${hora(slot.inicio)}` : ''}
      </Button>
    </section>
  )
}
