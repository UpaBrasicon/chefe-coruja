// ─────────────────────────────────────────────────────────────────────────────
// Regulação (Fase 4, tarefa 1; decisões do RT de 10/10/2026).
//
// • Super admin: define a Central de Regulação de cada organização.
// • Unidade de origem (médico ou gestor): abre a solicitação (consulta, exame,
//   leito, transferência), com prioridade, CID e justificativa, ligada ou não a
//   um atendimento/internação aberta; acompanha e cancela com motivo.
// • Central (regulador): vê as recebidas e anota a regulação externa. A fila
//   com filtros e a decisão são as tarefas 2 a 4.
// Migration 20261107000001_regulacao_solicitacao.sql; src/lib/regulacao.ts.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Waypoints } from 'lucide-react'
import * as React from 'react'

import { ESPECIALIDADES } from '@/components/encaminhamento/useEncaminhamentos'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { BuscaTerminologia } from '@/components/terminologia/BuscaTerminologia'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import {
  FORMULARIO_VAZIO, PRIORIDADES, STATUS, TIPOS, TIPOS_LEITO, TRANSPORTES, dadosParaEnvio, faltasFormulario, resumoPedido,
  type DestinoTipo, type Formulario, type Prioridade, type StatusRegulacao, type TipoSolicitacao,
} from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'
import { Erro } from '@/pages/farmacia/Farmacia'

type Ref = { id: string; nome: string }
type Contexto = {
  central: Ref | null; sou_central: boolean; pode_solicitar: boolean; sou_regulador: boolean; sou_super_admin: boolean
  unidades_rede: Ref[]
}
type Solicitacao = {
  id: string; numero: number; status: StatusRegulacao; tipo: TipoSolicitacao; prioridade: Prioridade
  especialidade: string | null; procedimento: string | null; procedimento_nome: string | null
  tipo_leito: string | null; transporte: string | null
  destino_tipo: DestinoTipo; destino_unidade: Ref | null; destino_externo: string | null
  cid: string; cid_descricao: string | null; justificativa: string
  paciente: { id: string; nome: string; nascimento: string | null; sexo: string | null; cns: string | null }
  episodio_id: string | null; internacao_id: string | null; origem: Ref; central: Ref
  solicitante: string | null; solicitante_papel: 'medico' | 'gestor'; medico_assistente: string | null
  externo_sistema: string | null; externo_protocolo: string | null
  criada_em: string; cancelada_em: string | null; motivo_cancelamento: string | null
  eventos?: { evento: string; por: string | null; em: string; detalhes: Record<string, unknown> | null }[]
}

const TOM: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critico: 'destructive', atencao: 'warning', info: 'info', neutro: 'secondary',
}

export default function Regulacao() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id ?? ''
  const ctx = useQuery({
    queryKey: ['regulacao-contexto', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_contexto', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Contexto
    },
  })
  const c = ctx.data
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={Waypoints} titulo="Regulação"
        descricao={c?.sou_central
          ? 'Solicitações recebidas pela Central de Regulação da rede.'
          : 'Pedidos de consulta, exame, leito ou transferência para a Central de Regulação da rede.'} />
      {c?.sou_super_admin && <Centrais />}
      {!unidadeId ? null : ctx.isLoading ? <Spinner /> : ctx.error ? <Erro texto={(ctx.error as Error).message} /> : !c ? null
        : c.sou_central ? <Lista unidadeId={unidadeId} central podeRegistrarExterno={c.sou_regulador} />
        : !c.central ? (
          <Vazio icone={Waypoints} titulo="A rede ainda não tem Central de Regulação"
            texto="A administração da plataforma define a central da organização. Até lá, não há para onde enviar." />
        ) : c.pode_solicitar ? (
          <>
            <NovaSolicitacao unidadeId={unidadeId} ctx={c} />
            <Lista unidadeId={unidadeId} central={false} podeRegistrarExterno={false} />
          </>
        ) : null}
    </div>
  )
}

