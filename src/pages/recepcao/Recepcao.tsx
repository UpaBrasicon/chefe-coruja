import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Baby, Check, ClipboardList, ClipboardPlus, Hourglass, Monitor, Search, Stethoscope, TriangleAlert, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import * as React from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { soDigitos } from '@/lib/documentos'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { ehPediatrico, rotuloIdade } from '@/domain/idade'
import { ordemTriagem, PRIORIDADE_ROTULO, PRIORIDADES_INFORMADAS, rotulosPrioridade, type PrioridadeLegal } from '@/domain/prioridade'
import { ALVO_MIN, ordemMedica, type CorRisco } from '@/domain/risco'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { Chip, Chips, TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { EnderecoSus } from '@/components/paciente/EnderecoSus'
import { FormRn, type RnCriado } from '@/components/paciente/CadastroRn'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ExcluirDaFila } from '@/components/porta/Chamada'

import { Campo, CamposCadastro } from '@/components/paciente/CamposCadastro'
import { PropagandaPainel } from './PropagandaPainel'
import { CADASTRO_VAZIO, errosCadastro, hojeSP, IDENTIDADE, normalizarCadastro, type Cadastro, type CampoCadastro } from '@/lib/cadastroPaciente'
import { Aviso } from '@/components/ui/aviso'
import { TituloCartao } from '@/components/monitor/Pagina'
import { diaMes, hora } from '@/lib/formato'

// Recepção (protótipo: rec-cadastro, rec-fila-enf, rec-fila-med, rec-painel).
// Procurar antes de cadastrar, abrir a ficha — que abre o episódio — e
// acompanhar as filas da porta e as chamadas. A Recepção não lê prontuário:
// a busca devolve só identificação, com CPF e CNS mascarados, e as filas
// trazem só identificação, queixa referida, prioridade, cor e chamada.

type Porta = { id: string; nome: string; publico: 'todos' | 'adulto' | 'pediatrico' }
type Achado = {
  id: string
  nome: string
  nome_social: string | null
  data_nascimento: string | null
  nome_mae: string | null
  cpf_final: string | null
  cns_final: string | null
  prontuario: string | null
  episodio_etapa: string | null
  /** achado pelo CPF/CNS de um cadastro já unificado a este (Portão 2, tarefa 3) */
  documento_unificado?: boolean
}
type NaFila = {
  episodio_id: string
  etapa: 'triagem' | 'atendimento'
  chegada_em: string
  classificado_em: string | null
  cor_atual: CorRisco | null
  queixa: string
  prioridades_legais: string[]
  nome: string
  nome_social: string | null
  data_nascimento: string | null
  atendimento_iniciado_em: string | null
  medico: string | null
  chamadas: number
  ultima_sala: string | null
  ultimo_chamador: string | null
}
type Chamada = { id: string; criado_em: string; nome: string; sala: string; quem: string | null; numero: number }
type Aberto = { episodio_id: string; chegada_em: string; setor: string; etapa: string; em_atendimento: boolean; na_minha_porta: boolean }

type Aba = 'ficha' | 'triagem' | 'medica' | 'painel'
const ABAS: { aba: Aba; rotulo: string; icone: LucideIcon; titulo: string; descricao: string }[] = [
  { aba: 'ficha', rotulo: 'Nova ficha', icone: ClipboardPlus, titulo: 'Nova ficha',
    descricao: 'Procure o paciente antes de cadastrar: quem já tem cadastro abre a ficha com um clique. A ficha vai para a fila da triagem.' },
  { aba: 'triagem', rotulo: 'Fila da triagem', icone: Hourglass, titulo: 'Fila da triagem',
    descricao: 'Fichas aguardando a enfermagem, com prioridade legal primeiro e depois por ordem de chegada. Você acompanha; quem chama é a triagem.' },
  { aba: 'medica', rotulo: 'Fila médica', icone: Stethoscope, titulo: 'Fila médica',
    descricao: 'Pacientes triados aguardando o Pronto-Socorro, pela cor da classificação e pelo tempo de espera. Quem chama é o médico.' },
  { aba: 'painel', rotulo: 'Painel de chamada', icone: Monitor, titulo: 'Painel de chamada',
    descricao: 'Abre em outra janela para espelhar na televisão da sala de espera. Mostra o nome do paciente e a sala de quem chamou, com aviso sonoro e voz.' },
]

const ROTA: Record<Aba, string> = { ficha: '', triagem: 'fila-triagem', medica: 'fila-medica', painel: 'painel' }

