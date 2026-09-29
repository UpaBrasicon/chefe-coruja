// ─────────────────────────────────────────────────────────────────────────────
// LeitoAberto — o que se faz com o paciente do box ou do leito (Fase 3).
//
// Acuidade (NEWS2/PEWS calculados no banco), lançar vitais, pendências com
// prazo, passagem de plantão com aceite, alta com impeditivos e pacote de alta.
// Toda regra mora no servidor; aqui só se mostra e se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRightLeft, CheckCircle2, ClipboardList, DoorOpen, Link2, Printer, Undo2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { abrirImpressao } from '@/lib/prontuario'
import { escapeHtml } from '@/lib/utils'
import { gravarRegistros, novoItem } from '@/lib/offline/sincronizar'
import { useAuth } from '@/contexts/AuthContext'
import { ExamesEAgravos } from '@/components/clinico/ExamesEAgravos'
import { BotaoEpisodiosAnteriores } from '@/components/prontuario/GavetaEpisodios'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

type Internacao = {
  id: string
  status: string
  data_admissao: string
  data_alta: string | null
  alta_registrada_em: string | null
  alta_por: string | null
  cid_alta: string | null
  leito: { identificador: string } | null
}
type Acuidade = {
  escala: 'NEWS2' | 'PEWS' | null
  motivo?: string
  total?: number
  banda?: 0 | 1 | 2
  itens?: { rotulo: string; valor: string; pontos: number; azul?: boolean }[]
  faltando?: string[]
  azul?: string[]
  parcial?: boolean
  grupo?: string
  fonte?: string
  aferido_em?: string | null
  phoenix?: Phoenix
  pelod2?: {
    indicado: boolean
    referencia_carregada: boolean
    total: number
    completo: boolean
    mortalidade_prevista: number
    itens: { grupo: string; rotulo: string; valor: string | number | null; pontos: number }[]
    faltando: string[]
    fonte: string
    notas: string
  }
}
type Phoenix = {
  total: number
  cardiovascular: number
  sepse: boolean
  choque: boolean
  itens: { sistema: string; pontos: number; maximo: number; detalhe: string }[]
  faltando: string[]
  parcial: boolean
  gatilho: { motivo: 'cid' | 'suspeita'; cid?: string; descricao: string }
  fonte: string
  notas: string
}
type Pendencia = {
  id: string
  tipo: string
  descricao: string
  prazo: string | null
  impeditiva: boolean
  situacao: string
  criada_em: string
  autor_id: string | null
  resolvida_por: string | null
  resolvida_em: string | null
}
type Passagem = {
  id: string
  de_perfil: string
  para_perfil: string
  resumo: string
  situacao: string
  enviada_em: string
  motivo_recusa: string | null
}
type Pacote = { id: string; situacao: string; criado_em: string; expira_em: string; tentativas: number }

const ATIVO = ['admitido', 'em_observacao', 'internado']
const TIPO_PENDENCIA: Record<string, string> = {
  observacao: 'Observação',
  reavaliacao: 'Reavaliação',
  exame: 'Exame',
  parecer: 'Parecer',
  regulacao: 'Regulação',
  outro: 'Outro',
}
const PRAZOS = [
  ['1h', '1 hora'],
  ['2h', '2 horas'],
  ['4h', '4 horas'],
  ['fim_plantao', 'Fim do plantão'],
  ['sem_prazo', 'Sem prazo'],
] as const
const TIPO_ALTA = [
  ['alta_melhorada', 'Alta melhorada'],
  ['alta_pedido', 'Alta a pedido'],
  ['alta_evasao', 'Evasão'],
  ['transferencia_externa', 'Transferência externa'],
  ['obito', 'Óbito'],
] as const
// Frases-modelo do protótipo (ESTADO.md, pacote de alta). Nenhuma vem marcada:
// quem marca é o médico, conforme o caso.
const MODELOS_ORIENTACAO = [
  'Termine o antibiótico até o último comprimido, mesmo se já estiver se sentindo bem.',
  'Beba água ao longo do dia — dois litros, se não houver limite de líquidos.',
  'Ande dentro de casa várias vezes por dia. Ficar deitado atrasa a recuperação.',
  'Cansaço e tosse seca podem durar semanas. É esperado e vai diminuindo.',
  'Leve esta alta na consulta de retorno.',
  'Volte ao pronto-socorro se a febre passar de 38 °C, faltar ar em repouso, a dor no peito piorar ou aparecer sangue na tosse.',
  'Meça a pressão duas vezes por semana e anote os valores para o retorno.',
  'Não dirija nem levante peso nos primeiros sete dias.',
  'Mantenha a ferida seca e troque o curativo uma vez por dia.',
]
const BANDA = [
  { rotulo: 'baixo', classe: 'border-conforme/30 bg-conforme/[0.08] text-conforme' },
  { rotulo: 'atenção', classe: 'border-atencao/30 bg-atencao/[0.08] text-atencao' },
  { rotulo: 'alto', classe: 'border-critico/30 bg-critico/[0.08] text-critico' },
]

const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : '—'
const diaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }) : '—'
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

function Secao({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold tracking-wide text-tinta-sussurro uppercase">{titulo}</div>
        {acao}
      </div>
      {children}
    </div>
  )
}