function Centrais() {
  const qc = useQueryClient()
  const lista = useQuery({
    queryKey: ['regulacao-centrais'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_centrais')
      if (error) throw error
      return (data ?? []) as unknown as { organizacao_id: string; organizacao: string; central: Ref | null; unidades: Ref[] }[]
    },
  })
  const definir = useMutation({
    mutationFn: async (unidade: string) => {
      const { error } = await supabase.rpc('regulacao_definir_central', { p_unidade: unidade })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['regulacao-centrais'] }); void qc.invalidateQueries({ queryKey: ['regulacao-contexto'] }) },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Centrais de regulação</CardTitle>
        <CardDescription>Uma central por organização. Os médicos reguladores ficam vinculados a ela com o papel "regulador".</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-apoio">
        {lista.isLoading ? <Spinner /> : (lista.data ?? []).map((o) => (
          <div key={o.organizacao_id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-48 font-medium text-tinta">{o.organizacao}</span>
            <select aria-label={`Central de ${o.organizacao}`} className="h-8 rounded-controle border border-fio bg-campo px-2"
              value={o.central?.id ?? ''} onChange={(e) => e.target.value && definir.mutate(e.target.value)} disabled={definir.isPending}>
              <option value="">Sem central</option>
              {o.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
        ))}
        <Erro texto={(lista.error ?? definir.error) ? ((lista.error ?? definir.error) as Error).message : null} />
      </CardContent>
    </Card>
  )
}

type Paciente = { id: string; nome: string; nome_social: string | null; data_nascimento: string | null; prontuario: string | null }
type Vinculos = {
  episodio: { id: string; chegada_em: string; etapa: string } | null
  internacao: { id: string; admissao_em: string; leito: string | null } | null
  medicos: Ref[]
}

function NovaSolicitacao({ unidadeId, ctx }: { unidadeId: string; ctx: Contexto }) {
  const qc = useQueryClient()
  // quem é médico e gestor na unidade solicita como médico (o banco decide igual)
  const { papeisDaUnidade } = useUnidade()
  const souGestor = papeisDaUnidade.includes('gestor') && !papeisDaUnidade.includes('plantonista')
  const [termo, setTermo] = React.useState('')
  const [paciente, setPaciente] = React.useState<Paciente | null>(null)
  const [ligar, setLigar] = React.useState<'episodio' | 'internacao' | 'nenhum'>('nenhum')
  const [medico, setMedico] = React.useState('')
  const [f, setF] = React.useState<Formulario>(FORMULARIO_VAZIO)
  const [cidRotulo, setCidRotulo] = React.useState('')
  const [procRotulo, setProcRotulo] = React.useState('')
  const [enviada, setEnviada] = React.useState<number | null>(null)
  const set = <K extends keyof Formulario>(k: K, v: Formulario[K]) => setF((x) => ({ ...x, [k]: v }))

  const busca = useQuery({
    queryKey: ['regulacao-busca-paciente', unidadeId, termo],
    enabled: termo.trim().length >= 3 && !paciente,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId, p_termo: termo.trim() })
      if (error) throw error
      return (data ?? []) as unknown as Paciente[]
    },
  })
  const vinculos = useQuery({
    queryKey: ['regulacao-vinculos', paciente?.id],
    enabled: !!paciente,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_vinculos_paciente', { p_paciente: paciente!.id })
      if (error) throw error
      const v = data as unknown as Vinculos
      setLigar(v.internacao ? 'internacao' : v.episodio ? 'episodio' : 'nenhum')
      return v
    },
  })
  const enviar = useMutation({
    mutationFn: async () => {
      const v = vinculos.data
      const { data, error } = await supabase.rpc('regulacao_solicitar', {
        p_unidade: unidadeId, p_paciente: paciente!.id,
        p_dados: dadosParaEnvio(f, {
          episodio_id: ligar === 'episodio' ? v?.episodio?.id : null,
          internacao_id: ligar === 'internacao' ? v?.internacao?.id : null,
          medico_assistente_id: souGestor ? medico || null : null,
        }),
      })
      if (error) throw error
      return (data as unknown as { numero: number }).numero
    },
    onSuccess: (numero) => {
      setEnviada(numero); setF(FORMULARIO_VAZIO); setCidRotulo(''); setProcRotulo(''); setPaciente(null); setTermo(''); setMedico('')
      void qc.invalidateQueries({ queryKey: ['regulacao-lista', unidadeId] })
    },
  })
  const faltas = faltasFormulario(f)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nova solicitação</CardTitle>
        <CardDescription>Vai para a {ctx.central?.nome}. O autor é quem está logado.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {enviada && <p role="status" className="text-sucesso">Solicitação nº {enviada} enviada à central.</p>}

        {/* paciente */}
        {paciente ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-fio bg-campo px-3 py-2">
            <span className="font-medium text-tinta">{paciente.nome_social ?? paciente.nome}</span>
            {paciente.data_nascimento && <span className="text-tinta-sussurro">nasc. {fmtData(paciente.data_nascimento)}</span>}
            {paciente.prontuario && <span className="text-tinta-sussurro">pront. {paciente.prontuario}</span>}
            <Button size="xs" variant="ghost" className="ml-auto" onClick={() => { setPaciente(null); setTermo('') }}>Trocar</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <Label htmlFor="reg-paciente" className="text-xs">Paciente (nome, CPF, CNS ou prontuário)</Label>
            <Input id="reg-paciente" className="h-8" value={termo} onChange={(e) => { setTermo(e.target.value); setEnviada(null) }} />
            {busca.isFetching && <Spinner />}
            {(busca.data ?? []).length > 0 && (
              <ul className="flex flex-col divide-y divide-fio rounded-md border border-fio">
                {(busca.data ?? []).slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <button type="button" className="w-full px-3 py-1.5 text-left hover:bg-campo" onClick={() => setPaciente(p)}>
                      {p.nome_social ?? p.nome} {p.data_nascimento && <span className="text-tinta-sussurro">· {fmtData(p.data_nascimento)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {termo.trim().length >= 3 && !busca.isFetching && (busca.data ?? []).length === 0 && <span className="text-tinta-sussurro">Nenhum paciente com esse termo.</span>}
          </div>
        )}

        {paciente && (
          <>
            {/* vínculo com atendimento/internação aberta */}
            {vinculos.data && (vinculos.data.episodio || vinculos.data.internacao) && (
              <fieldset className="flex flex-col gap-1">
                <legend className="text-xs text-tinta-apoio">Ligar a</legend>
                {vinculos.data.internacao && (
                  <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'internacao'} onChange={() => setLigar('internacao')} />
                    Internação aberta{vinculos.data.internacao.leito ? `, leito ${vinculos.data.internacao.leito}` : ''} (desde {fmtDataHora(vinculos.data.internacao.admissao_em)})</label>
                )}
                {vinculos.data.episodio && (
                  <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'episodio'} onChange={() => setLigar('episodio')} />
                    Atendimento aberto (chegada {fmtDataHora(vinculos.data.episodio.chegada_em)})</label>
                )}
                <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'nenhum'} onChange={() => setLigar('nenhum')} />
                  Só ao paciente</label>
              </fieldset>
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="reg-tipo" className="text-xs">Tipo</Label>
                <select id="reg-tipo" className="h-8 rounded-controle border border-fio bg-campo px-2" value={f.tipo}
                  onChange={(e) => set('tipo', e.target.value as TipoSolicitacao)}>
                  {(Object.keys(TIPOS) as TipoSolicitacao[]).map((k) => <option key={k} value={k}>{TIPOS[k]}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                {f.tipo === 'consulta' && (<>
                  <Label htmlFor="reg-esp" className="text-xs">Especialidade</Label>
                  <Input id="reg-esp" className="h-8" list="reg-especialidades" value={f.especialidade} onChange={(e) => set('especialidade', e.target.value)} />
                  <datalist id="reg-especialidades">{ESPECIALIDADES.map((e) => <option key={e} value={e} />)}</datalist>
                </>)}
                {f.tipo === 'exame' && (<>
                  <span className="text-xs text-tinta-apoio">Procedimento (SIGTAP){procRotulo && <b className="ml-1 text-tinta">{procRotulo}</b>}</span>
                  <BuscaTerminologia tipo="sigtap_procedimento" onSelecionar={(r) => { set('procedimento', r.codigo); setProcRotulo(`${r.codigo} ${r.descricao}`) }} />
                </>)}
                {f.tipo === 'leito' && (<>
                  <Label htmlFor="reg-leito" className="text-xs">Tipo de leito</Label>
                  <select id="reg-leito" className="h-8 rounded-controle border border-fio bg-campo px-2" value={f.tipo_leito} onChange={(e) => set('tipo_leito', e.target.value)}>
                    <option value="">Escolha…</option>
                    {Object.entries(TIPOS_LEITO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </>)}
                {f.tipo === 'transferencia' && (<>
                  <Label htmlFor="reg-transp" className="text-xs">Transporte</Label>
                  <select id="reg-transp" className="h-8 rounded-controle border border-fio bg-campo px-2" value={f.transporte} onChange={(e) => set('transporte', e.target.value)}>
                    <option value="">Escolha…</option>
                    {Object.entries(TRANSPORTES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </>)}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="reg-destino" className="text-xs">Destino</Label>
                <select id="reg-destino" className="h-8 rounded-controle border border-fio bg-campo px-2" value={f.destino_tipo}
                  onChange={(e) => set('destino_tipo', e.target.value as DestinoTipo)}>
                  <option value="a_definir">A definir pela regulação</option>
                  <option value="rede">Unidade da rede</option>
                  <option value="externo">Serviço fora da rede</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                {f.destino_tipo === 'rede' && (<>
                  <Label htmlFor="reg-dest-un" className="text-xs">Unidade</Label>
                  <select id="reg-dest-un" className="h-8 rounded-controle border border-fio bg-campo px-2" value={f.destino_unidade_id} onChange={(e) => set('destino_unidade_id', e.target.value)}>
                    <option value="">Escolha…</option>
                    {ctx.unidades_rede.filter((u) => u.id !== unidadeId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </>)}
                {f.destino_tipo === 'externo' && (<>
                  <Label htmlFor="reg-dest-ext" className="text-xs">Serviço (nome e município)</Label>
                  <Input id="reg-dest-ext" className="h-8" value={f.destino_externo} onChange={(e) => set('destino_externo', e.target.value)} />
                </>)}
              </div>
            </div>

            <fieldset className="flex flex-col gap-1">
              <legend className="text-xs text-tinta-apoio">Prioridade proposta (o regulador pode revisar)</legend>
              <div className="flex flex-wrap gap-3">
                {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => (
                  <label key={k} className="flex items-center gap-1.5" title={PRIORIDADES[k].descricao}>
                    <input type="radio" name="reg-prioridade" className="size-4" checked={f.prioridade === k} onChange={() => set('prioridade', k)} />
                    {PRIORIDADES[k].rotulo}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-tinta-apoio">CID-10{cidRotulo && <b className="ml-1 text-tinta">{cidRotulo}</b>}</span>
              <BuscaTerminologia tipo="cid10" onSelecionar={(r) => { set('cid', r.codigo); setCidRotulo(`${r.codigo} ${r.descricao}`) }} />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="reg-just" className="text-xs">Justificativa clínica</Label>
              <textarea id="reg-just" rows={4} className="rounded-controle border border-fio bg-campo px-2 py-1.5"
                value={f.justificativa} onChange={(e) => set('justificativa', e.target.value)} />
            </div>

            {souGestor && vinculos.data && (
              <div className="flex max-w-sm flex-col gap-1">
                <Label htmlFor="reg-medico" className="text-xs">Médico assistente (fica informado)</Label>
                <select id="reg-medico" className="h-8 rounded-controle border border-fio bg-campo px-2" value={medico} onChange={(e) => setMedico(e.target.value)}>
                  <option value="">Não informar</option>
                  {vinculos.data.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
            )}

            <Erro texto={enviar.error ? (enviar.error as Error).message : null} />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => enviar.mutate()} disabled={faltas.length > 0 || enviar.isPending}>
                {enviar.isPending ? <Spinner /> : <Send className="size-4" />} Enviar à central
              </Button>
              {faltas.length > 0 && <span className="text-atencao">Falta: {faltas.join(', ')}.</span>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Lista({ unidadeId, central, podeRegistrarExterno }: { unidadeId: string; central: boolean; podeRegistrarExterno: boolean }) {
  const lista = useQuery({
    queryKey: ['regulacao-lista', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_lista', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as Solicitacao[]
    },
  })
  const [aberta, setAberta] = React.useState<string | null>(null)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{central ? 'Recebidas' : 'Solicitações da unidade'}</CardTitle>
        {central && <CardDescription>As 200 mais recentes. A fila com filtros e a decisão chegam nas próximas tarefas.</CardDescription>}
      </CardHeader>
      <CardContent className="text-apoio">
        {lista.isLoading ? <Spinner /> : lista.error ? <Erro texto={(lista.error as Error).message} /> : (lista.data ?? []).length === 0 ? (
          <Vazio icone={Waypoints} titulo="Nenhuma solicitação" texto={central ? 'As solicitações das unidades da rede aparecem aqui.' : 'As solicitações enviadas pela unidade aparecem aqui.'} />
        ) : (
          <ul className="flex flex-col divide-y divide-fio">
            {(lista.data ?? []).map((s) => (
              <li key={s.id} className="py-2">
                <button type="button" className="flex w-full flex-wrap items-center gap-2 text-left" onClick={() => setAberta(aberta === s.id ? null : s.id)}>
                  <span className="text-tinta-sussurro">nº {s.numero}</span>
                  <Badge variant={TOM[PRIORIDADES[s.prioridade].tom]}>{PRIORIDADES[s.prioridade].rotulo}</Badge>
                  <span className="font-medium text-tinta">{s.paciente.nome}</span>
                  <span className="text-tinta-apoio">{resumoPedido(s)}</span>
                  {central && <span className="text-tinta-sussurro">de {s.origem.nome}</span>}
                  <Badge variant={s.status === 'cancelada' ? 'secondary' : 'info'} className="ml-auto">{STATUS[s.status]}</Badge>
                  <span className="text-tinta-sussurro">{fmtDataHora(s.criada_em)}</span>
                </button>
                {aberta === s.id && <Detalhe id={s.id} unidadeId={unidadeId} central={central} podeRegistrarExterno={podeRegistrarExterno} />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Detalhe({ id, unidadeId, central, podeRegistrarExterno }: { id: string; unidadeId: string; central: boolean; podeRegistrarExterno: boolean }) {
  const qc = useQueryClient()
  const d = useQuery({
    queryKey: ['regulacao-detalhe', id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_detalhe', { p_id: id })
      if (error) throw error
      return data as unknown as Solicitacao
    },
  })
  const [motivo, setMotivo] = React.useState('')
  const [sistema, setSistema] = React.useState('')
  const [protocolo, setProtocolo] = React.useState('')
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['regulacao-detalhe', id] })
    void qc.invalidateQueries({ queryKey: ['regulacao-lista', unidadeId] })
  }
  const cancelar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_cancelar', { p_id: id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { setMotivo(''); recarregar() },
  })
  const externo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('regulacao_registrar_externo', { p_id: id, p_sistema: sistema.trim(), p_protocolo: protocolo.trim() })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  if (d.isLoading) return <Spinner />
  if (d.error || !d.data) return <Erro texto={d.error ? (d.error as Error).message : 'Não encontrada.'} />
  const s = d.data
  const destino = s.destino_tipo === 'rede' ? s.destino_unidade?.nome : s.destino_tipo === 'externo' ? `${s.destino_externo} (fora da rede)` : 'A definir pela regulação'
  const cancelavel = !central && ['enviada', 'em_analise', 'devolvida'].includes(s.status)
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-fio bg-campo p-3">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <div><dt className="inline text-tinta-sussurro">Pedido: </dt><dd className="inline">{resumoPedido(s)}</dd></div>
        <div><dt className="inline text-tinta-sussurro">Destino: </dt><dd className="inline">{destino}</dd></div>
        <div><dt className="inline text-tinta-sussurro">CID: </dt><dd className="inline">{s.cid} {s.cid_descricao}</dd></div>
        <div><dt className="inline text-tinta-sussurro">Origem: </dt><dd className="inline">{s.origem.nome}{s.internacao_id ? ' · internação' : s.episodio_id ? ' · atendimento' : ''}</dd></div>
        <div><dt className="inline text-tinta-sussurro">Solicitante: </dt><dd className="inline">{s.solicitante} ({s.solicitante_papel === 'medico' ? 'médico' : 'gestor/NIR'})</dd></div>
        <div><dt className="inline text-tinta-sussurro">Médico assistente: </dt><dd className="inline">{s.medico_assistente ?? '—'}</dd></div>
        {s.externo_protocolo && <div><dt className="inline text-tinta-sussurro">Regulação externa: </dt><dd className="inline">{s.externo_sistema} · {s.externo_protocolo}</dd></div>}
      </dl>
      <p className="whitespace-pre-wrap text-tinta"><span className="text-tinta-sussurro">Justificativa: </span>{s.justificativa}</p>
      {s.motivo_cancelamento && <p className="text-tinta-apoio">Cancelada: {s.motivo_cancelamento}</p>}
      <ul className="text-rotulo text-tinta-sussurro">
        {(s.eventos ?? []).map((e, i) => <li key={i}>{fmtDataHora(e.em)} · {e.evento.replace('_', ' ')} · {e.por ?? '—'}</li>)}
      </ul>
      {podeRegistrarExterno && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1"><Label htmlFor={`ext-sis-${id}`} className="text-xs">Sistema externo</Label>
            <Input id={`ext-sis-${id}`} className="h-8" placeholder="SISREG, e-SUS Regulação, central estadual" value={sistema} onChange={(e) => setSistema(e.target.value)} /></div>
          <div className="flex flex-col gap-1"><Label htmlFor={`ext-prot-${id}`} className="text-xs">Nº do protocolo</Label>
            <Input id={`ext-prot-${id}`} className="h-8" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} /></div>
          <Button size="sm" variant="outline" onClick={() => externo.mutate()} disabled={externo.isPending || sistema.trim().length < 2 || protocolo.trim().length < 3}>Registrar</Button>
        </div>
      )}
      {cancelavel && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-60 flex-1 flex-col gap-1"><Label htmlFor={`canc-${id}`} className="text-xs">Motivo do cancelamento</Label>
            <Input id={`canc-${id}`} className="h-8" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
          <Button size="sm" variant="destructive" onClick={() => cancelar.mutate()} disabled={cancelar.isPending || motivo.trim().length < 10}>Cancelar solicitação</Button>
        </div>
      )}
      <Erro texto={(cancelar.error ?? externo.error) ? ((cancelar.error ?? externo.error) as Error).message : null} />
    </div>
  )
}
