// ─────────────────────────────────────────────────────────────────────────────
// Regulação (Fase 4, tarefa 1; decisões do RT de 10/10/2026, revistas em
// 11/10/2026 depois da pesquisa dos sistemas de regulação).
//
// • Super admin: define a Central de Regulação de cada organização.
// • Unidade de origem (médico ou gestor): abre a solicitação (consulta, exame,
//   leito, transferência) com os campos do MIRA — procedimento SIGTAP, caráter,
//   CID-10, CBO na consulta —, prioridade (4 níveis ou não classificada) e o
//   quadro clínico em blocos; liga ou não a um atendimento/internação aberta;
//   acompanha e cancela com motivo.
// • Central (regulador): fila ordenada (não classificadas no topo, depois
//   prioridade e espera), com filtros, busca, "Assumir" e "Devolver à fila",
//   atualizada a cada 30 s (tarefa 2); anota a regulação externa e a
//   prioridade da central. A decisão é a tarefa 4.
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
  CARATER, FORMULARIO_VAZIO, INTERNACAO_PSIQUIATRICA, ISOLAMENTOS, PRIORIDADES, STATUS, TIPOS, TIPOS_LEITO, TRANSPORTES,
  dadosParaEnvio, ehNeonato, faltasFormulario, filtrosParaEnvio, formatarEspera, novosDesde, resumoPedido,
  type Carater, type DestinoTipo, type FiltrosFila, type Formulario, type Prioridade, type StatusRegulacao, type TipoSolicitacao,
} from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import { Erro } from '@/pages/farmacia/Farmacia'

type Ref = { id: string; nome: string }
type Contexto = {
  central: Ref | null; sou_central: boolean; pode_solicitar: boolean; sou_regulador: boolean; sou_super_admin: boolean
  unidades_rede: Ref[]
}
type Solicitacao = {
  id: string; numero: number; status: StatusRegulacao; tipo: TipoSolicitacao; carater: Carater; modalidade: string
  prioridade: Prioridade; prioridade_central: string | null
  procedimento: string; procedimento_nome: string | null; especialidade: string | null; cbo: string | null
  tipo_leito: string | null; internacao_psiquiatrica: string | null; isolamento: boolean; isolamento_tipo: string | null
  transporte: string | null; transporte_central: string | null; incubadora: boolean | null
  destino_tipo: DestinoTipo; destino_unidade: Ref | null; destino_externo: string | null
  cid: string; cid_descricao: string | null
  quadro_clinico: string; tempo_evolucao: string | null; sinais_vitais: string | null; exames: string | null
  medicacoes: string | null; hipotese: string | null; telefone_contato: string | null
  paciente: { id: string; nome: string; nascimento: string | null; sexo: string | null; cns: string | null }
  paciente_nao_identificado: boolean
  episodio_id: string | null; internacao_id: string | null; origem: Ref; cnes_solicitante: string; central: Ref
  solicitante: string | null; solicitante_papel: 'medico' | 'gestor'; medico_assistente: string | null
  externo_sistema: string | null; externo_protocolo: string | null
  criada_em: string; cancelada_em: string | null; cancelamento_origem: string | null; motivo_cancelamento: string | null
  eventos?: { evento: string; por: string | null; em: string; detalhes: Record<string, unknown> | null }[]
}

const TOM: Record<string, 'destructive' | 'warning' | 'info' | 'secondary'> = {
  critico: 'destructive', atencao: 'warning', info: 'info', neutro: 'secondary',
}
const SELECT = 'h-8 rounded-controle border border-fio bg-campo px-2'
const hoje = () => new Date().toLocaleDateString('sv-SE')

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
        : c.sou_central ? <Fila centralId={unidadeId} souRegulador={c.sou_regulador} />
        : !c.central ? (
          <Vazio icone={Waypoints} titulo="A rede ainda não tem Central de Regulação"
            texto="A administração da plataforma define a central da organização. Até lá, não há para onde enviar." />
        ) : c.pode_solicitar ? (
          <>
            <NovaSolicitacao unidadeId={unidadeId} ctx={c} />
            <Lista unidadeId={unidadeId} central={false} podeRegistrarExterno={false} />
          </>
        ) : (
          <Vazio icone={Waypoints} titulo="Sem acesso à regulação nesta unidade" texto="Solicitam o médico e o gestor da unidade; quem regula é a central da rede." />
        )}
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
            <select aria-label={`Central de ${o.organizacao}`} className={SELECT}
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
  tem_documento: boolean; nascimento: string | null
  episodio: { id: string; chegada_em: string; etapa: string } | null
  internacao: { id: string; admissao_em: string; leito: string | null } | null
  medicos: Ref[]
}