export function LeitoAberto({ pacienteId, pacienteNome, ehGestor }: { pacienteId: string; pacienteNome: string; ehGestor: boolean }) {
  const { perfil } = useAuth()
  const eu = perfil?.id
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [agora] = React.useState(() => Date.now())

  const internacao = useQuery({
    queryKey: ['leito-aberto', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internacoes')
        .select('id, status, data_admissao, data_alta, alta_registrada_em, alta_por, cid_alta, leito:leitos!internacoes_leito_atual_id_fkey(identificador)')
        .eq('paciente_id', pacienteId)
        .order('data_admissao', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as unknown as Internacao | null
    },
  })
  const i = internacao.data
  const ativa = !!i && ATIVO.includes(i.status)

  const acuidade = useQuery({
    queryKey: ['acuidade', pacienteId],
    enabled: ativa,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('acuidade', { p_paciente: pacienteId })
      if (error) throw error
      return data as unknown as Acuidade
    },
  })
  const pendencias = useQuery({
    queryKey: ['pendencias', i?.id],
    enabled: !!i,
    queryFn: async () => {
      const { data, error } = await supabase.from('pendencias').select('*').eq('internacao_id', i!.id).order('criada_em')
      if (error) throw error
      return (data ?? []) as Pendencia[]
    },
  })
  const passagens = useQuery({
    queryKey: ['passagens', i?.id],
    enabled: !!i,
    queryFn: async () => {
      const { data, error } = await supabase.from('passagens_plantao').select('id, de_perfil, para_perfil, resumo, situacao, enviada_em, motivo_recusa').eq('internacao_id', i!.id).order('enviada_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Passagem[]
    },
  })
  const impeditivos = useQuery({
    queryKey: ['impeditivos', i?.id],
    enabled: ativa,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('impeditivos_alta', { p_internacao: i!.id })
      if (error) throw error
      return (data ?? []) as unknown as { tipo: string; descricao: string }[]
    },
  })
  const pacotes = useQuery({
    queryKey: ['pacotes-alta', i?.id],
    enabled: !!i,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacotes_alta').select('id, situacao, criado_em, expira_em, tentativas').eq('internacao_id', i!.id).order('criado_em', { ascending: false })
      if (error) throw error
      return (data ?? []) as Pacote[]
    },
  })

  const recarregar = () => {
    for (const k of ['leito-aberto', 'acuidade', 'pendencias', 'passagens', 'impeditivos', 'pacotes-alta', 'pacientes-internados', 'ocupacao-setores', 'pendencias-observacao', 'alertas-sepse'])
      void qc.invalidateQueries({ queryKey: [k] })
  }
  const acao = <T,>(fn: () => Promise<T>, ok?: string) =>
    fn()
      .then((r) => {
        setErro(null)
        if (ok) setAviso(ok)
        recarregar()
        return r
      })
      .catch((e) => {
        setErro(msg(e))
        return null
      })

  if (internacao.isLoading) return <Spinner />
  if (!i) return <p className="text-sm text-tinta-sussurro">Sem internação ou observação registrada para este paciente.</p>

  const altaRecente = !ativa && !!i.alta_registrada_em && Date.parse(i.alta_registrada_em) > agora - 24 * 3600_000

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ativa ? 'info' : 'secondary'}>
          {i.status === 'em_observacao' ? 'Em observação' : ativa ? 'Internado' : 'Alta ' + diaHora(i.data_alta)}
        </Badge>
        <span className="text-tinta">{i.leito ? i.leito.identificador : ativa ? 'Aguardando box/leito' : ''}</span>
        <span className="text-tinta-sussurro">desde {diaHora(i.data_admissao)}</span>
        {/* D5: passagens anteriores por esta unidade, na gaveta lateral */}
        <BotaoEpisodiosAnteriores pacienteId={pacienteId} nome={pacienteNome} className="ml-auto" />
      </div>
      {erro && <p className="rounded-lg border border-critico/30 bg-critico/[0.08] p-2 text-critico">{erro}</p>}
      {aviso && <p className="rounded-lg border border-conforme/30 bg-conforme/[0.08] p-2 text-conforme">{aviso}</p>}

      {ativa && <BlocoAcuidade a={acuidade.data} carregando={acuidade.isLoading} />}
      {ativa && acuidade.data?.escala === 'PEWS' && (
        <BlocoSepse a={acuidade.data} pacienteId={pacienteId} podeMarcar={!ehGestor} acao={acao} />
      )}
      {ativa && !ehGestor && (
        <LancarVitais pacienteId={pacienteId} internacaoId={i.id} pediatrico={acuidade.data?.escala === 'PEWS'} perfilId={eu}
          aoGravar={() => { for (const k of ['acuidade', 'pendencias', 'alertas-sepse']) void qc.invalidateQueries({ queryKey: [k] }) }} aoErro={setErro} />
      )}

      <BlocoPendencias i={i} ativa={ativa} lista={pendencias.data ?? []} eu={eu} acao={acao} />

      {ativa && (
        <Secao titulo="Exames e agravos">
          <ExamesEAgravos pacienteId={pacienteId} medico={!ehGestor} />
        </Secao>
      )}

      {ativa && !ehGestor && <BlocoPassagem i={i} lista={passagens.data ?? []} eu={eu} acao={acao} />}

      {ativa && !ehGestor && <BlocoAlta i={i} impeditivos={impeditivos.data ?? []} acao={acao} />}
      {!ativa && altaRecente && (i.alta_por === eu || ehGestor) && <CancelarAlta i={i} acao={acao} />}

      {(ativa || altaRecente || ehGestor) && (
        <BlocoPacote i={i} pacienteId={pacienteId} pacienteNome={pacienteNome} lista={pacotes.data ?? []} podeGerar={!ehGestor && (ativa || altaRecente)} acao={acao} />
      )}
    </div>
  )
}