/** Maior espera de quem ainda não foi atendido (desde a ficha ou a classificação). */
function maiorEspera(itens: NaFila[], agora: number): string {
  const esperando = itens.filter((e) => !e.atendimento_iniciado_em)
  if (!esperando.length) return '—'
  const desde = Math.min(...esperando.map((e) => new Date(e.etapa === 'atendimento' ? (e.classificado_em ?? e.chegada_em) : e.chegada_em).getTime()))
  const min = Math.max(0, Math.round((agora - desde) / 60_000))
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

/** Quem da fila médica, ainda sem atendimento, já passou do alvo da cor. */
function acimaDoAlvo(itens: NaFila[], agora: number): number {
  return itens.filter((e) => {
    if (e.atendimento_iniciado_em || !e.cor_atual) return false
    const desde = new Date(e.classificado_em ?? e.chegada_em).getTime()
    return Math.round((agora - desde) / 60_000) > ALVO_MIN[e.cor_atual]
  }).length
}

const diaHora = (iso: string) => `${diaMes(iso)} ${hora(iso)}`
const ETAPA_ABERTA = (a: Aberto) =>
  a.etapa === 'triagem' ? 'fila da triagem'
  : a.etapa === 'atendimento' ? (a.em_atendimento ? 'em atendimento médico' : 'fila médica')
  : a.etapa === 'observacao' ? 'observação'
  : a.etapa === 'internacao' ? 'internação'
  : a.etapa
/** A RPC recusa a ficha porque o paciente já tem episódio aberto (checagem ou índice único). */
const ehEpisodioAberto = (m: string) => /^FICHA_EPISODIO_ABERTO|episodios_um_aberto_por_paciente/.test(m)
const nomeExibicao = (nome: string, social: string | null) => (social ? `${social} (${nome})` : nome)
const SITUACAO: Record<string, string> = {
  triagem: 'Já está na fila da triagem',
  atendimento: 'Já está na fila médica',
  observacao: 'Em observação na unidade',
  internacao: 'Internado na unidade',
}

/** Relógio da tela: a espera anda sem precisar recarregar a fila. */
function useAgora(ms: number) {
  const [agora, setAgora] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return agora
}

/** Termo que o servidor aceita: 3 letras do nome ou 4 números de documento. */
const termoValido = (t: string) => t.replace(/[^\p{L}]/gu, '').length >= 3 || soDigitos(t).length >= 4

const cartao = 'rounded-cartao border border-fio bg-superficie'
const pilula = 'inline-flex items-center rounded-capsula px-2.5 py-1 text-rotulo font-semibold whitespace-nowrap'

export default function Recepcao() {
  const { unidadeAtiva, papeisDaUnidade, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const ehGestor = papeisDaUnidade.includes('gestor')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { tela } = useParams()
  const [params] = useSearchParams()
  // /recepcao/fila-triagem, /fila-medica e /painel (itens da lateral); ?aba= continua valendo
  const aba: Aba = (Object.entries(ROTA) as [Aba, string][]).find(([, r]) => r === tela)?.[0]
    ?? (['ficha', 'triagem', 'medica', 'painel'] as const).find((a) => a === params.get('aba')) ?? 'ficha'
  const irPara = (a: Aba) => navigate(a === 'ficha' ? '/recepcao' : `/recepcao/${ROTA[a]}`, { replace: true })
  // a Recepção troca de tela pela lateral; quem abre ficha por outro papel usa as abas
  const mostrarAbas = papelAtivo !== 'recepcao'
  const agora = useAgora(30_000)

  // ── portas (setores de emergência) em que a pessoa pode abrir ficha ──────
  const { data: portas } = useQuery({
    queryKey: ['recepcao-portas', unidadeId, ehGestor],
    enabled: !!unidadeId,
    queryFn: async (): Promise<Porta[]> => {
      let q = supabase.from('setores').select('id, nome, publico').eq('unidade_id', unidadeId!).eq('tipo', 'emergencia').eq('ativo', true)
      if (!ehGestor) {
        const { data: ids, error } = await supabase.rpc('setores_na_escala_agora')
        if (error) throw error
        const lista = (Array.isArray(ids) ? ids : []) as string[]
        if (lista.length === 0) return []
        q = q.in('id', lista)
      }
      const { data, error } = await q.order('ordem')
      if (error) throw error
      return (data ?? []) as Porta[]
    },
  })
  const [portaId, setPortaId] = React.useState<string | null>(null)
  const porta = portas?.find((p) => p.id === portaId) ?? (portas?.length === 1 ? portas[0] : undefined)

  // ── filas da porta (triagem e médica) ────────────────────────────────────
  const fila = useQuery({
    queryKey: ['recepcao-fila', porta?.id],
    enabled: !!porta,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fila_da_porta', { p_setor: porta!.id })
      if (error) throw error
      return (data ?? []) as unknown as NaFila[]
    },
  })
  const filaTriagem = React.useMemo(() => (fila.data ?? []).filter((e) => e.etapa === 'triagem').sort(ordemTriagem), [fila.data])
  const filaMedica = React.useMemo(() => {
    const lista = (fila.data ?? []).filter((e) => e.etapa === 'atendimento')
    const esperando = lista.filter((e) => !e.atendimento_iniciado_em)
    const emAtendimento = lista.filter((e) => e.atendimento_iniciado_em)
    const ordenar = (l: NaFila[]) =>
      l.map((e) => ({ ...e, cor_atual: (e.cor_atual ?? 'azul') as CorRisco, classificado_em: e.classificado_em ?? e.chegada_em, _cor: e.cor_atual }))
        .sort(ordemMedica)
        .map(({ _cor, ...e }) => ({ ...e, cor_atual: _cor }))
    return [...ordenar(esperando), ...ordenar(emAtendimento)]
  }, [fila.data])

  const chamadas = useQuery({
    queryKey: ['recepcao-chamadas', porta?.id],
    enabled: !!porta && aba === 'painel',
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ultimas_chamadas_porta', { p_setor: porta!.id, p_limite: 8 })
      if (error) throw error
      return (data ?? []) as Chamada[]
    },
  })

  const contagem: Partial<Record<Aba, number>> = { triagem: filaTriagem.length, medica: filaMedica.filter((e) => !e.atendimento_iniciado_em).length }
  const atual = ABAS.find((a) => a.aba === aba)!

  return (
    <div className="flex w-full max-w-5xl flex-col">
      <TituloPagina icone={atual.icone} titulo={atual.titulo} descricao={atual.descricao} />

      {mostrarAbas && (
        <Chips rotulo="Telas da Recepção">
          {ABAS.map((a) => (
            <Chip key={a.aba} ativo={aba === a.aba} onClick={() => irPara(a.aba)} contagem={porta && contagem[a.aba] ? contagem[a.aba] : undefined}>
              <a.icone className="size-3.5" aria-hidden /> {a.rotulo}
            </Chip>
          ))}
        </Chips>
      )}

      {portas && portas.length === 0 && (
        <Vazio icone={ClipboardList} titulo="Você não está escalado numa porta agora" texto="A ficha abre numa porta (setor de emergência) em que você está de plantão." />
      )}

      {portas && portas.length > 1 && (
        <Chips rotulo="Porta de entrada">
          {portas.map((p) => (
            <Chip key={p.id} ativo={porta?.id === p.id} onClick={() => setPortaId(p.id)}>
              {p.nome}
            </Chip>
          ))}
        </Chips>
      )}
      {portas && portas.length > 1 && !porta && <p className="text-apoio text-tinta-sussurro">Escolha a porta de entrada.</p>}

      {porta && aba === 'ficha' && (
        // o formulário fica estreito mesmo com a página na largura da coluna
        <div className="w-full max-w-4xl">
          <NovaFicha
            porta={porta}
            unidadeId={unidadeId!}
            aoAbrir={() => {
              void queryClient.invalidateQueries({ queryKey: ['recepcao-fila'] })
              void queryClient.invalidateQueries({ queryKey: ['nota-fila-triagem'] })
            }}
          />
        </div>
      )}

      {porta && aba === 'triagem' && (
        <ListaFila
          carregando={fila.isLoading}
          erro={fila.error as Error | null}
          vazia="Ninguém aguardando triagem."
          agora={agora}
          grupos={[{ titulo: 'Aguardando triagem', itens: filaTriagem, maiorEspera: maiorEspera(filaTriagem, agora) }]}
        />
      )}

      {porta && aba === 'medica' && (
        <ListaFila
          carregando={fila.isLoading}
          erro={fila.error as Error | null}
          vazia="Ninguém aguardando atendimento médico."
          agora={agora}
          grupos={[
            {
              titulo: 'Aguardando o médico',
              itens: filaMedica.filter((e) => !e.atendimento_iniciado_em),
              maiorEspera: maiorEspera(filaMedica, agora),
              acimaDoAlvo: acimaDoAlvo(filaMedica, agora),
            },
            { titulo: 'Em atendimento', itens: filaMedica.filter((e) => e.atendimento_iniciado_em) },
          ]}
        />
      )}

      {porta && aba === 'painel' && <PainelChamada porta={porta} chamadas={chamadas.data} carregando={chamadas.isLoading} erro={chamadas.error as Error | null} />}
      {aba === 'painel' && unidadeId && <PropagandaPainel unidadeId={unidadeId} />}
    </div>
  )
}