function Campo({ id, rotulo, children, className }: { id?: string; rotulo: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ''}`}>
      {id ? <Label htmlFor={id} className="text-xs">{rotulo}</Label> : <span className="text-xs text-tinta-apoio">{rotulo}</span>}
      {children}
    </div>
  )
}

/** Busca de terminologia em linha própria; escolhido o item, mostra o código e "Trocar". */
function CampoTerminologia({ rotulo, tipo, escolhido, onEscolher, onLimpar }: {
  rotulo: React.ReactNode; tipo: 'sigtap_procedimento' | 'cbo' | 'cid10'; escolhido: string
  onEscolher: (codigo: string, rotulo: string) => void; onLimpar: () => void
}) {
  return (
    <Campo rotulo={rotulo}>
      {escolhido ? (
        <div className="flex items-center gap-2 rounded-controle border border-fio bg-campo px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate text-tinta">{escolhido}</span>
          <Button size="xs" variant="ghost" onClick={onLimpar}>Trocar</Button>
        </div>
      ) : (
        <BuscaTerminologia tipo={tipo} onSelecionar={(r) => onEscolher(r.codigo, `${r.codigo} ${r.descricao}`)} />
      )}
    </Campo>
  )
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
  const [naoIdentificado, setNaoIdentificado] = React.useState(false)
  const [f, setF] = React.useState<Formulario>(FORMULARIO_VAZIO)
  const [cidRotulo, setCidRotulo] = React.useState('')
  const [procRotulo, setProcRotulo] = React.useState('')
  const [cboRotulo, setCboRotulo] = React.useState('')
  const [enviada, setEnviada] = React.useState<{ numero: number; duplicidade: boolean } | null>(null)
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
  const v = vinculos.data
  const neonato = ehNeonato(v?.nascimento, hoje())
  const enviar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_solicitar', {
        p_unidade: unidadeId, p_paciente: paciente!.id,
        p_dados: dadosParaEnvio(f, {
          episodio_id: ligar === 'episodio' ? v?.episodio?.id : null,
          internacao_id: ligar === 'internacao' ? v?.internacao?.id : null,
          medico_assistente_id: souGestor ? medico || null : null,
          paciente_nao_identificado: !v?.tem_documento && naoIdentificado,
        }),
      })
      if (error) throw error
      return data as unknown as { numero: number; aviso_duplicidade: boolean }
    },
    onSuccess: (r) => {
      setEnviada({ numero: r.numero, duplicidade: r.aviso_duplicidade })
      setF(FORMULARIO_VAZIO); setCidRotulo(''); setProcRotulo(''); setCboRotulo(''); setPaciente(null); setTermo(''); setMedico('')
      setNaoIdentificado(false)
      void qc.invalidateQueries({ queryKey: ['regulacao-lista', unidadeId] })
    },
  })
  const faltas = faltasFormulario(f, { neonato, semDocumento: v ? !v.tem_documento : false, naoIdentificado })
  const leitoOuTransf = f.tipo === 'leito' || f.tipo === 'transferencia'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Nova solicitação</CardTitle>
        <CardDescription>Vai para a {ctx.central?.nome}. O autor é quem está logado. Os campos seguem o modelo nacional (MIRA).</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        {enviada && (
          <p role="status" className="text-sucesso">
            Solicitação nº {enviada.numero} enviada à central.
            {enviada.duplicidade && <span className="ml-1 text-atencao">Atenção: já havia um pedido aberto igual para este paciente.</span>}
          </p>
        )}

        {/* paciente */}
        {paciente ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-fio bg-campo px-3 py-2">
            <span className="font-medium text-tinta">{paciente.nome_social ?? paciente.nome}</span>
            {paciente.data_nascimento && <span className="text-tinta-sussurro">nasc. {fmtData(paciente.data_nascimento)}</span>}
            {paciente.prontuario && <span className="text-tinta-sussurro">pront. {paciente.prontuario}</span>}
            {neonato && <Badge variant="info">recém-nascido</Badge>}
            <Button size="xs" variant="ghost" className="ml-auto" onClick={() => { setPaciente(null); setTermo('') }}>Trocar</Button>
          </div>
        ) : (
          <Campo id="reg-paciente" rotulo="Paciente (nome, CPF, CNS ou prontuário)">
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
          </Campo>
        )}

        {paciente && v && (
          <>
            {!v.tem_documento && (
              <label className="flex items-start gap-2 rounded-md border border-atencao/30 bg-alerta-atencao px-3 py-2 text-atencao">
                <input type="checkbox" className="mt-0.5 size-4" checked={naoIdentificado} onChange={(e) => setNaoIdentificado(e.target.checked)} />
                O paciente está sem CNS e sem CPF válidos. Complete o cadastro, ou marque aqui para enviar como paciente não identificado.
              </label>
            )}
            {(v.episodio || v.internacao) && (
              <fieldset className="flex flex-col gap-1">
                <legend className="text-xs text-tinta-apoio">Ligar a</legend>
                {v.internacao && (
                  <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'internacao'} onChange={() => setLigar('internacao')} />
                    Internação aberta{v.internacao.leito ? `, leito ${v.internacao.leito}` : ''} (desde {fmtDataHora(v.internacao.admissao_em)})</label>
                )}
                {v.episodio && (
                  <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'episodio'} onChange={() => setLigar('episodio')} />
                    Atendimento aberto (chegada {fmtDataHora(v.episodio.chegada_em)})</label>
                )}
                <label className="flex items-center gap-2"><input type="radio" className="size-4" checked={ligar === 'nenhum'} onChange={() => setLigar('nenhum')} />
                  Só ao paciente</label>
              </fieldset>
            )}

            {/* o que se pede */}
            <Campo id="reg-tipo" rotulo="Tipo" className="sm:max-w-xs">
              <select id="reg-tipo" className={SELECT} value={f.tipo} onChange={(e) => set('tipo', e.target.value as TipoSolicitacao)}>
                {(Object.keys(TIPOS) as TipoSolicitacao[]).map((k) => <option key={k} value={k}>{TIPOS[k]}</option>)}
              </select>
            </Campo>
            <CampoTerminologia tipo="sigtap_procedimento" escolhido={procRotulo}
              rotulo={<>Procedimento (SIGTAP){f.tipo === 'leito' && ' — o da internação'}</>}
              onEscolher={(c, r) => { set('procedimento', c); setProcRotulo(r) }} onLimpar={() => { set('procedimento', ''); setProcRotulo('') }} />
            {f.tipo === 'consulta' && (
              <>
                <Campo id="reg-esp" rotulo="Especialidade" className="sm:max-w-md">
                  <Input id="reg-esp" className="h-8" list="reg-especialidades" value={f.especialidade} onChange={(e) => set('especialidade', e.target.value)} />
                  <datalist id="reg-especialidades">{ESPECIALIDADES.map((e) => <option key={e} value={e} />)}</datalist>
                </Campo>
                <CampoTerminologia tipo="cbo" escolhido={cboRotulo} rotulo="CBO da especialidade"
                  onEscolher={(c, r) => { set('cbo', c); setCboRotulo(r) }} onLimpar={() => { set('cbo', ''); setCboRotulo('') }} />
              </>
            )}
            {leitoOuTransf && (
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo id="reg-leito" rotulo={f.tipo === 'leito' ? 'Tipo de leito' : 'Leito no destino (se for internar)'}>
                  <select id="reg-leito" className={SELECT} value={f.tipo_leito} onChange={(e) => set('tipo_leito', e.target.value)}>
                    <option value="">{f.tipo === 'leito' ? 'Escolha…' : 'Não se aplica'}</option>
                    {Object.entries(TIPOS_LEITO).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                  </select>
                </Campo>
                {f.tipo_leito === 'psiquiatrico' && (
                  <Campo id="reg-psiq" rotulo="Internação psiquiátrica">
                    <select id="reg-psiq" className={SELECT} value={f.internacao_psiquiatrica} onChange={(e) => set('internacao_psiquiatrica', e.target.value)}>
                      <option value="">Escolha…</option>
                      {Object.entries(INTERNACAO_PSIQUIATRICA).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                    </select>
                  </Campo>
                )}
                {f.tipo === 'transferencia' && (
                  <Campo id="reg-transp" rotulo="Transporte solicitado (a central define o final)">
                    <select id="reg-transp" className={SELECT} value={f.transporte} onChange={(e) => set('transporte', e.target.value)}>
                      <option value="">Escolha…</option>
                      {Object.entries(TRANSPORTES).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                    </select>
                  </Campo>
                )}
                {f.tipo === 'transferencia' && neonato && (
                  <Campo id="reg-incub" rotulo="Incubadora">
                    <select id="reg-incub" className={SELECT} value={f.incubadora} onChange={(e) => set('incubadora', e.target.value as Formulario['incubadora'])}>
                      <option value="">Escolha…</option><option value="sim">Sim</option><option value="nao">Não</option>
                    </select>
                  </Campo>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={f.isolamento} onChange={(e) => set('isolamento', e.target.checked)} />
                Precisa de isolamento</label>
              {f.isolamento && (
                <select aria-label="Tipo de isolamento" className={SELECT} value={f.isolamento_tipo} onChange={(e) => set('isolamento_tipo', e.target.value)}>
                  <option value="">Tipo…</option>
                  {Object.entries(ISOLAMENTOS).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
                </select>
              )}
            </div>

            {/* destino */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo id="reg-destino" rotulo="Destino">
                <select id="reg-destino" className={SELECT} value={f.destino_tipo} onChange={(e) => set('destino_tipo', e.target.value as DestinoTipo)}>
                  <option value="a_definir">A definir pela regulação</option>
                  <option value="rede">Unidade da rede</option>
                  <option value="externo">Serviço fora da rede</option>
                </select>
              </Campo>
              {f.destino_tipo === 'rede' && (
                <Campo id="reg-dest-un" rotulo="Unidade" className="sm:col-span-2">
                  <select id="reg-dest-un" className={SELECT} value={f.destino_unidade_id} onChange={(e) => set('destino_unidade_id', e.target.value)}>
                    <option value="">Escolha…</option>
                    {ctx.unidades_rede.filter((u) => u.id !== unidadeId).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                  </select>
                </Campo>
              )}
              {f.destino_tipo === 'externo' && (
                <Campo id="reg-dest-ext" rotulo="Serviço (nome e município)" className="sm:col-span-2">
                  <Input id="reg-dest-ext" className="h-8" value={f.destino_externo} onChange={(e) => set('destino_externo', e.target.value)} />
                </Campo>
              )}
            </div>

            {/* caráter e prioridade */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Campo id="reg-carater" rotulo="Caráter">
                <select id="reg-carater" className={SELECT} value={f.carater} onChange={(e) => set('carater', e.target.value as Carater)}>
                  <option value="">Escolha…</option>
                  {(Object.keys(CARATER) as Carater[]).map((k) => <option key={k} value={k}>{CARATER[k]}</option>)}
                </select>
              </Campo>
              <fieldset className="flex flex-col gap-1 sm:col-span-2">
                <legend className="text-xs text-tinta-apoio">Prioridade proposta (o regulador da central revisa)</legend>
                <div className="flex flex-wrap gap-3">
                  {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => (
                    <label key={k} className="flex items-center gap-1.5" title={PRIORIDADES[k].descricao}>
                      <input type="radio" name="reg-prioridade" className="size-4" checked={f.prioridade === k} onChange={() => set('prioridade', k)} />
                      {PRIORIDADES[k].rotulo}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* justificativa em blocos */}
            <CampoTerminologia tipo="cid10" escolhido={cidRotulo} rotulo="CID-10"
              onEscolher={(c, r) => { set('cid', c); setCidRotulo(r) }} onLimpar={() => { set('cid', ''); setCidRotulo('') }} />
            <Campo id="reg-quadro" rotulo="Quadro clínico (obrigatório)">
              <textarea id="reg-quadro" rows={4} className="rounded-controle border border-fio bg-campo px-2 py-1.5"
                value={f.quadro_clinico} onChange={(e) => set('quadro_clinico', e.target.value)} />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo id="reg-evol" rotulo="Tempo de evolução"><Input id="reg-evol" className="h-8" value={f.tempo_evolucao} onChange={(e) => set('tempo_evolucao', e.target.value)} /></Campo>
              <Campo id="reg-sv" rotulo="Sinais vitais, com a hora">
                <Input id="reg-sv" className="h-8" placeholder="PA, FC, FR, SpO₂, Tax, às hh:mm (PA não obrigatória na criança)" value={f.sinais_vitais} onChange={(e) => set('sinais_vitais', e.target.value)} />
              </Campo>
              <Campo id="reg-exames" rotulo="Exames realizados, com a data"><Input id="reg-exames" className="h-8" value={f.exames} onChange={(e) => set('exames', e.target.value)} /></Campo>
              <Campo id="reg-meds" rotulo="Tratamento feito e medicações em uso"><Input id="reg-meds" className="h-8" value={f.medicacoes} onChange={(e) => set('medicacoes', e.target.value)} /></Campo>
              <Campo id="reg-hip" rotulo="Hipótese diagnóstica"><Input id="reg-hip" className="h-8" value={f.hipotese} onChange={(e) => set('hipotese', e.target.value)} /></Campo>
              <Campo id="reg-tel" rotulo="Telefone de contato da origem"><Input id="reg-tel" className="h-8" value={f.telefone_contato} onChange={(e) => set('telefone_contato', e.target.value)} /></Campo>
            </div>

            {souGestor && (
              <Campo id="reg-medico" rotulo="Médico assistente (fica informado)" className="max-w-sm">
                <select id="reg-medico" className={SELECT} value={medico} onChange={(e) => setMedico(e.target.value)}>
                  <option value="">Não informar</option>
                  {v.medicos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </Campo>
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
                  <span className="text-tinta-sussurro">{CARATER[s.carater]}</span>
                  <span className="font-medium text-tinta">{s.paciente.nome}{s.paciente_nao_identificado && ' (não identificado)'}</span>
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

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (valor == null || valor === '') return null
  return <div><dt className="inline text-tinta-sussurro">{rotulo}: </dt><dd className="inline">{valor}</dd></div>
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
  const [prioridadeCentral, setPrioridadeCentral] = React.useState('')
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
      const { error } = await supabase.rpc('regulacao_registrar_externo', {
        p_id: id, p_sistema: sistema.trim(), p_protocolo: protocolo.trim(), p_prioridade_central: prioridadeCentral.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  if (d.isLoading) return <Spinner />
  if (d.error || !d.data) return <Erro texto={d.error ? (d.error as Error).message : 'Não encontrada.'} />
  const s = d.data
  const destino = s.destino_tipo === 'rede' ? s.destino_unidade?.nome : s.destino_tipo === 'externo' ? `${s.destino_externo} (fora da rede)` : 'A definir pela regulação'
  const cancelavel = !central && ['rascunho', 'enviada', 'em_analise', 'pendencia', 'devolvida'].includes(s.status)
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-md border border-fio bg-campo p-3">
      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        <Linha rotulo="Pedido" valor={resumoPedido(s)} />
        <Linha rotulo="Procedimento (SIGTAP)" valor={`${s.procedimento} ${s.procedimento_nome ?? ''}`} />
        {s.cbo && <Linha rotulo="CBO" valor={s.cbo} />}
        <Linha rotulo="Caráter / modalidade" valor={`${CARATER[s.carater]} · ${s.modalidade}`} />
        <Linha rotulo="Prioridade proposta" valor={PRIORIDADES[s.prioridade].rotulo} />
        <Linha rotulo="Prioridade da central" valor={s.prioridade_central} />
        {s.tipo_leito && <Linha rotulo="Leito" valor={TIPOS_LEITO[s.tipo_leito] + (s.internacao_psiquiatrica ? ` · ${INTERNACAO_PSIQUIATRICA[s.internacao_psiquiatrica]}` : '')} />}
        {s.isolamento && <Linha rotulo="Isolamento" valor={s.isolamento_tipo ? ISOLAMENTOS[s.isolamento_tipo] : 'sim'} />}
        {s.incubadora != null && <Linha rotulo="Incubadora" valor={s.incubadora ? 'sim' : 'não'} />}
        <Linha rotulo="Destino" valor={destino} />
        <Linha rotulo="CID" valor={`${s.cid} ${s.cid_descricao ?? ''}`} />
        <Linha rotulo="Origem" valor={`${s.origem.nome} (CNES ${s.cnes_solicitante})${s.internacao_id ? ' · internação' : s.episodio_id ? ' · atendimento' : ''}`} />
        <Linha rotulo="Solicitante" valor={`${s.solicitante} (${s.solicitante_papel === 'medico' ? 'médico' : 'gestor/NIR'})`} />
        <Linha rotulo="Médico assistente" valor={s.medico_assistente} />
        <Linha rotulo="Telefone" valor={s.telefone_contato} />
        {s.externo_protocolo && <Linha rotulo="Regulação externa" valor={`${s.externo_sistema} · ${s.externo_protocolo}`} />}
      </dl>
      <dl className="flex flex-col gap-1 text-tinta">
        <div><dt className="text-tinta-sussurro">Quadro clínico</dt><dd className="whitespace-pre-wrap">{s.quadro_clinico}</dd></div>
        <Linha rotulo="Tempo de evolução" valor={s.tempo_evolucao} />
        <Linha rotulo="Sinais vitais" valor={s.sinais_vitais} />
        <Linha rotulo="Exames" valor={s.exames} />
        <Linha rotulo="Tratamento e medicações" valor={s.medicacoes} />
        <Linha rotulo="Hipótese" valor={s.hipotese} />
      </dl>
      {s.motivo_cancelamento && <p className="text-tinta-apoio">Cancelada ({s.cancelamento_origem}): {s.motivo_cancelamento}</p>}
      <ul className="text-rotulo text-tinta-sussurro">
        {(s.eventos ?? []).map((e, i) => <li key={i}>{fmtDataHora(e.em)} · {e.evento.replace('_', ' ')} · {e.por ?? '—'}</li>)}
      </ul>
      {podeRegistrarExterno && (
        <div className="flex flex-wrap items-end gap-2">
          <Campo id={`ext-sis-${id}`} rotulo="Sistema externo"><Input id={`ext-sis-${id}`} className="h-8" placeholder="SISREG, e-SUS Regulação, GERINT…" value={sistema} onChange={(e) => setSistema(e.target.value)} /></Campo>
          <Campo id={`ext-prot-${id}`} rotulo="Nº do protocolo"><Input id={`ext-prot-${id}`} className="h-8" value={protocolo} onChange={(e) => setProtocolo(e.target.value)} /></Campo>
          <Campo id={`ext-pri-${id}`} rotulo="Prioridade da central (como veio)"><Input id={`ext-pri-${id}`} className="h-8" placeholder="ex.: Vermelho (P0)" value={prioridadeCentral} onChange={(e) => setPrioridadeCentral(e.target.value)} /></Campo>
          <Button size="sm" variant="outline" onClick={() => externo.mutate()} disabled={externo.isPending || sistema.trim().length < 2 || protocolo.trim().length < 3}>Registrar</Button>
        </div>
      )}
      {cancelavel && (
        <div className="flex flex-wrap items-end gap-2">
          <Campo id={`canc-${id}`} rotulo="Motivo do cancelamento" className="min-w-60 flex-1"><Input id={`canc-${id}`} className="h-8" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Campo>
          <Button size="sm" variant="destructive" onClick={() => cancelar.mutate()} disabled={cancelar.isPending || motivo.trim().length < 10}>Cancelar solicitação</Button>
        </div>
      )}
      <Erro texto={(cancelar.error ?? externo.error) ? ((cancelar.error ?? externo.error) as Error).message : null} />
    </div>
  )
}

// ── Fila regulada (Fase 4, tarefa 2) ──────────────────────────────────────────
type ItemFila = Solicitacao & {
  assumida_por: string | null; assumida_por_mim: boolean; assumida_em: string | null; espera_segundos: number
}
type RespostaFila = { dados: ItemFila[]; resumo: Partial<Record<Prioridade, number>>; origens: Ref[]; agora: string }

function Fila({ centralId, souRegulador }: { centralId: string; souRegulador: boolean }) {
  const qc = useQueryClient()
  const [filtros, setFiltros] = React.useState<FiltrosFila>({})
  const [busca, setBusca] = React.useState('')
  const [aberta, setAberta] = React.useState<string | null>(null)
  const [novos, setNovos] = React.useState<Set<string>>(new Set())
  const vistos = React.useRef<Set<string> | null>(null)
  const [lidoEm, setLidoEm] = React.useState(() => Date.now())
  const [agora, setAgora] = React.useState(() => Date.now())
  // o tempo de espera corre na tela entre uma leitura e outra
  React.useEffect(() => {
    const id = window.setInterval(() => setAgora(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const fila = useQuery({
    queryKey: ['regulacao-fila', centralId, filtros],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_fila', { p_central: centralId, p_filtros: filtrosParaEnvio(filtros) as unknown as Json })
      if (error) throw error
      const r = data as unknown as RespostaFila
      const ids = r.dados.map((d) => d.id)
      setNovos(novosDesde(vistos.current, ids))
      vistos.current = new Set([...(vistos.current ?? []), ...ids])
      setLidoEm(Date.now()); setAgora(Date.now())
      return r
    },
  })
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['regulacao-fila', centralId] })
    if (aberta) void qc.invalidateQueries({ queryKey: ['regulacao-detalhe', aberta] })
  }
  const assumir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('regulacao_assumir', { p_id: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const soltar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('regulacao_soltar', { p_id: id })
      if (error) throw error
    },
    onSuccess: recarregar,
  })
  const setF = <K extends keyof FiltrosFila>(k: K, v: FiltrosFila[K] | '') =>
    setFiltros((x) => { const n = { ...x }; if (v === '' || v === undefined) delete n[k]; else n[k] = v as FiltrosFila[K]; return n })
  const r = fila.data
  const decorrido = Math.floor((agora - lidoEm) / 1000)
  const resumo = r?.resumo ?? {}
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Fila da central
          {(Object.keys(PRIORIDADES) as Prioridade[]).filter((p) => resumo[p]).map((p) => (
            <Badge key={p} variant={TOM[PRIORIDADES[p].tom]}>{PRIORIDADES[p].rotulo}: {resumo[p]}</Badge>
          ))}
        </CardTitle>
        <CardDescription>
          Não classificadas no topo; depois por prioridade e, em cada nível, quem espera há mais tempo. Atualiza a cada 30 segundos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="grid gap-2 sm:grid-cols-4">
          <select aria-label="Tipo" className={SELECT} value={filtros.tipo ?? ''} onChange={(e) => setF('tipo', e.target.value as TipoSolicitacao | '')}>
            <option value="">Todos os tipos</option>
            {(Object.keys(TIPOS) as TipoSolicitacao[]).map((k) => <option key={k} value={k}>{TIPOS[k]}</option>)}
          </select>
          <select aria-label="Prioridade" className={SELECT} value={filtros.prioridade ?? ''} onChange={(e) => setF('prioridade', e.target.value as Prioridade | '')}>
            <option value="">Todas as prioridades</option>
            {(Object.keys(PRIORIDADES) as Prioridade[]).map((k) => <option key={k} value={k}>{PRIORIDADES[k].rotulo}</option>)}
          </select>
          <select aria-label="Unidade de origem" className={SELECT} value={filtros.unidade_origem_id ?? ''} onChange={(e) => setF('unidade_origem_id', e.target.value)}>
            <option value="">Todas as unidades</option>
            {(r?.origens ?? []).map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
          <select aria-label="Status" className={SELECT} value={filtros.status?.[0] ?? ''}
            onChange={(e) => setF('status', e.target.value ? [e.target.value as StatusRegulacao] : '')}>
            <option value="">Em aberto (enviada, em análise, pendência)</option>
            {(Object.keys(STATUS) as StatusRegulacao[]).map((k) => <option key={k} value={k}>{STATUS[k]}</option>)}
          </select>
          <select aria-label="Caráter" className={SELECT} value={filtros.carater ?? ''} onChange={(e) => setF('carater', e.target.value as Carater | '')}>
            <option value="">Eletivo e urgência</option>
            {(Object.keys(CARATER) as Carater[]).map((k) => <option key={k} value={k}>{CARATER[k]}</option>)}
          </select>
          <select aria-label="Tipo de leito" className={SELECT} value={filtros.tipo_leito ?? ''} onChange={(e) => setF('tipo_leito', e.target.value)}>
            <option value="">Todos os leitos</option>
            {Object.entries(TIPOS_LEITO).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
          </select>
          <select aria-label="Isolamento" className={SELECT} value={filtros.isolamento === undefined ? '' : String(filtros.isolamento)}
            onChange={(e) => setF('isolamento', e.target.value === '' ? '' : e.target.value === 'true')}>
            <option value="">Com e sem isolamento</option>
            <option value="true">Só com isolamento</option>
            <option value="false">Sem isolamento</option>
          </select>
          <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); setF('busca', busca) }}>
            <Input aria-label="Buscar" className="h-8" placeholder="Paciente, nº ou protocolo" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Button size="sm" variant="outline" type="submit">Buscar</Button>
          </form>
        </div>
        <Erro texto={(fila.error ?? assumir.error ?? soltar.error) ? ((fila.error ?? assumir.error ?? soltar.error) as Error).message : null} />
        {fila.isLoading ? <Spinner /> : (r?.dados ?? []).length === 0 ? (
          <Vazio icone={Waypoints} titulo="Fila vazia" texto="Nenhuma solicitação com esses filtros." />
        ) : (
          <ul className="flex flex-col divide-y divide-fio">
            {r!.dados.map((s) => (
              <li key={s.id} className={`py-2 ${novos.has(s.id) ? 'rounded-md bg-alerta-atencao/40 px-2' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left" onClick={() => setAberta(aberta === s.id ? null : s.id)}>
                    <Badge variant={TOM[PRIORIDADES[s.prioridade].tom]}>{PRIORIDADES[s.prioridade].rotulo}</Badge>
                    {novos.has(s.id) && <Badge variant="warning">novo</Badge>}
                    <span className="font-semibold tabular-nums text-tinta">{formatarEspera(s.espera_segundos + decorrido)}</span>
                    <span className="font-medium text-tinta">{s.paciente.nome}{s.paciente_nao_identificado && ' (não identificado)'}</span>
                    <span className="text-tinta-apoio">{resumoPedido(s)}</span>
                    {s.isolamento && <Badge variant="destructive">isolamento</Badge>}
                    <span className="text-tinta-sussurro">{CARATER[s.carater]} · de {s.origem.nome} · nº {s.numero}</span>
                  </button>
                  <Badge variant="info">{STATUS[s.status]}</Badge>
                  {s.assumida_por && !s.assumida_por_mim && <span className="text-tinta-sussurro">com {s.assumida_por}</span>}
                  {souRegulador && !s.assumida_por && (
                    <Button size="xs" onClick={() => assumir.mutate(s.id)} disabled={assumir.isPending}>Assumir</Button>
                  )}
                  {s.assumida_por_mim && (
                    <>
                      <span className="text-sucesso">com você</span>
                      <Button size="xs" variant="ghost" onClick={() => soltar.mutate(s.id)} disabled={soltar.isPending}>Devolver à fila</Button>
                    </>
                  )}
                </div>
                {aberta === s.id && <Detalhe id={s.id} unidadeId={centralId} central podeRegistrarExterno={souRegulador} />}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