// ── acuidade ────────────────────────────────────────────────────────────────
function BlocoAcuidade({ a, carregando }: { a?: Acuidade; carregando: boolean }) {
  if (carregando) return <Spinner />
  if (!a) return null
  if (!a.escala) return <Secao titulo="Acuidade"><p className="text-tinta-sussurro">{a.motivo}</p></Secao>
  const semAfericao = !a.aferido_em
  const b = BANDA[a.banda ?? 0]
  return (
    <Secao titulo={`Acuidade · ${a.escala}${a.grupo ? ` · ${a.grupo}` : ''}`}>
      {semAfericao ? (
        <p className="text-tinta-sussurro">Sem aferição nas últimas 24 horas: lance os sinais vitais para o escore.</p>
      ) : (
        <>
          <div className={`flex flex-wrap items-baseline gap-2 rounded-lg border px-3 py-2 ${b.classe}`}>
            <span className="text-2xl font-semibold tabular-nums">{a.total}{a.parcial ? '*' : ''}</span>
            <span className="font-medium">risco {b.rotulo}</span>
            {(a.azul ?? []).length > 0 && <span className="font-semibold">· zona azul: {a.azul!.join(', ')}</span>}
            <span className="ml-auto text-xs">aferido às {hora(a.aferido_em)}</span>
          </div>
          <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {(a.itens ?? []).map((x) => (
              <li key={x.rotulo} className="flex justify-between gap-2 border-b border-fio py-0.5 last:border-0">
                <span className="text-tinta-apoio">{x.rotulo}</span>
                <span className="tabular-nums">{x.valor} · {x.azul ? 'azul' : `${x.pontos} pt`}</span>
              </li>
            ))}
          </ul>
          {a.parcial && <p className="text-xs text-atencao">* Escore parcial. Faltou: {(a.faltando ?? []).join(', ')}.</p>}
        </>
      )}
      <p className="text-xs text-tinta-sussurro">{a.fonte} O escore apoia; a conduta é da equipe.</p>
    </Secao>
  )
}