// ── Nova ficha ───────────────────────────────────────────────────────────────

function NovaFicha({ porta, unidadeId, aoAbrir }: { porta: Porta; unidadeId: string; aoAbrir: () => void }) {
  const queryClient = useQueryClient()
  const [termo, setTermo] = React.useState('')
  const [buscado, setBuscado] = React.useState('')
  const [modo, setModo] = React.useState<'nenhum' | 'existente' | 'novo'>('nenhum')
  const [existente, setExistente] = React.useState<Achado | null>(null)
  const [dados, setDados] = React.useState<Cadastro>(CADASTRO_VAZIO)
  const [queixa, setQueixa] = React.useState('')
  const [prioridades, setPrioridades] = React.useState<PrioridadeLegal[]>([])
  const [duplicata, setDuplicata] = React.useState<{ tipo: 'documento' | 'provavel'; id: string; texto: string } | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [rnAberto, setRnAberto] = React.useState(false)
  const [erroLocal, setErroLocal] = React.useState<string | null>(null)
  // paciente com episódio aberto: avisa na seleção (busca) ou quando a RPC recusa
  const [alvoAberto, setAlvoAberto] = React.useState<string | null>(null)
  const [recusouAberto, setRecusouAberto] = React.useState(false)
  const hoje = hojeSP()

  const aberto = useQuery({
    queryKey: ['recepcao-aberto', alvoAberto],
    enabled: !!alvoAberto,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('atendimento_aberto_do_paciente', { p_paciente: alvoAberto! })
      if (error) throw error
      return ((data ?? []) as Aberto[])[0] ?? null
    },
  })

  // sugere ao digitar: 3 letras (ou 4 números), com uma pausa curta
  React.useEffect(() => {
    const t = termo.trim()
    const id = setTimeout(() => setBuscado(termoValido(t) ? t : ''), 350)
    return () => clearTimeout(id)
  }, [termo])

  const busca = useQuery({
    queryKey: ['recepcao-busca', unidadeId, buscado],
    enabled: !!buscado && modo === 'nenhum',
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId, p_termo: buscado })
      if (error) throw error
      return (data ?? []) as Achado[]
    },
  })

  const mudar = (k: CampoCadastro, v: string) => {
    setErroLocal(null)
    setDados((d) => ({ ...d, [k]: v }))
  }

  function limpar() {
    setModo('nenhum')
    setExistente(null)
    setDados(CADASTRO_VAZIO)
    setQueixa('')
    setPrioridades([])
    setDuplicata(null)
    setErroLocal(null)
    setAlvoAberto(null)
    setRecusouAberto(false)
    registrar.reset()
  }

  function usarExistente(a: Achado) {
    limpar()
    setExistente(a)
    setModo('existente')
    setAviso(null)
    if (a.episodio_etapa) setAlvoAberto(a.id)
  }

  // Portão 2, tarefa 5: recém-nascido "RN de <mãe>", ligado ao cadastro da mãe; segue para a ficha
  function rnCadastrado(rn: RnCriado) {
    setRnAberto(false)
    usarExistente({ id: rn.paciente_id, nome: rn.nome, nome_social: null, data_nascimento: rn.data_nascimento, nome_mae: rn.nome_mae,
      cpf_final: null, cns_final: null, prontuario: rn.prontuario, episodio_etapa: null })
    if (!rn.mae_tem_documento) setAviso('Recém-nascido cadastrado. A mãe está sem CNS e sem CPF válidos: na regulação, o RN sai como não identificado até o documento dela ser completado.')
  }

  function novoCadastro() {
    limpar()
    const t = termo.trim()
    const d = soDigitos(t)
    setDados({
      ...CADASTRO_VAZIO,
      nome: /\d/.test(t) ? '' : t,
      cpf: d.length === 11 ? d : '',
      cns: d.length === 15 ? d : '',
    })
    setModo('novo')
    setAviso(null)
  }

  const registrar = useMutation({
    mutationFn: async ({ outraPessoa, pacienteId }: { outraPessoa?: boolean; pacienteId?: string } = {}) => {
      // p_dados: pessoa nova manda tudo; cadastro existente manda só o que foi
      // preenchido fora da identificação (contato, documentos, dados do SUS)
      const paraExistente = !!pacienteId || modo === 'existente'
      const enviados = Object.fromEntries(
        Object.entries(normalizarCadastro(dados)).filter(([k, v]) =>
          paraExistente ? v.trim() !== '' && !IDENTIDADE.includes(k as CampoCadastro) : true),
      )
      const { data, error } = await supabase.rpc('registrar_ficha', {
        p_setor: porta.id,
        p_queixa: queixa.trim(),
        p_paciente: pacienteId ?? existente?.id ?? undefined,
        p_dados: enviados,
        p_prioridades: prioridades,
        p_outra_pessoa: outraPessoa ?? false,
      })
      if (error) throw error
      return data as { prontuario: string }
    },
    onSuccess: (r) => {
      const nome = modo === 'existente' ? existente?.nome : dados.nome.trim()
      setAviso(`${nome || 'Paciente'} entrou na fila da triagem · prontuário ${r.prontuario}.`)
      limpar()
      setTermo('')
      setBuscado('')
      aoAbrir()
    },
    onError: (e: Error, vars) => {
      const m = e.message.match(/^FICHA_DUPLICATA_(DOCUMENTO|PROVAVEL):([0-9a-f-]{36}) (.*)$/)
      if (m) setDuplicata({ tipo: m[1] === 'DOCUMENTO' ? 'documento' : 'provavel', id: m[2], texto: m[3] })
      if (ehEpisodioAberto(e.message)) {
        setDuplicata(null)
        setRecusouAberto(true)
        const id = vars?.pacienteId ?? existente?.id
        if (id) {
          setAlvoAberto(id)
          void queryClient.invalidateQueries({ queryKey: ['recepcao-aberto', id] })
        }
      }
    },
  })

  function enviar() {
    setDuplicata(null)
    if (modo === 'novo' && dados.nome.trim().length < 3) return setErroLocal('Nome é obrigatório.')
    const erros = errosCadastro(dados, hoje)
    const primeiro = Object.values(erros)[0]
    if (primeiro) return setErroLocal(primeiro)
    if (queixa.trim().length < 3) return setErroLocal('Escreva a queixa referida.')
    setErroLocal(null)
    registrar.mutate({})
  }

  const erroServidor = registrar.error && !duplicata && !ehEpisodioAberto(registrar.error.message) ? registrar.error.message.replace(/^FICHA_[A-Z_]+:\s*/, '') : null
  const erro = erroLocal ?? erroServidor
  // aviso vale enquanto a consulta confirma o episódio aberto (sumiu = retirado da fila)
  // O aviso vale enquanto o episódio continua aberto (carregando conta como
  // aberto) e some quando a consulta volta vazia: foi retirado da fila. Sem id
  // (cadastro novo que colidiu), fica o aviso genérico da recusa.
  const temAberto = alvoAberto ? aberto.data !== null : recusouAberto
  const achados = modo === 'nenhum' && buscado ? busca.data : undefined
  const nasc = modo === 'existente' ? existente?.data_nascimento : dados.data_nascimento
  const pediatrico = nasc ? ehPediatrico(nasc, hoje) : null
  const foraDaPorta =
    pediatrico === true && porta.publico === 'adulto' ? 'Paciente pediátrico (até 13 anos, 11 meses e 29 dias) numa porta adulta: confira a porta.'
    : pediatrico === false && porta.publico === 'pediatrico' ? 'Paciente com 14 anos ou mais numa porta pediátrica: confira a porta.'
    : null

  return (
    <div className="flex flex-col">
      <div className="mb-3.5 flex flex-wrap gap-2.5">
        <label className={cn(cartao, 'flex min-w-0 flex-[1_1_320px] items-center gap-2.5 px-3.5 py-[11px] focus-within:border-acao')}>
          <Search className="size-[17px] shrink-0 text-tinta-sussurro" aria-hidden />
          <input
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value)
              setAviso(null)
            }}
            onKeyDown={(e) => { if (e.key === 'Escape') setTermo('') }}
            placeholder="Nome, CPF, Cartão SUS ou nome da mãe"
            aria-label="Buscar paciente"
            role="combobox"
            aria-expanded={!!achados?.length}
            aria-controls="rec-achados"
            aria-autocomplete="list"
            className="min-w-0 flex-1 border-0 bg-transparent text-corpo text-tinta outline-none placeholder:text-tinta-sussurro"
          />
          {busca.isFetching && <Spinner className="size-4" />}
        </label>
        <Button className="min-h-[42px] px-[15px]" onClick={novoCadastro}>
          <ClipboardPlus /> Novo cadastro
        </Button>
        <Button variant="outline" className="min-h-[42px] px-[15px]" onClick={() => setRnAberto(true)}>
          <Baby /> Recém-nascido
        </Button>
      </div>

      {busca.error && modo === 'nenhum' && <p className="mb-3 text-apoio text-critico">{(busca.error as Error).message}</p>}

      {achados && achados.length > 0 && (
        <div className="relative z-30 h-0">
          <div id="rec-achados" role="listbox" aria-label="Cadastros encontrados"
            className="absolute inset-x-0 -top-2.5 max-h-[420px] overflow-y-auto rounded-cartao border border-fio bg-superficie shadow-popover">
            {achados.map((a) => (
              <div key={a.id} role="option" aria-selected={false} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-0">
                <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                  <span className="text-corpo font-medium text-tinta">
                    {nomeExibicao(a.nome, a.nome_social)}{' '}
                    <span className="text-apoio font-normal text-tinta-sussurro">{a.data_nascimento ? rotuloIdade(a.data_nascimento, hoje) : ''}</span>
                  </span>
                  {a.documento_unificado && (
                    <span className="text-apoio text-observacao">Documento de cadastro unificado: o documento buscado é de um cadastro unificado a este.</span>
                  )}
                  <span className="text-apoio text-pretty text-tinta-sussurro">
                    {[
                      `CPF ${a.cpf_final ?? '—'}`,
                      `CNS ${a.cns_final ?? '—'}`,
                      `Mãe: ${a.nome_mae ?? '—'}`,
                      a.data_nascimento ? `nasc. ${a.data_nascimento.split('-').reverse().join('/')}` : null,
                      a.prontuario ? `pront. ${a.prontuario}` : null,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </div>
                {a.episodio_etapa ? (
                  <>
                    <span className="text-apoio text-observacao">{SITUACAO[a.episodio_etapa] ?? 'Já está na unidade'}</span>
                    <Button variant="outline" onClick={() => usarExistente(a)}>Ver situação</Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => usarExistente(a)}>Abrir ficha</Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {achados && achados.length === 0 && !busca.isFetching && (
        <p className="mb-4 text-apoio text-tinta-sussurro">Nenhum cadastro com esse dado. Use Novo cadastro.</p>
      )}

      {modo !== 'nenhum' && (
        <section className={cn(cartao, 'flex flex-col gap-3.5 px-5 py-[18px]')} aria-label="Ficha">
          <TituloCartao
            className="mb-0 items-center"
            extra={<Button variant="ghost" size="icon-sm" onClick={limpar} aria-label="Fechar"><X aria-hidden /></Button>}
          >
            {modo === 'existente' ? `Ficha de ${existente ? nomeExibicao(existente.nome, existente.nome_social) : ''}` : 'Novo cadastro'}
          </TituloCartao>
          {modo === 'existente' && (
            <p className="-mt-2 text-apoio text-tinta-sussurro">
              Prontuário {existente?.prontuario ?? '—'}. Preencha só o que mudou ou faltava (telefone, endereço, responsável, raça/cor).
            </p>
          )}
          {modo === 'novo' && (
            <p className="-mt-2 text-apoio text-tinta-sussurro">
              Nome e queixa são obrigatórios. Paciente sem identificação pode ser cadastrado com o que se sabe.
            </p>
          )}

          {duplicata && (
            <Aviso
              tom="atencao"
              anunciar
              acao={
                <>
                  <Button variant="outline" onClick={() => registrar.mutate({ pacienteId: duplicata.id })}>Usar o cadastro existente</Button>
                  {duplicata.tipo === 'provavel' && (
                    <Button variant="outline" onClick={() => registrar.mutate({ outraPessoa: true })}>É outra pessoa</Button>
                  )}
                </>
              }
            >
              {duplicata.texto}
            </Aviso>
          )}

          {temAberto && (
            <div role="alert" className="flex flex-wrap items-center gap-2.5 rounded-container border border-atencao/25 bg-alerta-atencao px-3.5 py-2.5">
              <TriangleAlert className="size-[15px] shrink-0 text-atencao" aria-hidden />
              <span className="min-w-0 flex-[1_1_280px] text-apoio text-pretty text-atencao">
                {aberto.data
                  ? `Este paciente tem um atendimento sem desfecho desde ${diaHora(aberto.data.chegada_em)} no ${aberto.data.setor} (${ETAPA_ABERTA(aberto.data)}).`
                  : 'Este paciente tem um atendimento sem desfecho nesta unidade.'}{' '}
                O desfecho é dado pelo médico ou pela equipe desse setor; se foi engano ou duplicidade, retire da fila.
              </span>
              {aberto.data?.na_minha_porta && ['triagem', 'atendimento'].includes(aberto.data.etapa) && !aberto.data.em_atendimento && (
                <ExcluirDaFila episodioId={aberto.data.episodio_id} nome={existente?.nome_social || existente?.nome || 'O paciente'} />
              )}
            </div>
          )}

          <CamposCadastro prefixo="rec" valores={dados} onChange={mudar} identificacao={modo === 'novo'} hoje={hoje} />

          {/* Fase 3, tarefa 3: endereço do SUS (BPA), sem travar a ficha */}
          {modo === 'existente' && existente && (
            <details className="rounded-container border border-fio px-3.5 py-2.5">
              <summary className="cursor-pointer text-apoio text-tinta-apoio">Endereço e dados do SUS (para o BPA; não obrigatório)</summary>
              <div className="pt-2"><EnderecoSus pacienteId={existente.id} titulo={false} /></div>
            </details>
          )}

          {foraDaPorta && <p className="text-apoio text-atencao">{foraDaPorta}</p>}

          <Campo id="rec-queixa" rotulo="Queixa referida pelo paciente">
            <Input id="rec-queixa" value={queixa} onChange={(e) => { setQueixa(e.target.value); setErroLocal(null) }} placeholder="Nas palavras do paciente ou do acompanhante" />
          </Campo>

          <div className="flex flex-col gap-2">
            <span className="text-apoio font-medium text-grafite">Atendimento prioritário (Lei 10.048/2000)</span>
            <div role="group" aria-label="Atendimento prioritário" className="flex flex-wrap gap-[7px]">
              {PRIORIDADES_INFORMADAS.map((p) => {
                const on = prioridades.includes(p)
                return (
                  <Chip
                    key={p}
                    variante="opcao"
                    ativo={on}
                    onClick={() => setPrioridades((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]))}
                  >
                    {PRIORIDADE_ROTULO[p]}
                  </Chip>
                )
              })}
            </div>
            <span className="text-rotulo text-tinta-sussurro">60 anos ou mais e 80 anos ou mais entram sozinhos, pela data de nascimento.</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <span role={erro ? 'alert' : undefined} className="min-w-0 flex-[1_1_240px] text-apoio text-critico">{erro}</span>
            <Button variant="outline" onClick={limpar}>Cancelar</Button>
            <Button disabled={registrar.isPending || temAberto} onClick={enviar}>
              {registrar.isPending ? <Spinner className="size-4" /> : <ArrowRight />} Enviar para a triagem
            </Button>
          </div>
        </section>
      )}

      {aviso && (
        <div role="status" className="mt-3.5 flex items-center gap-2.5 rounded-container border border-acao/20 bg-alerta-marca px-[15px] py-3">
          <Check className="size-4 text-acao" aria-hidden />
          <span className="text-controle text-acao">{aviso}</span>
        </div>
      )}
      <Dialog open={rnAberto} onOpenChange={setRnAberto}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="text-dialogo">Recém-nascido de paciente cadastrada</DialogTitle>
            <DialogDescription className="text-controle">Escolha o cadastro da mãe. O RN fica como “RN de (nome da mãe)” e segue para a ficha.</DialogDescription>
          </DialogHeader>
          {rnAberto && <FormRn onCriado={rnCadastrado} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Filas ────────────────────────────────────────────────────────────────────

type GrupoFila = { titulo: string; itens: NaFila[]; maiorEspera?: string; acimaDoAlvo?: number }

// Fila agrupada por status (revisão visual 3.2, opção "B" do RT, 21/10/2026;
// referência do Refero: lista da Linear agrupada por status). O cabeçalho do
// grupo leva a contagem, a maior espera e quem passou do alvo da cor, no lugar
// da antiga faixa de contadores. Grupo vazio não aparece.
function ListaFila({ grupos, carregando, erro, vazia, agora }: {
  grupos: GrupoFila[]; carregando: boolean; erro: Error | null; vazia: string; agora: number
}) {
  const hoje = hojeSP()
  const visiveis = grupos.filter((g) => g.itens.length > 0)
  return (
    <div className={cn(cartao, 'overflow-hidden')}>
      {carregando && <div className="px-5 py-5"><Spinner /></div>}
      {erro && <p className="px-5 py-4 text-apoio text-critico">{erro.message}</p>}
      {!carregando && !erro && visiveis.length === 0 && <p className="px-5 py-[22px] text-controle text-tinta-sussurro">{vazia}</p>}
      {visiveis.map((g) => (
        <section key={g.titulo} aria-label={`${g.titulo}: ${g.itens.length}`}>
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 border-b border-trilha bg-campo px-5 py-2.5">
            <span className="text-controle font-semibold text-tinta">{g.titulo}</span>
            <span className="text-controle font-medium text-tinta-sussurro tabular-nums">{g.itens.length}</span>
            {(g.maiorEspera || g.acimaDoAlvo) && (
              <span className={cn('ml-auto text-apoio', g.acimaDoAlvo ? 'font-medium text-critico' : 'text-tinta-sussurro')}>
                {[
                  g.maiorEspera && g.maiorEspera !== '—' ? `maior espera ${g.maiorEspera}` : '',
                  g.acimaDoAlvo ? `${g.acimaDoAlvo} acima do alvo` : '',
                ].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          {g.itens.map((e) => <LinhaFila key={e.episodio_id} e={e} agora={agora} hoje={hoje} />)}
        </section>
      ))}
    </div>
  )
}

function LinhaFila({ e, agora, hoje }: { e: NaFila; agora: number; hoje: string }) {
  const medica = e.etapa === 'atendimento'
  const desde = medica ? (e.classificado_em ?? e.chegada_em) : e.chegada_em
  const ate = e.atendimento_iniciado_em ? new Date(e.atendimento_iniciado_em).getTime() : agora
  const espera = Math.max(0, Math.round((ate - new Date(desde).getTime()) / 60_000))
  const alvo = medica && e.cor_atual ? ALVO_MIN[e.cor_atual] : null
  const estourou = alvo !== null && !e.atendimento_iniciado_em && espera > alvo

  // Status em ponto + texto (opção "B"): o ponto vazio é quem aguarda, o
  // contornado em âmbar foi chamado, o cheio na cor da ação está em atendimento.
  let status = 'Aguardando'
  let textoStatus = 'text-tinta-apoio'
  let ponto = 'border-fio-forte'
  if (e.atendimento_iniciado_em) {
    status = `Em atendimento${e.medico ? ` · ${e.medico}` : ''}`
    textoStatus = 'text-acao'
    ponto = 'border-acao bg-acao'
  } else if (e.chamadas > 0) {
    status = `Chamado${e.chamadas > 1 ? ` ${e.chamadas}ª vez` : ''}${e.ultima_sala ? ` · ${e.ultima_sala}` : ''}${e.ultimo_chamador ? ` · ${e.ultimo_chamador}` : ''}`
    textoStatus = 'text-atencao'
    ponto = 'border-atencao bg-alerta-atencao'
    if (e.chamadas >= 3) {
      status += ' · sem resposta após 3 chamadas'
      textoStatus = 'font-medium text-critico'
      ponto = 'border-critico bg-alerta-critico'
    }
  }

  const prioridades = rotulosPrioridade(e.prioridades_legais)
  const linha = [
    e.queixa ? `Queixa: ${e.queixa}` : '',
    prioridades.length ? `Prioridade: ${prioridades.join(', ')}` : '',
    `Ficha às ${hora(e.chegada_em)}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-[13px] last:border-0">
      {medica ? (
        <PilulaRisco cor={e.cor_atual} />
      ) : (
        <span className={cn(pilula, 'min-w-[76px] justify-center bg-trilha text-tinta-sussurro')}>Sem triagem</span>
      )}
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
        <span className="text-corpo font-medium text-tinta">
          {nomeExibicao(e.nome, e.nome_social)}{' '}
          <span className="text-apoio font-normal text-tinta-sussurro">{e.data_nascimento ? rotuloIdade(e.data_nascimento, hoje) : ''}</span>
        </span>
        <span className="text-apoio text-pretty text-tinta-sussurro">{linha}</span>
      </div>
      <span
        className={cn('text-apoio whitespace-nowrap tabular-nums', estourou ? 'font-semibold text-critico' : 'text-tinta-apoio')}
        title={medica ? 'Espera desde a classificação' : 'Espera desde a ficha'}
      >
        {espera} min{alvo !== null ? ` · alvo ${alvo ? `${alvo} min` : 'imediato'}` : ''}
      </span>
      <span className={cn('flex min-w-0 items-center gap-[7px] text-apoio', textoStatus)}>
        <span aria-hidden className={cn('size-2.5 shrink-0 rounded-capsula border-2', ponto)} />
        {status}
      </span>
      {!e.atendimento_iniciado_em && <ExcluirDaFila episodioId={e.episodio_id} nome={e.nome_social || e.nome} />}
    </div>
  )
}

// ── Painel de chamada ───────────────────────────────────────────────────────

function PainelChamada({ porta, chamadas, carregando, erro }: {
  porta: Porta; chamadas: Chamada[] | undefined; carregando: boolean; erro: Error | null
}) {
  const [erroPainel, setErroPainel] = React.useState<string | null>(null)

  async function abrirPainel() {
    setErroPainel(null)
    // a janela abre já (dentro do clique) e recebe o endereço depois
    const janela = window.open('', 'painel-chamada', 'width=1280,height=720')
    const { data, error } = await supabase.rpc('gerar_link_painel', { p_setor: porta.id })
    if (error || !data) {
      janela?.close()
      setErroPainel(error?.message ?? 'Não foi possível abrir o painel.')
      return
    }
    if (janela) janela.location.href = `/painel/${data as string}`
  }

  return (
    <div className="flex flex-col">
      <div className="mb-[18px] flex flex-wrap gap-2.5">
        <Button className="min-h-9 px-[15px]" onClick={() => void abrirPainel()}>
          <Monitor /> Abrir painel em nova janela
        </Button>
        <span className="self-center text-apoio text-pretty text-tinta-sussurro">
          Na janela nova, clique em Ativar som uma vez e deixe em tela cheia (F11). Abrir de novo gera outro link e desliga o anterior.
        </span>
      </div>
      {erroPainel && <p role="alert" className="mb-3 text-apoio text-critico">{erroPainel}</p>}
      <div className={cn(cartao, 'overflow-hidden')}>
        <div className="border-b border-trilha px-5 py-[13px] text-apoio font-semibold text-tinta">Últimas chamadas</div>
        {carregando && <div className="px-5 py-4"><Spinner /></div>}
        {erro && <p className="px-5 py-4 text-apoio text-critico">{erro.message}</p>}
        {chamadas?.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-[11px] last:border-0">
            <span className="min-w-12 text-apoio tabular-nums text-tinta-sussurro">{hora(c.criado_em)}</span>
            <span className="min-w-0 flex-[1_1_200px] text-corpo font-medium text-tinta">{c.nome}</span>
            <span className="text-controle font-semibold text-acao">{c.sala}</span>
            {c.numero > 1 && <span className={cn(pilula, 'bg-alerta-atencao text-atencao')}>{c.numero}ª chamada</span>}
            <span className="text-apoio text-tinta-sussurro">{c.quem ?? '—'}</span>
          </div>
        ))}
        {chamadas && chamadas.length === 0 && <p className="px-5 py-[18px] text-apoio text-tinta-sussurro">Nenhuma chamada ainda.</p>}
      </div>
    </div>
  )
}