// ── pediatria: Phoenix (rastreio de sepse) e PELOD-2 ────────────────────────
/** Na porta: o mesmo rastreio do leito, para a criança ainda em atendimento. */
export function SepsePorta({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const acuidade = useQuery({
    queryKey: ['acuidade', pacienteId],
    queryFn: async () => (await rpc('acuidade', { p_paciente: pacienteId })) as Acuidade,
  })
  if (acuidade.data?.escala !== 'PEWS') return null
  const acao: Acao = (fn) =>
    fn()
      .then((r) => { setErro(null); void qc.invalidateQueries({ queryKey: ['acuidade'] }); return r })
      .catch((e) => { setErro(msg(e)); return null })
  return (
    <div className="flex flex-col gap-2 text-sm">
      {erro && <p className="text-critico">{erro}</p>}
      <BlocoSepse a={acuidade.data} pacienteId={pacienteId} podeMarcar acao={acao} />
    </div>
  )
}

function BlocoSepse({ a, pacienteId, podeMarcar, acao }: { a: Acuidade; pacienteId: string; podeMarcar: boolean; acao: Acao }) {
  const ph = a.phoenix
  const marcar = (ativa: boolean) =>
    acao(() => rpc('marcar_suspeita_infeccao', { p_paciente: pacienteId, p_ativa: ativa }),
      ativa ? 'Suspeita de infecção marcada: o Phoenix passa a ser calculado.' : 'Suspeita de infecção retirada.')
  return (
    <>
      <Secao titulo="Rastreio de sepse · Phoenix"
        acao={podeMarcar && (!ph || ph.gatilho.motivo === 'suspeita') ? (
          <Button size="xs" variant="ghost" onClick={() => void marcar(!ph)}>
            {ph ? 'Retirar suspeita de infecção' : 'Marcar suspeita de infecção'}
          </Button>
        ) : undefined}>
        {!ph ? (
          <p className="text-tinta-sussurro">
            Não calculado: sem CID de infecção no episódio e sem suspeita de infecção marcada.
          </p>
        ) : (
          <>
            <div className={`flex flex-wrap items-baseline gap-2 rounded-lg border px-3 py-2 ${
              ph.choque ? BANDA[2].classe : ph.sepse ? BANDA[2].classe : BANDA[0].classe}`}>
              <span className="text-2xl font-semibold tabular-nums">{ph.total}{ph.parcial ? '*' : ''}</span>
              <span className="font-medium">
                {ph.choque ? 'critérios de choque séptico' : ph.sepse ? 'critérios de sepse' : 'abaixo do critério de sepse (< 2)'}
              </span>
              <span className="ml-auto text-xs">{ph.gatilho.descricao}</span>
            </div>
            <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
              {ph.itens.map((x) => (
                <li key={x.sistema} className="flex justify-between gap-2 border-b border-fio py-0.5 last:border-0">
                  <span className="text-tinta-apoio">{x.sistema}</span>
                  <span className="text-right tabular-nums">{x.detalhe ? `${x.detalhe} · ` : ''}{x.pontos}/{x.maximo}</span>
                </li>
              ))}
            </ul>
            {ph.parcial && <p className="text-xs text-atencao">* Faltou medir: {ph.faltando.join(', ')}. Variável não medida não soma ponto.</p>}
            <p className="text-xs text-tinta-sussurro">{ph.fonte} {ph.notas}</p>
          </>
        )}
      </Secao>
      {a.pelod2?.indicado && (
        <Secao titulo="PELOD-2 · disfunção orgânica">
          <div className="flex flex-wrap items-baseline gap-2 rounded-lg border border-fio px-3 py-2">
            <span className="text-2xl font-semibold tabular-nums">{a.pelod2.total}{a.pelod2.completo ? '' : '*'}</span>
            <span className="font-medium">pontos</span>
            <span className="text-tinta-apoio">· mortalidade prevista na coorte de origem {(a.pelod2.mortalidade_prevista * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
          </div>
          <ul className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {a.pelod2.itens.map((x) => (
              <li key={x.rotulo} className="flex justify-between gap-2 border-b border-fio py-0.5 last:border-0">
                <span className="text-tinta-apoio">{x.rotulo}</span>
                <span className="text-right tabular-nums">{x.valor ?? '—'} · {x.pontos} pt</span>
              </li>
            ))}
          </ul>
          {!a.pelod2.completo && (
            <p className="text-xs text-atencao">
              * Não medidos (contam como normais): {a.pelod2.faltando.join(', ')}. A pendência “PELOD-2 do dia” fecha sozinha quando as 10 variáveis estiverem registradas.
            </p>
          )}
          <p className="text-xs text-tinta-sussurro">{a.pelod2.fonte} {a.pelod2.notas}</p>
        </Secao>
      )}
    </>
  )
}

// ── lançar vitais ───────────────────────────────────────────────────────────
type Conceito = { id: string; nome: string; opcoes: { id: string; rotulo: string }[] }
const NUMERICOS = [
  ['frequencia-respiratoria', 'FR (irpm)'],
  ['saturacao-o2', 'SpO₂ (%)'],
  ['frequencia-cardiaca', 'FC (bpm)'],
  ['pressao-arterial-sistolica', 'PAS (mmHg)'],
  ['temperatura', 'Temp. (°C)'],
] as const
// pediatria: o que o Phoenix pede além do PEWS
const NUMERICOS_PED = [
  ['pressao-arterial-diastolica', 'PAD (mmHg)'],
  ['pressao-arterial-media', 'PAM medida (mmHg)'],
  ['fio2', 'FiO₂ (%)'],
  ['glasgow', 'Glasgow (3–15)'],
  ['drogas-vasoativas', 'Vasoativas (nº de drogas)'],
] as const
const EXAMES = [
  ['po2', 'PaO₂ arterial (mmHg)'],
  ['pco2', 'PaCO₂ (mmHg)'],
  ['creatinina', 'Creatinina (mg/dL)'],
  ['leucocitos', 'Leucócitos (/mm³, ex.: 1500)'],
  ['lactato', 'Lactato (mmol/L)'],
  ['plaquetas', 'Plaquetas (/mm³, ex.: 95000)'],
  ['inr', 'INR'],
  ['d-dimero', 'D-dímero (mg/L FEU)'],
  ['fibrinogenio', 'Fibrinogênio (mg/dL)'],
] as const

function LancarVitais({ pacienteId, internacaoId, pediatrico, perfilId, aoGravar, aoErro }: {
  pacienteId: string; internacaoId: string; pediatrico: boolean; perfilId?: string; aoGravar: () => void; aoErro: (m: string) => void
}) {
  const [aberto, setAberto] = React.useState(false)
  const [v, setV] = React.useState<Record<string, string>>({})
  const categoricos = pediatrico
    ? [['oxigenio-suplementar', 'Oxigênio'], ['esforco-respiratorio', 'Esforço respiratório'], ['enchimento-capilar', 'Enchimento capilar central'],
       ['suporte-respiratorio', 'Suporte respiratório'], ['pupilas', 'Pupilas']]
    : [['oxigenio-suplementar', 'Oxigênio'], ['nivel-consciencia', 'Nível de consciência']]
  const conceitos = useQuery({
    queryKey: ['conceitos-vitais'],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conceito')
        .select('id, nome, conceito_opcao(id, rotulo, ordem)')
        .is('unidade_id', null)
        .in('categoria', ['sinal_vital', 'laboratorio'])
      if (error) throw error
      return (data ?? []).map((c) => ({
        id: c.id,
        nome: c.nome,
        opcoes: [...(c.conceito_opcao ?? [])].sort((a, b) => a.ordem - b.ordem),
      })) as Conceito[]
    },
  })
  const gravar = useMutation({
    mutationFn: async () => {
      if (!perfilId) throw new Error('Sem sessão.')
      const porNome = new Map((conceitos.data ?? []).map((c) => [c.nome, c]))
      const itens = Object.entries(v)
        .filter(([, x]) => x.trim() !== '')
        .map(([nome, x]) => {
          const c = porNome.get(nome)
          if (!c) throw new Error(`Conceito ${nome} não encontrado.`)
          if (c.opcoes.length > 0) {
            return novoItem('observacao', { internacao_id: internacaoId, paciente_id: pacienteId, conceito_id: c.id, valor_conceito_id: x, origem: 'manual' })
          }
          const milhar = nome === 'plaquetas' || nome === 'leucocitos'
          const n = Number(x.replace(/\./g, milhar ? '' : '.').replace(',', '.'))
          if (Number.isNaN(n)) throw new Error(`Valor inválido em ${nome}.`)
          if (nome === 'plaquetas' && n < 1000) throw new Error('Plaquetas em /mm³ (ex.: 95000), não em milhares.')
          return novoItem('observacao', { internacao_id: internacaoId, paciente_id: pacienteId, conceito_id: c.id, valor_num: n, origem: 'manual' })
        })
      if (itens.length === 0) throw new Error('Preencha ao menos um sinal vital.')
      const r = await gravarRegistros(perfilId, itens)
      if (r.recusados.length > 0) throw new Error(r.recusados[0].replace(/^SYNC_[A-Z_]+: /, ''))
    },
    onSuccess: () => {
      setV({})
      setAberto(false)
      aoGravar()
    },
    onError: (e) => aoErro(msg(e)),
  })
  if (!aberto) {
    return <Button size="xs" variant="outline" className="self-start" onClick={() => setAberto(true)}>Lançar vitais</Button>
  }
  return (
    <Secao titulo="Lançar vitais">
      <p className="text-xs text-tinta-sussurro">Nenhum campo é obrigatório sozinho. O valor fica cru, sem marca de alterado.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {NUMERICOS.map(([nome, rotulo]) => (
          <div key={nome} className="flex flex-col gap-1">
            <Label htmlFor={`v-${nome}`}>{rotulo}</Label>
            <Input id={`v-${nome}`} inputMode="decimal" value={v[nome] ?? ''} onChange={(e) => setV({ ...v, [nome]: e.target.value })} />
          </div>
        ))}
        {pediatrico && NUMERICOS_PED.map(([nome, rotulo]) => (
          <div key={nome} className="flex flex-col gap-1">
            <Label htmlFor={`v-${nome}`}>{rotulo}</Label>
            <Input id={`v-${nome}`} inputMode="decimal" value={v[nome] ?? ''} onChange={(e) => setV({ ...v, [nome]: e.target.value })} />
          </div>
        ))}
        {categoricos.map(([nome, rotulo]) => {
          const c = conceitos.data?.find((x) => x.nome === nome)
          return (
            <div key={nome} className="flex flex-col gap-1">
              <Label>{rotulo}</Label>
              <Select items={Object.fromEntries((c?.opcoes ?? []).map((o) => [o.id, o.rotulo]))} value={v[nome] || null} onValueChange={(x) => setV({ ...v, [nome]: x ?? '' })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(c?.opcoes ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.rotulo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )
        })}
      </div>
      {pediatrico && (
        <>
          <p className="text-xs text-tinta-sussurro">
            Vasoativas: adrenalina, noradrenalina, dopamina, dobutamina, milrinona ou vasopressina, em qualquer dose (Phoenix).
            Até a prescrição da fase 4, o número é marcado aqui.
          </p>
          <div className="text-xs font-semibold tracking-wide text-tinta-sussurro uppercase">Exames (Phoenix e PELOD-2)</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EXAMES.map(([nome, rotulo]) => (
              <div key={nome} className="flex flex-col gap-1">
                <Label htmlFor={`v-${nome}`}>{rotulo}</Label>
                <Input id={`v-${nome}`} inputMode="decimal" value={v[nome] ?? ''} onChange={(e) => setV({ ...v, [nome]: e.target.value })} />
              </div>
            ))}
          </div>
        </>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => gravar.mutate()} disabled={gravar.isPending || conceitos.isLoading}>
          {gravar.isPending && <Spinner />} Registrar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Fechar</Button>
      </div>
    </Secao>
  )
}

// ── pendências ──────────────────────────────────────────────────────────────
type Acao = <T>(fn: () => Promise<T>, ok?: string) => Promise<T | null>
const rpc = async (nome: string, args: Record<string, unknown>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await supabase.rpc(nome as any, args as any)
  if (error) throw error
  return (data ?? true) as unknown
}

function BlocoPendencias({ i, ativa, lista, eu, acao }: { i: Internacao; ativa: boolean; lista: Pendencia[]; eu?: string; acao: Acao }) {
  const [tipo, setTipo] = React.useState('reavaliacao')
  const [prazo, setPrazo] = React.useState('2h')
  const [texto, setTexto] = React.useState('')
  const [desfazer, setDesfazer] = React.useState<string | null>(null)
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  React.useEffect(() => {
    if (!desfazer) return
    const t = setTimeout(() => setDesfazer(null), 8000)
    return () => clearTimeout(t)
  }, [desfazer])

  const abertas = lista
    .filter((p) => p.situacao === 'aberta')
    .sort((a, b) => (a.prazo ? Date.parse(a.prazo) : Infinity) - (b.prazo ? Date.parse(b.prazo) : Infinity))
  const resolvidas = lista.filter((p) => p.situacao !== 'aberta').slice(-5).reverse()

  return (
    <Secao titulo="Pendências">
      {abertas.length === 0 && <p className="text-tinta-sussurro">Nenhuma pendência aberta.</p>}
      {abertas.map((p) => {
        const vencida = !!p.prazo && Date.parse(p.prazo) < agora
        return (
          <div key={p.id} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 ${vencida ? 'border-critico/40 bg-critico/[0.06]' : 'border-fio'}`}>
            <Badge variant={vencida ? 'destructive' : p.tipo === 'observacao' ? 'warning' : 'secondary'}>{TIPO_PENDENCIA[p.tipo] ?? p.tipo}</Badge>
            <span className="min-w-0 flex-1 text-tinta">{p.descricao}</span>
            {p.impeditiva && <Badge variant="outline">impede a alta</Badge>}
            <span className={`text-xs tabular-nums ${vencida ? 'font-semibold text-critico' : 'text-tinta-sussurro'}`}>
              {p.prazo ? `${vencida ? 'vencida desde' : 'até'} ${hora(p.prazo)}` : 'sem prazo'}
              {p.autor_id === eu ? ' · sua' : p.autor_id === null ? ' · sistema' : ''}
            </span>
            {ativa && p.tipo !== 'observacao' && (
              <Button size="xs" variant="outline" onClick={() => acao(() => rpc('concluir_pendencia', { p_pendencia: p.id })).then(() => setDesfazer(p.id))}>
                <CheckCircle2 /> Concluir
              </Button>
            )}
          </div>
        )
      })}
      {desfazer && (
        <div className="flex items-center gap-2 text-xs text-tinta-sussurro">
          Pendência concluída.
          <Button size="xs" variant="ghost" onClick={() => acao(() => rpc('desfazer_pendencia', { p_pendencia: desfazer })).then(() => setDesfazer(null))}>
            <Undo2 /> Desfazer
          </Button>
        </div>
      )}
      {resolvidas.length > 0 && (
        <details className="text-xs text-tinta-sussurro">
          <summary className="cursor-pointer">Resolvidas ({resolvidas.length})</summary>
          {resolvidas.map((p) => (
            <div key={p.id}>
              {TIPO_PENDENCIA[p.tipo]} · {p.descricao} · {p.situacao} {diaHora(p.resolvida_em)}
            </div>
          ))}
        </details>
      )}
      {ativa && (
        <div className="flex flex-wrap items-end gap-2">
          <Select items={TIPO_PENDENCIA} value={tipo} onValueChange={(x) => setTipo(x ?? 'reavaliacao')}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TIPO_PENDENCIA).filter(([k]) => k !== 'observacao').map(([k, r]) => <SelectItem key={k} value={k}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="min-w-40 flex-1" placeholder="O que falta" value={texto} onChange={(e) => setTexto(e.target.value)} />
          <Select items={Object.fromEntries(PRAZOS)} value={prazo} onValueChange={(x) => setPrazo(x ?? '2h')}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{PRAZOS.map(([k, r]) => <SelectItem key={k} value={k}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" disabled={texto.trim().length < 3}
            onClick={() => acao(() => rpc('registrar_pendencia', { p_internacao: i.id, p_tipo: tipo, p_descricao: texto, p_prazo: prazo })).then((r) => r && setTexto(''))}>
            <ClipboardList /> Registrar
          </Button>
        </div>
      )}
      {ativa && <p className="text-xs text-tinta-sussurro">Parecer sem resposta impede a alta. A observação se resolve com a conduta: alta ou internação.</p>}
    </Secao>
  )
}

// ── passagem de plantão ─────────────────────────────────────────────────────
function BlocoPassagem({ i, lista, eu, acao }: { i: Internacao; lista: Passagem[]; eu?: string; acao: Acao }) {
  const [aberto, setAberto] = React.useState(false)
  const [para, setPara] = React.useState('')
  const [resumo, setResumo] = React.useState('')
  const colegas = useQuery({
    queryKey: ['colegas-passagem', i.id],
    enabled: aberto,
    queryFn: async () => (await rpc('colegas_para_passagem', { p_internacao: i.id })) as { perfil_id: string; nome: string; inicio: string }[],
  })
  const aguardando = lista.find((p) => p.situacao === 'aguardando')
  const ultima = lista[0]
  return (
    <Secao titulo="Passagem de plantão">
      {aguardando ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-atencao/30 bg-atencao/[0.06] px-3 py-2">
          <span className="flex-1">Aguardando aceite desde {hora(aguardando.enviada_em)}. Seu check-out fica bloqueado até lá.</span>
          {aguardando.de_perfil === eu && (
            <Button size="xs" variant="outline" onClick={() => acao(() => rpc('retirar_passagem', { p_passagem: aguardando.id }), 'Passagem retirada.')}>Retirar</Button>
          )}
        </div>
      ) : (
        <>
          {ultima?.situacao === 'recusada' && (
            <p className="text-atencao">Recusada: “{ultima.motivo_recusa}”. Reenvie quando puder.</p>
          )}
          {ultima?.situacao === 'aceita' && <p className="text-conforme">Última passagem aceita.</p>}
          {!aberto ? (
            <Button size="xs" variant="outline" className="self-start" onClick={() => setAberto(true)}>
              <ArrowRightLeft /> {ultima ? 'Passar de novo' : 'Passar este paciente'}
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Select items={Object.fromEntries((colegas.data ?? []).map((c) => [c.perfil_id, `${c.nome} · a partir de ${hora(c.inicio)}`]))} value={para || null} onValueChange={(x) => setPara(x ?? '')}>
                <SelectTrigger className="w-full"><SelectValue placeholder={colegas.isLoading ? 'Carregando a escala…' : 'Para quem (escala do setor, agora ou nas próximas 12h)'} /></SelectTrigger>
                <SelectContent>
                  {(colegas.data ?? []).map((c) => <SelectItem key={c.perfil_id} value={c.perfil_id}>{c.nome} · a partir de {hora(c.inicio)}</SelectItem>)}
                </SelectContent>
              </Select>
              {colegas.data && colegas.data.length === 0 && <p className="text-xs text-atencao">Ninguém na escala deste setor agora nem nas próximas 12 horas.</p>}
              <Textarea placeholder="Situação, o que está pendente, o que observar (mínimo de 15 letras)" value={resumo} onChange={(e) => setResumo(e.target.value)} />
              <div className="flex gap-2">
                <Button size="sm" disabled={!para || resumo.trim().length < 15}
                  onClick={() => acao(() => rpc('enviar_passagem', { p_internacao: i.id, p_para: para, p_resumo: resumo }), 'Passagem enviada. Aguarda aceite.').then((r) => { if (r) { setAberto(false); setResumo('') } })}>
                  Enviar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </>
      )}
    </Secao>
  )
}

// ── alta ────────────────────────────────────────────────────────────────────
const paraInputLocal = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function BlocoAlta({ i, impeditivos, acao }: { i: Internacao; impeditivos: { tipo: string; descricao: string }[]; acao: Acao }) {
  const [aberto, setAberto] = React.useState(false)
  const [tipo, setTipo] = React.useState('alta_melhorada')
  const [cid, setCid] = React.useState('')
  const [quando, setQuando] = React.useState('')
  const [justificativa, setJustificativa] = React.useState('')
  const [obs, setObs] = React.useState('')
  const [destino, setDestino] = React.useState('')
  const [numeroDo, setNumeroDo] = React.useState('')
  const [confirmar, setConfirmar] = React.useState(false)
  const [abertoEm] = React.useState(() => Date.now())
  const retroativa = !!quando && Date.parse(quando) < abertoEm - 30 * 60_000

  if (!aberto) {
    return (
      <Secao titulo="Alta">
        {impeditivos.length > 0 && (
          <ul className="flex flex-col gap-1 text-atencao">
            {impeditivos.map((x, k) => <li key={k} className="flex gap-1.5"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{x.descricao}</li>)}
          </ul>
        )}
        <Button size="xs" variant="outline" className="self-start" disabled={impeditivos.length > 0}
          onClick={() => { setQuando(paraInputLocal(new Date())); setAberto(true) }}>
          <DoorOpen /> Dar alta
        </Button>
      </Secao>
    )
  }
  const detalhes: Record<string, string> = {}
  if (tipo === 'transferencia_externa') detalhes.destino = destino
  if (tipo === 'obito') detalhes.numero_do = numeroDo
  return (
    <Secao titulo="Dados da alta">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>Motivo</Label>
          <Select items={Object.fromEntries(TIPO_ALTA)} value={tipo} onValueChange={(x) => setTipo(x ?? 'alta_melhorada')}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{TIPO_ALTA.map(([k, r]) => <SelectItem key={k} value={k}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="alta-cid">CID de alta *</Label>
          <Input id="alta-cid" value={cid} onChange={(e) => setCid(e.target.value.toUpperCase())} placeholder="Ex.: J18.9" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="alta-quando">Data e hora</Label>
          <Input id="alta-quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
        </div>
        {tipo === 'transferencia_externa' && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="alta-destino">Destino *</Label>
            <Input id="alta-destino" value={destino} onChange={(e) => setDestino(e.target.value)} />
          </div>
        )}
        {tipo === 'obito' && (
          <div className="flex flex-col gap-1">
            <Label htmlFor="alta-do">Nº da Declaração de Óbito *</Label>
            <Input id="alta-do" value={numeroDo} onChange={(e) => setNumeroDo(e.target.value)} />
          </div>
        )}
      </div>
      {retroativa && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="alta-just" className="text-atencao">Alta retroativa (mais de 30 minutos atrás): justifique *</Label>
          <Textarea id="alta-just" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor="alta-obs">Observações{tipo === 'alta_pedido' || tipo === 'alta_evasao' ? ' — descreva o ocorrido *' : ''}</Label>
        <Textarea id="alta-obs" value={obs} onChange={(e) => setObs(e.target.value)} />
      </div>
      {confirmar ? (
        <div className="flex flex-col gap-2 rounded-lg border border-atencao/30 bg-atencao/[0.06] p-3">
          <p>Deseja finalizar o atendimento? O paciente sai do censo, vira histórico do gestor e você perde o acesso (cancelar a alta é possível por 24 horas, com justificativa).</p>
          <div className="flex gap-2">
            <Button size="sm"
              onClick={() => acao(() => rpc('dar_alta', {
                p_internacao: i.id, p_tipo: tipo, p_cid: cid,
                p_quando: quando ? new Date(quando).toISOString() : null,
                p_justificativa: justificativa || null, p_observacoes: obs || null, p_detalhes: detalhes,
              }), 'Alta registrada.').then((r) => { if (r !== null) setAberto(false); setConfirmar(false) })}>
              Sim, dar alta
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmar(false)}>Não</Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setConfirmar(true)} disabled={cid.trim().length < 3}>Confirmar</Button>
          <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
        </div>
      )}
    </Secao>
  )
}

function CancelarAlta({ i, acao }: { i: Internacao; acao: Acao }) {
  const [texto, setTexto] = React.useState('')
  return (
    <Secao titulo="Cancelar alta">
      <p className="text-tinta-sussurro">Alta de {diaHora(i.data_alta)} · CID {i.cid_alta}. Cancelar devolve o paciente ao censo e revoga o link do pacote.</p>
      <Textarea placeholder="Justificativa (mínimo de 10 letras)" value={texto} onChange={(e) => setTexto(e.target.value)} />
      <Button size="sm" variant="outline" className="self-start" disabled={texto.trim().length < 10}
        onClick={() => acao(() => rpc('cancelar_alta', { p_internacao: i.id, p_justificativa: texto }), 'Alta cancelada: o paciente voltou ao censo.')}>
        Cancelar alta
      </Button>
    </Secao>
  )
}

// ── pacote de alta ──────────────────────────────────────────────────────────
function BlocoPacote({ i, pacienteId, pacienteNome, lista, podeGerar, acao }: {
  i: Internacao; pacienteId: string; pacienteNome: string; lista: Pacote[]; podeGerar: boolean; acao: Acao
}) {
  const [aberto, setAberto] = React.useState(false)
  const [marcadas, setMarcadas] = React.useState<number[]>([4])
  const [extra, setExtra] = React.useState('')
  const [retorno, setRetorno] = React.useState('')
  const ativo = lista.find((p) => p.situacao === 'ativo')

  async function gerarEImprimir() {
    // a janela abre dentro do clique; o servidor gera e registra depois
    const pImp = abrirImpressao({ pacienteId, internacaoId: i.id, tipo: 'Orientação de alta (pacote)' })
    const orientacoes = [...marcadas.sort((a, b) => a - b).map((k) => MODELOS_ORIENTACAO[k]), ...extra.split('\n').map((s) => s.trim()).filter(Boolean)]
    const r = (await acao(() => rpc('gerar_pacote_alta', { p_internacao: i.id, p_orientacoes: orientacoes, p_retorno: retorno || null }), 'Pacote gerado. Entregue a folha impressa: o código não aparece de novo.')) as
      | { token: string; codigo: string; expira_em: string }
      | null
    const imp = await pImp
    if (!imp) return
    if (!r) {
      imp.janela.document.write('<p style="font:15px system-ui;padding:24px;color:#B91C1C">O pacote não foi gerado. Nada foi impresso.</p>')
      imp.janela.document.close()
      return
    }
    const link = `${window.location.origin}/alta/${r.token}`
    imp.janela.document.write(`<html><head><title>Orientação de alta</title><style>
      body{font:12pt/1.5 system-ui,sans-serif;margin:18mm;color:#0f172a}h1{font-size:16pt;margin:0 0 8px}
      li{margin:4px 0}.cx{border:1.5px solid #0f172a;padding:10px 14px;margin-top:16px}.cod{font:700 22pt ui-monospace,monospace;letter-spacing:6px}
    </style></head><body>
      <h1>Orientações de alta</h1>
      <p><strong>Paciente:</strong> ${escapeHtml(pacienteNome)}</p>
      <ol>${orientacoes.map((o) => `<li>${escapeHtml(o)}</li>`).join('')}</ol>
      ${retorno ? `<p><strong>Retorno:</strong> ${escapeHtml(retorno)}</p>` : ''}
      <div class="cx">
        <p>Seus documentos da alta (receita, atestado, encaminhamento e estas orientações) também ficam no celular, por 30 dias:</p>
        <p><strong>${escapeHtml(link)}</strong></p>
        <p>Código de acesso (pedido a cada abertura):</p><p class="cod">${r.codigo}</p>
        <p style="font-size:9pt;color:#475569">Guarde esta folha. Três códigos errados bloqueiam o link; peça outro na unidade.</p>
      </div>
      ${imp.rodape}</body></html>`)
    imp.janela.document.close()
    imp.janela.focus()
    setTimeout(() => imp.janela.print(), 300)
    setAberto(false)
  }

  return (
    <Secao titulo="Pacote de alta">
      {ativo ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success"><Link2 className="mr-1 inline size-3" />link ativo</Badge>
          <span className="text-tinta-sussurro">gerado {diaHora(ativo.criado_em)} · vale até {diaHora(ativo.expira_em)}</span>
          <Button size="xs" variant="ghost" onClick={() => acao(() => rpc('revogar_pacote_alta', { p_pacote: ativo.id }), 'Link revogado.')}>Revogar</Button>
        </div>
      ) : (
        <p className="text-tinta-sussurro">
          {lista[0] ? `Último link: ${lista[0].situacao}.` : 'Sem link.'} O código sai impresso na orientação de alta (SMS e WhatsApp ainda não configurados).
        </p>
      )}
      {podeGerar && !aberto && (
        <Button size="xs" variant="outline" className="self-start" onClick={() => setAberto(true)}>
          <Printer /> {ativo ? 'Gerar novo e imprimir (revoga o atual)' : 'Montar e imprimir'}
        </Button>
      )}
      {podeGerar && aberto && (
        <div className="flex flex-col gap-2">
          {MODELOS_ORIENTACAO.map((o, k) => (
            <label key={k} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={marcadas.includes(k)}
                onChange={(e) => setMarcadas(e.target.checked ? [...marcadas, k] : marcadas.filter((x) => x !== k))} />
              <span>{o}</span>
            </label>
          ))}
          <Textarea placeholder="Outras orientações (uma por linha)" value={extra} onChange={(e) => setExtra(e.target.value)} />
          <Input placeholder="Retorno: onde e quando" value={retorno} onChange={(e) => setRetorno(e.target.value)} />
          <p className="text-xs text-tinta-sussurro">Receita, atestado, encaminhamento e pedido de exames emitidos no episódio entram no pacote automaticamente.</p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void gerarEImprimir()}><Printer /> Gerar e imprimir</Button>
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </Secao>
  )
}
