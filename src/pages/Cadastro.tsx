import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle, ArrowLeft, ArrowRight, BellRing, Bird, CalendarClock, Check, Clock, MailCheck, Pill,
  Repeat, ShieldCheck, Users, X, type LucideIcon,
} from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { PAPEL_LABEL, UFS } from '@/lib/constants'
import {
  AVISOS, CONSELHOS, TERMO_USO_VERSAO, conselhoDoPapel, cpfValido, exigeRegistro, formatarDiaHora,
  formatarPlantao, mascaraContrato, mascaraConvite, mascaraCpf, mascaraData, nascimentoIso, regrasSenha,
  type ChaveAviso, type Conselho,
} from '@/lib/primeiroAcesso'
import type { Database, Papel } from '@/types/database'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

// Primeiro acesso (protótipo primeiro-acesso.html): o vínculo vem antes do
// primeiro leito. Sem convite da unidade ou contrato da rede não há conta.
//
// Passo 1 — confere o código no servidor (RPC pública), mostra o cartão do
// vínculo e junta identidade, senha e aceite do termo.
// Passo 2 — o que vira aviso. Ao concluir (ou "configurar depois"), UM signUp
// leva tudo no metadado: o gatilho do banco consome o convite, cria o vínculo
// e grava os avisos na mesma transação (migration
// 20261003000001_convites_primeiro_acesso.sql). Assim funciona também com a
// confirmação de e-mail ligada, quando o signUp não devolve sessão.
//
// Quem já tem conta e está logado recebe só o convite: aceitar_convite no
// passo 1 e salvar_preferencias_aviso no passo 2 (há sessão).

type Conferido = Database['public']['Functions']['conferir_convite']['Returns'][number]
type ContratoConferido = Database['public']['Functions']['conferir_contrato']['Returns'][number]

type Vinculo =
  | { tipo: 'convite'; codigo: string; dados: Conferido }
  | { tipo: 'contrato'; codigo: string; email: string; dados: ContratoConferido }

type Recado = { tipo: 'erro' | 'prazo' | 'ok'; titulo: string; texto: string; pedirNovo?: boolean }

const MARCA_ENTRADA = 'cc-entrou'

function agora() {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date())
}

// ── peças visuais ───────────────────────────────────────────────────────────

function Passo({ n, titulo, texto, atual, feito }: { n: number; titulo: string; texto: string; atual: boolean; feito: boolean }) {
  return (
    <li
      className={cn(
        'grid grid-cols-[28px_minmax(0,1fr)] items-start gap-[13px] rounded-container border px-3.5 py-3 transition-colors duration-200',
        atual ? 'border-[#5EEAD433] bg-white/[0.08]' : 'border-transparent',
      )}
      aria-current={atual ? 'step' : undefined}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-7 place-items-center rounded-controle-sm text-apoio font-semibold',
          feito ? 'bg-leitos text-white' : atual ? 'bg-[#5EEAD4] text-[#0B3D3A]' : 'bg-white/[0.12] text-[#B7DED8]',
        )}
      >
        {feito ? <Check className="size-3.5" /> : n}
      </span>
      <span>
        <b className="block text-corpo font-semibold tracking-[-0.01em] text-white">{titulo}</b>
        <span className="text-apoio leading-normal text-[#B7DED8]">{texto}</span>
      </span>
    </li>
  )
}

function Campo({ id, rotulo, ajuda, children, className }: { id?: string; rotulo: string; ajuda?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-apoio font-medium text-tinta-apoio">{rotulo}</label>
      {children}
      {ajuda}
    </div>
  )
}

const campoCls = 'min-h-11 bg-superficie px-[13px] text-corpo md:text-corpo'
const codigoCls = 'tabular font-medium tracking-[0.14em] uppercase'
const selectCls =
  'min-h-11 w-full rounded-controle border border-fio bg-superficie px-2.5 text-corpo text-tinta outline-none focus-visible:border-marca'

function RecadoCaixa({ recado, onPedirNovo, pedindo }: { recado: Recado; onPedirNovo: () => void; pedindo: boolean }) {
  const Icone = recado.tipo === 'erro' ? AlertTriangle : recado.tipo === 'prazo' ? Clock : Check
  return (
    <div
      role="alert"
      className={cn(
        'mt-3.5 grid animate-cc-sobe grid-cols-[20px_minmax(0,1fr)] items-start gap-[11px] rounded-container border px-[15px] py-[13px] text-apoio leading-normal',
        recado.tipo === 'erro' && 'border-[#FECACA] bg-[#FEF2F2] text-[#7F1D1D]',
        recado.tipo === 'prazo' && 'border-[#FDE68A] bg-[#FFFBEB] text-[#7C2D12]',
        recado.tipo === 'ok' && 'border-[#B7DED8] bg-[#ECF7F5] text-[#14453F]',
      )}
    >
      <Icone className="mt-px size-[18px]" aria-hidden />
      <span>
        <b className="mb-0.5 block text-controle font-semibold">{recado.titulo}</b>
        {recado.texto}
        {recado.pedirNovo && (
          <Button type="button" variant="outline" className="mt-2.5 flex min-h-10 px-3.5" disabled={pedindo} onClick={onPedirNovo}>
            {pedindo ? 'Pedindo…' : 'Pedir novo convite'}
          </Button>
        )}
      </span>
    </div>
  )
}

function CartaoVinculo({ vinculo }: { vinculo: Vinculo }) {
  let linhas: [string, string][]
  let nota: string
  if (vinculo.tipo === 'convite') {
    const d = vinculo.dados
    const quem = d.convidou
      ? `${d.convidou}${d.convidou_papel === 'gestor' ? ' · coordenação' : d.convidou_papel === 'admin' ? ' · administração' : ''}`
      : null
    const plantao = formatarPlantao(d.primeiro_plantao_inicio, d.primeiro_plantao_fim)
    linhas = [
      ['Unidade', d.unidade],
      ...(d.setor ? ([['Setor', d.setor]] as [string, string][]) : []),
      ['Papel', PAPEL_LABEL[d.papel]],
      ...(plantao ? ([['Primeiro plantão', plantao]] as [string, string][]) : []),
      ...(quem ? ([['Convidou', quem]] as [string, string][]) : []),
      ['Vale até', formatarDiaHora(d.expira_em)],
    ]
    nota = 'O convite vale só para esta unidade. Para plantonar em outra, a coordenação de lá manda outro.'
  } else {
    const d = vinculo.dados
    linhas = [
      ['Contrato', `${vinculo.codigo} · ${d.organizacao}`],
      ['Escopo', d.unidades === 1 ? '1 unidade' : `${d.unidades} unidades`],
      ['Papel', PAPEL_LABEL[d.papel]],
      ['Vigência', d.vigente_ate ? `até ${new Date(`${d.vigente_ate}T12:00:00`).toLocaleDateString('pt-BR')}` : 'sem prazo'],
      ['Responsável', 'Administração da rede'],
    ]
    nota =
      'A conta nasce agora; o vínculo com as unidades é liberado pela administração da rede. Gestão não vê nome de paciente fora da própria unidade, e a administração da rede não vê em nenhuma.'
  }
  return (
    <div className="mt-[18px] rounded-menu border border-[#B7DED8] bg-[#ECF7F5] px-[17px] py-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-capsula bg-leitos px-[9px] py-1 text-rotulo font-medium text-white">
          <Check className="size-3" aria-hidden />
          {vinculo.tipo === 'convite' ? 'Convite conferido' : 'Contrato conferido'}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-3.5 gap-y-0.5 text-apoio sm:grid-cols-[108px_minmax(0,1fr)] sm:gap-y-[7px]">
        {linhas.map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="text-tinta-sussurro">{k}</dt>
            <dd className="mb-2 font-medium text-tinta sm:mb-0">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      <p className="mt-3 text-rotulo text-tinta-apoio">{nota}</p>
    </div>
  )
}

function Regra({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icone = ok ? Check : X
  return (
    <li className={cn('grid grid-cols-[15px_minmax(0,1fr)] items-center gap-2 text-rotulo', ok ? 'text-[#14532D]' : 'text-tinta-sussurro')}>
      <Icone className="size-[13px]" aria-hidden />
      {children}
      <span className="sr-only">{ok ? '(cumprida)' : '(pendente)'}</span>
    </li>
  )
}

function Chave({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <span className="relative h-6 w-[42px] shrink-0">
      <input
        type="checkbox"
        checked={ligado}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={rotulo}
        className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0"
      />
      <span className="pointer-events-none block h-6 w-[42px] rounded-capsula bg-fio-forte transition-colors duration-200 peer-checked:bg-acao peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marca" />
      <span className="pointer-events-none absolute top-[3px] left-[3px] size-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(15,23,42,0.25)] transition-transform duration-200 peer-checked:translate-x-[18px]" />
    </span>
  )
}

const ICONE_AVISO: Record<ChaveAviso, LucideIcon> = {
  observacao_6h: Clock,
  leito_novo: Users,
  prescricao_devolvida: Pill,
  item_abaixo_minimo: AlertTriangle,
  troca_plantao: Repeat,
  fim_turno_30min: CalendarClock,
}

function Abas<T extends string>({ valor, opcoes, onChange, rotulo }: { valor: T; opcoes: [T, string][]; onChange: (v: T) => void; rotulo: string }) {
  return (
    <div role="tablist" aria-label={rotulo} className="grid grid-cols-2 gap-1 rounded-container bg-trilha p-1">
      {opcoes.map(([v, texto]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={valor === v}
          onClick={() => onChange(v)}
          className={cn(
            'rounded-controle-sm px-3 py-[9px] text-controle font-medium transition-colors',
            valor === v ? 'bg-superficie text-acao-pressionada shadow-[0_1px_2px_rgba(15,23,42,0.08)]' : 'text-tinta-apoio hover:text-acao',
          )}
        >
          {texto}
        </button>
      ))}
    </div>
  )
}

function TermoDialogo({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Termo de uso e sigilo</DialogTitle>
          <DialogDescription>Versão {TERMO_USO_VERSAO}. O aceite fica registrado com data e hora.</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto text-apoio text-tinta-apoio">
          <p><b className="text-tinta">Sigilo.</b> O que você vê de paciente na plataforma é informação de saúde protegida por sigilo profissional. Não sai da unidade: não se copia, não se fotografa, não se repassa fora do cuidado.</p>
          <p><b className="text-tinta">Acesso pessoal.</b> A senha é sua e não se compartilha. Cada registro leva o seu nome; nada sai em nome de outra pessoa.</p>
          <p><b className="text-tinta">Registro dos acessos.</b> Seus acessos a prontuário ficam registrados com data e hora, e podem ser auditados pela unidade.</p>
          <p><b className="text-tinta">Seus dados (LGPD).</b> Nome, CPF, nascimento, registro profissional e e-mail são tratados para identificar quem atua no plantão, montar a escala e cumprir obrigações de registro e auditoria (Lei 13.709/2018, art. 7º, II, e art. 11, II, a). Você pode pedir acesso e correção à coordenação da unidade.</p>
          <p><b className="text-tinta">Fim do vínculo.</b> Quando o vínculo termina, o acesso é revogado; os registros que você fez continuam no prontuário, como exige a guarda.</p>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onFechar}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── a tela ──────────────────────────────────────────────────────────────────

export function Cadastro() {
  const { perfil } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const logado = !!perfil

  const [etapa, setEtapa] = React.useState<1 | 2 | 'confirmar-email'>(1)
  const [via, setVia] = React.useState<'convite' | 'contrato'>('convite')
  const [codigo, setCodigo] = React.useState('')
  const [codigoInvalido, setCodigoInvalido] = React.useState(false)
  const [ctNum, setCtNum] = React.useState('')
  const [ctEmail, setCtEmail] = React.useState('')
  const [ctInvalido, setCtInvalido] = React.useState(false)
  const [conferindo, setConferindo] = React.useState(false)
  const [pedindo, setPedindo] = React.useState(false)
  const [recado, setRecado] = React.useState<Recado | null>(null)
  const [vinculo, setVinculo] = React.useState<Vinculo | null>(null)

  const [nome, setNome] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [cpf, setCpf] = React.useState('')
  const [nasc, setNasc] = React.useState('')
  const [conselho, setConselho] = React.useState<Conselho>('CRM')
  const [registro, setRegistro] = React.useState('')
  const [uf, setUf] = React.useState('SP')
  const [senha, setSenha] = React.useState('')
  const [senha2, setSenha2] = React.useState('')
  const [termo, setTermo] = React.useState(false)
  const [termoAberto, setTermoAberto] = React.useState(false)
  const [enviando, setEnviando] = React.useState(false)
  const [erroEnvio, setErroEnvio] = React.useState<string | null>(null)

  const [concluidoEm, setConcluidoEm] = React.useState<string | null>(null)
  const [avisos, setAvisos] = React.useState<Record<ChaveAviso, boolean>>(
    () => Object.fromEntries(AVISOS.map((a) => [a.chave, a.padrao])) as Record<ChaveAviso, boolean>,
  )
  const [canal, setCanal] = React.useState<'plataforma' | 'aparelho'>('plataforma')
  const [salvandoAvisos, setSalvandoAvisos] = React.useState(false)
  const [erroAvisos, setErroAvisos] = React.useState<string | null>(null)

  const refDepois = React.useRef<HTMLDivElement>(null)
  const refTitulo2 = React.useRef<HTMLHeadingElement>(null)

  const papel: Papel | null = vinculo ? vinculo.dados.papel : null
  const pedeRegistro = exigeRegistro(papel)
  // Quem já tem conta só completa o que falta no perfil.
  const faltaNoPerfil = {
    cpf: !logado || !perfil?.cpf,
    nasc: !logado || !perfil?.data_nascimento,
    registro: pedeRegistro && (!logado || !perfil?.registro_numero),
  }

  function trocarVia(v: 'convite' | 'contrato') {
    setVia(v)
    setRecado(null)
    setVinculo(null)
    setErroEnvio(null)
  }

  function abrirVinculo(v: Vinculo) {
    setRecado(null)
    setVinculo(v)
    setConselho(conselhoDoPapel(v.dados.papel))
    if (v.tipo === 'contrato') setEmail(v.email)
    requestAnimationFrame(() => {
      refDepois.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      document.getElementById(logado ? 'id-termo' : 'id-nome')?.focus({ preventScroll: true })
    })
  }

  async function conferirConvite(e: React.FormEvent) {
    e.preventDefault()
    const cod = codigo.trim().toUpperCase()
    setVinculo(null)
    setErroEnvio(null)
    if (!/^CC-[A-Z0-9]{5}$/.test(cod)) {
      setCodigoInvalido(true)
      setRecado({ tipo: 'erro', titulo: 'Código incompleto', texto: 'São cinco caracteres depois do traço, como na mensagem que você recebeu.' })
      return
    }
    setConferindo(true)
    const { data, error } = await supabase.rpc('conferir_convite', { p_codigo: cod })
    setConferindo(false)
    const r = data?.[0]
    if (error || !r) {
      setRecado({ tipo: 'erro', titulo: 'Não deu para conferir agora', texto: 'A conexão falhou. Tente de novo em instantes.' })
      return
    }
    if (r.situacao === 'valido') {
      setCodigoInvalido(false)
      abrirVinculo({ tipo: 'convite', codigo: cod, dados: r })
      return
    }
    if (r.situacao === 'expirado') {
      setCodigoInvalido(false)
      setRecado({
        tipo: 'prazo',
        titulo: `Convite expirado em ${formatarDiaHora(r.expira_em)}`,
        texto: `Pedir outro avisa ${r.convidou ?? 'a coordenação da unidade'} na lista de convites — não é preciso ligar.`,
        pedirNovo: true,
      })
      return
    }
    setCodigoInvalido(r.situacao !== 'muitas_tentativas')
    if (r.situacao === 'usado') {
      setRecado({ tipo: 'erro', titulo: 'Convite já usado', texto: 'Cada convite abre um acesso só. Se foi você, entre com o seu e-mail e senha; se não foi, avise a coordenação.' })
    } else if (r.situacao === 'revogado') {
      setRecado({ tipo: 'erro', titulo: 'Convite cancelado pela unidade', texto: 'A coordenação cancelou este código. Peça um novo a quem te convidou.' })
    } else if (r.situacao === 'muitas_tentativas') {
      setRecado({ tipo: 'erro', titulo: 'Muitas tentativas', texto: 'Esta rede errou o código muitas vezes seguidas. Espere 15 minutos e confira o código com calma.' })
    } else {
      setRecado({
        tipo: 'erro',
        titulo: 'Código não confere',
        texto: 'São cinco caracteres depois do traço, como na mensagem que você recebeu. Confira letra por letra; o código não distingue maiúscula de minúscula.',
      })
      document.getElementById('codigo')?.focus({ preventScroll: true })
    }
  }

  async function pedirNovo() {
    setPedindo(true)
    const { data, error } = await supabase.rpc('pedir_novo_convite', { p_codigo: codigo.trim().toUpperCase() })
    setPedindo(false)
    if (error || !data?.[0]) {
      setRecado({ tipo: 'erro', titulo: 'Pedido não enviado', texto: error?.message ?? 'Tente de novo em instantes.' })
      return
    }
    setRecado({
      tipo: 'ok',
      titulo: 'Pedido enviado',
      texto: `${data[0].convidou ?? 'A coordenação'} vê o pedido na lista de convites da unidade desde as ${agora()}. O novo código chega por quem te convidou.`,
    })
  }

  async function conferirContrato(e: React.FormEvent) {
    e.preventDefault()
    const num = ctNum.trim().toUpperCase()
    const mail = ctEmail.trim().toLowerCase()
    setVinculo(null)
    setErroEnvio(null)
    if (!/^\S+@\S+\.\S+$/.test(mail) || !/^CT-\d{4}-\d{3}$/.test(num)) {
      setCtInvalido(true)
      setRecado({ tipo: 'erro', titulo: 'Faltam dados', texto: 'Informe o e-mail corporativo e o número do contrato no formato CT-ano-000.' })
      return
    }
    setConferindo(true)
    const { data, error } = await supabase.rpc('conferir_contrato', { p_codigo: num, p_email: mail })
    setConferindo(false)
    const r = data?.[0]
    if (error || !r) {
      setRecado({ tipo: 'erro', titulo: 'Não deu para conferir agora', texto: 'A conexão falhou. Tente de novo em instantes.' })
      return
    }
    if (r.situacao === 'valido') {
      setCtInvalido(false)
      abrirVinculo({ tipo: 'contrato', codigo: num, email: mail, dados: r })
      return
    }
    setCtInvalido(true)
    setRecado(
      r.situacao === 'muitas_tentativas'
        ? { tipo: 'erro', titulo: 'Muitas tentativas', texto: 'Esta rede errou muitas vezes seguidas. Espere 15 minutos.' }
        : {
            tipo: 'erro',
            titulo: 'Contrato não confere',
            texto: 'O número está no documento assinado pela rede, no formato CT-ano-000, e o e-mail precisa ser o corporativo da rede. Se você é plantonista, enfermagem ou farmácia, seu acesso vem por convite da unidade.',
          },
    )
  }

  // ── o que ainda falta ─────────────────────────────────────────────────────
  const regras = regrasSenha(senha, email)
  const senhaOk = regras.tamanho && regras.letra && regras.numero && regras.diferenteEmail
  const iguais = senha2.length > 0 && senha2 === senha
  const cpfCompleto = cpf.replace(/\D/g, '').length === 11
  const cpfOk = cpfValido(cpf)
  const nascIso = nascimentoIso(nasc)

  const falta: { rotulo: string; campo: string }[] = []
  if (!logado) {
    if (nome.trim().split(/\s+/).length < 2) falta.push({ rotulo: 'nome', campo: 'id-nome' })
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) falta.push({ rotulo: 'e-mail', campo: 'id-email' })
  }
  if (faltaNoPerfil.cpf && !cpfOk) falta.push({ rotulo: 'CPF', campo: 'id-cpf' })
  if (faltaNoPerfil.nasc && !nascIso) falta.push({ rotulo: 'nascimento', campo: 'id-nasc' })
  if (faltaNoPerfil.registro && !/^[0-9A-Za-z.-]{2,15}$/.test(registro.trim())) falta.push({ rotulo: 'registro profissional', campo: 'id-registro' })
  if (!logado) {
    if (!senhaOk) falta.push({ rotulo: 'senha', campo: 'id-senha' })
    if (!iguais) falta.push({ rotulo: 'repetir a senha', campo: 'id-senha2' })
  }
  if (!termo) falta.push({ rotulo: 'aceitar o termo', campo: 'id-termo' })
  const pronto = falta.length === 0

  function mensagemDoCadastro(msg: string): string {
    if (/already registered|already exists/i.test(msg)) {
      return 'Este e-mail já tem conta. Entre com ela; um convite novo pode ser aceito depois de entrar, nesta mesma tela.'
    }
    if (/database error/i.test(msg)) {
      return 'O banco recusou o cadastro: o convite pode ter vencido ou sido usado enquanto você preenchia, ou este CPF já tem conta. Confira o código de novo.'
    }
    if (/password/i.test(msg)) return 'A senha foi recusada pelo servidor. Use uma senha mais longa, com letras e números.'
    if (/rate limit|too many/i.test(msg)) return 'Muitos cadastros seguidos desta rede. Espere alguns minutos.'
    return msg
  }

  // Passo 1 → passo 2. Quem já tem conta aceita o convite aqui mesmo (há
  // sessão). Conta nova só nasce no fim do passo 2: sem sessão (confirmação de
  // e-mail ligada) não há como gravar os avisos depois, então eles vão no
  // mesmo signUp que consome o convite.
  async function concluir(e: React.FormEvent) {
    e.preventDefault()
    if (!vinculo) return
    if (!pronto) {
      document.getElementById(falta[0].campo)?.focus({ preventScroll: false })
      return
    }
    setErroEnvio(null)

    if (logado) {
      setEnviando(true)
      const { error } = await supabase.rpc('aceitar_convite', {
        p_codigo: vinculo.codigo,
        p_termo_versao: TERMO_USO_VERSAO,
        ...(faltaNoPerfil.cpf ? { p_cpf: cpf.replace(/\D/g, '') } : {}),
        ...(faltaNoPerfil.nasc && nascIso ? { p_data_nascimento: nascIso } : {}),
        ...(faltaNoPerfil.registro
          ? { p_conselho: conselho, p_registro_numero: registro.trim().toUpperCase(), p_registro_uf: uf }
          : {}),
      })
      setEnviando(false)
      if (error) {
        setErroEnvio(error.message)
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['vinculos'] })
      setConcluidoEm(agora())
    }
    irParaAvisos()
  }

  function irParaAvisos() {
    setErroAvisos(null)
    setEtapa(2)
    window.scrollTo(0, 0)
    requestAnimationFrame(() => refTitulo2.current?.focus({ preventScroll: true }))
  }

  function voltarAoPasso1() {
    setEtapa(1)
    window.scrollTo(0, 0)
  }

  function entrar() {
    try {
      sessionStorage.setItem(MARCA_ENTRADA, '1')
    } catch {
      /* sem sessionStorage a pilha de avisos só não dispara */
    }
    navigate('/', { replace: true })
  }

  /** Cria a conta (signUp). O gatilho do banco consome o convite e grava os avisos. */
  async function criarConta(comAvisos: boolean) {
    if (!vinculo) return
    setErroAvisos(null)
    setSalvandoAvisos(true)
    const registroDados = pedeRegistro || registro.trim()
      ? { conselho, registro_numero: registro.trim().toUpperCase(), registro_uf: uf }
      : {}
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: senha,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          nome_completo: nome.trim().replace(/\s+/g, ' '),
          ...(vinculo.tipo === 'convite' ? { codigo_convite: vinculo.codigo } : { codigo_contrato: vinculo.codigo }),
          cpf: cpf.replace(/\D/g, ''),
          data_nascimento: nascIso,
          ...registroDados,
          termo_versao: TERMO_USO_VERSAO,
          ...(comAvisos ? { avisos: { ...avisos, observacao_6h: true }, canal_aviso: canal } : {}),
        },
      },
    })
    setSalvandoAvisos(false)
    if (error) {
      setErroAvisos(mensagemDoCadastro(error.message))
      return
    }
    // Com confirmação de e-mail ligada, e-mail repetido volta "ok" sem identidade.
    if (!data.user || data.user.identities?.length === 0) {
      setErroAvisos(mensagemDoCadastro('already registered'))
      return
    }
    setConcluidoEm(agora())
    if (data.session) {
      entrar()
    } else {
      setEtapa('confirmar-email')
      window.scrollTo(0, 0)
    }
  }

  /** Quem já tem conta: grava os avisos pela RPC (há sessão). */
  async function salvarAvisosLogado() {
    setErroAvisos(null)
    setSalvandoAvisos(true)
    const { error } = await supabase.rpc('salvar_preferencias_aviso', {
      p_preferencias: { ...avisos, observacao_6h: true },
      p_canal: canal,
    })
    setSalvandoAvisos(false)
    if (error) {
      setErroAvisos('Não deu para gravar os avisos agora. Você pode escolher depois, em Avisos.')
      return
    }
    entrar()
  }

  const passo1Feito = etapa !== 1

  return (
    <div className="grid min-h-dvh bg-campo lg:grid-cols-[46%_minmax(0,1fr)]">
      {/* ── coluna verde: onde a pessoa está ── */}
      <aside className="relative flex flex-col justify-between gap-10 overflow-hidden bg-acao-pressionada px-5 pt-7 pb-8 text-white sm:px-7 lg:px-12 lg:pt-9 lg:pb-10">
        <span aria-hidden className="pointer-events-none absolute -top-[50px] -right-[180px] h-[92px] w-[620px] -rotate-[38deg] rounded-capsula bg-marca opacity-90" />
        <span aria-hidden className="pointer-events-none absolute top-40 -right-[90px] h-[92px] w-[480px] -rotate-[38deg] rounded-capsula bg-[#5EEAD426]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-[120px] -left-[110px] size-[300px] rounded-full bg-[#5EEAD414]" />

        <Link to="/" className="relative z-10 flex items-center gap-2.5 text-white">
          <span className="grid size-8 place-items-center rounded-controle bg-white/[0.12]"><Bird className="size-[18px]" aria-hidden /></span>
          <span className="text-secao font-semibold tracking-[-0.02em]">Chefe Coruja</span>
        </Link>

        <div className="relative z-10">
          <h1 className="mb-3.5 max-w-[16ch] text-[30px] leading-[1.06] font-semibold tracking-[-0.032em] lg:text-[40px]">
            O vínculo vem <span className="text-[#5EEAD4]">antes do primeiro leito</span>
          </h1>
          <p className="max-w-[40ch] text-base text-[#B7DED8]">
            Enquanto a unidade não confirma quem você é e em que papel entra, a plataforma não mostra paciente.
          </p>
          <ol className="mt-[34px] flex flex-col gap-2.5">
            <Passo n={1} titulo="Vínculo e senha" texto="Convite, identidade, senha e termo de sigilo. Obrigatório." atual={etapa === 1} feito={passo1Feito} />
            <Passo n={2} titulo="Seus avisos" texto="O que te interrompe durante o plantão. Pode ficar para depois." atual={etapa === 2} feito={etapa === 'confirmar-email'} />
          </ol>
        </div>

        <span className="relative z-10 text-apoio text-[#8FC4BD]">Sem convite ou contrato não há conta.</span>
      </aside>

      {/* ── coluna do formulário ── */}
      <main className="flex flex-col px-5 pt-6 pb-10 sm:px-7 lg:px-12 lg:pt-7">
        <Link to="/login" className="inline-flex items-center gap-[7px] self-start text-controle text-tinta-sussurro transition-all hover:gap-[11px] hover:text-acao">
          <ArrowLeft className="size-[15px]" aria-hidden />
          Voltar ao Entrar
        </Link>

        <div className="m-auto w-full max-w-[460px] animate-cc-sobe py-7">
          {etapa === 1 && (
            <section>
              <p className="rotulo mb-2">Passo 1 de 2 · obrigatório</p>
              <h2 className="mb-1.5 text-[26px] leading-tight font-semibold tracking-[-0.026em] text-acao-pressionada">
                {logado ? 'Aceitar um convite' : 'Confirmar o vínculo'}
              </h2>
              <p className="mb-[22px] text-corpo text-tinta-apoio">
                {logado
                  ? `Você já tem conta, ${perfil?.nome_completo.split(' ')[0]}. O convite acrescenta um vínculo a ela.`
                  : 'O acesso é de uma pessoa, numa unidade, num papel. É isso que este passo estabelece.'}
              </p>

              {!logado && (
                <div className="mb-[22px]">
                  <Abas
                    rotulo="Como o acesso chegou até você"
                    valor={via}
                    onChange={trocarVia}
                    opcoes={[['convite', 'Convite da unidade'], ['contrato', 'Contrato da rede']]}
                  />
                </div>
              )}

              {via === 'convite' ? (
                <form onSubmit={conferirConvite} noValidate className="flex flex-col gap-3.5">
                  <Campo
                    id="codigo"
                    rotulo="Código do convite"
                    ajuda={<span id="codigo-ajuda" className="text-rotulo text-tinta-sussurro">Chega pela coordenação da unidade e vale 7 dias, uma vez só.</span>}
                  >
                    <Input
                      id="codigo"
                      className={cn(campoCls, codigoCls)}
                      inputMode="text"
                      autoComplete="one-time-code"
                      placeholder="CC-00000"
                      maxLength={8}
                      aria-describedby="codigo-ajuda"
                      aria-invalid={codigoInvalido}
                      value={codigo}
                      onFocus={() => { if (!codigo) setCodigo('CC-') }}
                      onChange={(e) => { setCodigo(mascaraConvite(e.target.value)); setCodigoInvalido(false) }}
                    />
                  </Campo>
                  <Button type="submit" size="bloco" className="mt-1.5 bg-acao-pressionada hover:bg-[#0B3D3A]" disabled={conferindo}>
                    {conferindo ? 'Conferindo…' : 'Conferir convite'}
                  </Button>
                </form>
              ) : (
                <form onSubmit={conferirContrato} noValidate className="flex flex-col gap-3.5">
                  <Campo id="ct-mail" rotulo="E-mail corporativo">
                    <Input id="ct-mail" type="email" autoComplete="username" placeholder="nome@rede.org.br" className={campoCls}
                      value={ctEmail} aria-invalid={ctInvalido} onChange={(e) => { setCtEmail(e.target.value); setCtInvalido(false) }} />
                  </Campo>
                  <Campo
                    id="ct-num"
                    rotulo="Número do contrato"
                    ajuda={<span id="ct-ajuda" className="text-rotulo text-tinta-sussurro">Gestão e administração entram por contrato, não por convite de unidade.</span>}
                  >
                    <Input id="ct-num" className={cn(campoCls, codigoCls)} placeholder="CT-2026-000" maxLength={11} aria-describedby="ct-ajuda"
                      value={ctNum} aria-invalid={ctInvalido} onChange={(e) => { setCtNum(mascaraContrato(e.target.value)); setCtInvalido(false) }} />
                  </Campo>
                  <Button type="submit" size="bloco" className="mt-1.5 bg-acao-pressionada hover:bg-[#0B3D3A]" disabled={conferindo}>
                    {conferindo ? 'Conferindo…' : 'Conferir contrato'}
                  </Button>
                </form>
              )}

              {recado && <RecadoCaixa recado={recado} onPedirNovo={pedirNovo} pedindo={pedindo} />}

              {vinculo && (
                <div ref={refDepois} className="animate-cc-sobe">
                  <div className="mt-[22px] h-px bg-fio" />
                  <CartaoVinculo vinculo={vinculo} />

                  <form onSubmit={concluir} noValidate className="mt-5 flex flex-col gap-3.5">
                    {(!logado || faltaNoPerfil.cpf || faltaNoPerfil.nasc || faltaNoPerfil.registro) && (
                      <p className="mt-1.5 text-apoio font-semibold text-acao-pressionada">Quem você é</p>
                    )}
                    {!logado && (
                      <>
                        <Campo id="id-nome" rotulo="Nome completo">
                          <Input id="id-nome" autoComplete="name" placeholder="Como aparece no conselho" className={campoCls}
                            value={nome} onChange={(e) => setNome(e.target.value)} />
                        </Campo>
                        <Campo id="id-email" rotulo="E-mail" ajuda={vinculo.tipo === 'contrato'
                          ? <span className="text-rotulo text-tinta-sussurro">O do contrato. É com ele que você entra.</span>
                          : <span className="text-rotulo text-tinta-sussurro">É com ele que você entra. Chega um link para confirmar.</span>}>
                          <Input id="id-email" type="email" autoComplete="email" placeholder="voce@unidade.org.br" className={campoCls}
                            value={email} readOnly={vinculo.tipo === 'contrato'} onChange={(e) => setEmail(e.target.value)} />
                        </Campo>
                      </>
                    )}
                    {(faltaNoPerfil.cpf || faltaNoPerfil.nasc) && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {faltaNoPerfil.cpf && (
                          <Campo id="id-cpf" rotulo="CPF" ajuda={cpfCompleto && !cpfOk
                            ? <span className="text-rotulo text-critico">CPF não confere (dígito verificador).</span> : undefined}>
                            <Input id="id-cpf" inputMode="numeric" placeholder="000.000.000-00" maxLength={14} className={cn(campoCls, 'tabular')}
                              aria-invalid={cpfCompleto && !cpfOk} value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} />
                          </Campo>
                        )}
                        {faltaNoPerfil.nasc && (
                          <Campo id="id-nasc" rotulo="Nascimento" ajuda={nasc.length === 10 && !nascIso
                            ? <span className="text-rotulo text-critico">Data não confere.</span> : undefined}>
                            <Input id="id-nasc" inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} className={cn(campoCls, 'tabular')}
                              aria-invalid={nasc.length === 10 && !nascIso} value={nasc} onChange={(e) => setNasc(mascaraData(e.target.value))} />
                          </Campo>
                        )}
                      </div>
                    )}
                    {(faltaNoPerfil.registro || (!logado && !pedeRegistro)) && (
                      <Campo
                        id="id-registro"
                        rotulo={pedeRegistro ? 'Registro profissional' : 'Registro profissional (se tiver)'}
                        ajuda={<span className="text-rotulo text-tinta-sussurro">A coordenação confere o registro no conselho antes do primeiro plantão.</span>}
                      >
                        <div className="grid grid-cols-[96px_minmax(0,1fr)_84px] gap-3">
                          <select aria-label="Conselho" className={selectCls} value={conselho} onChange={(e) => setConselho(e.target.value as Conselho)}>
                            {CONSELHOS.map((c) => <option key={c}>{c}</option>)}
                          </select>
                          <Input id="id-registro" inputMode="numeric" placeholder="Número" aria-label="Número do registro" className={cn(campoCls, 'tabular')}
                            value={registro} onChange={(e) => setRegistro(e.target.value.replace(/[^0-9A-Za-z.-]/g, '').slice(0, 15))} />
                          <select aria-label="UF do registro" className={selectCls} value={uf} onChange={(e) => setUf(e.target.value)}>
                            {UFS.map((u) => <option key={u}>{u}</option>)}
                          </select>
                        </div>
                      </Campo>
                    )}

                    {!logado && (
                      <>
                        <div className="mt-2 h-px bg-fio" />
                        <p className="mt-1.5 text-apoio font-semibold text-acao-pressionada">Sua senha</p>
                        <Campo id="id-senha" rotulo="Criar senha">
                          <Input id="id-senha" type="password" autoComplete="new-password" placeholder="••••••••••" aria-describedby="regras-senha"
                            className={campoCls} value={senha} onChange={(e) => setSenha(e.target.value)} />
                          <ul id="regras-senha" className="mt-0.5 grid gap-[5px]">
                            <Regra ok={regras.tamanho}>Dez caracteres ou mais</Regra>
                            <Regra ok={regras.letra}>Ao menos uma letra</Regra>
                            <Regra ok={regras.numero}>Ao menos um número</Regra>
                            <Regra ok={regras.diferenteEmail}>Diferente do seu e-mail</Regra>
                          </ul>
                        </Campo>
                        <Campo id="id-senha2" rotulo="Repetir senha" ajuda={senha2.length > 0 && (
                          <span aria-live="polite" className={cn('text-rotulo', iguais ? 'text-leitos' : 'text-critico')}>
                            {iguais ? 'As duas conferem.' : 'As duas senhas não conferem.'}
                          </span>
                        )}>
                          <Input id="id-senha2" type="password" autoComplete="new-password" placeholder="••••••••••" className={campoCls}
                            value={senha2} onChange={(e) => setSenha2(e.target.value)} />
                        </Campo>
                      </>
                    )}

                    <div className="mt-2 h-px bg-fio" />
                    <label className="grid cursor-pointer grid-cols-[16px_minmax(0,1fr)] items-start gap-2.5 text-apoio leading-normal text-tinta-sussurro">
                      <input id="id-termo" type="checkbox" className="mt-0.5 size-4 accent-marca" checked={termo} onChange={(e) => setTermo(e.target.checked)} />
                      <span>
                        Li e aceito o{' '}
                        <button type="button" className="font-medium text-acao hover:text-acao-pressionada" onClick={() => setTermoAberto(true)}>
                          termo de uso e sigilo
                        </button>
                        . Entendo que o que eu vejo de paciente não sai da unidade, que meus acessos ficam registrados com data e hora, e que meus dados são tratados para registro de plantão e auditoria, conforme a LGPD.
                      </span>
                    </label>

                    {erroEnvio && (
                      <p role="alert" className="rounded-controle border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-apoio text-[#7F1D1D]">{erroEnvio}</p>
                    )}

                    <Button
                      type="submit"
                      size="bloco"
                      aria-disabled={!pronto}
                      disabled={enviando}
                      className="mt-1.5 bg-acao-pressionada hover:bg-[#0B3D3A] aria-disabled:bg-fio-forte aria-disabled:text-tinta-apoio aria-disabled:hover:bg-fio-forte"
                    >
                      {enviando ? 'Aceitando…' : logado ? 'Aceitar convite' : 'Continuar para os avisos'}
                      {!enviando && <ArrowRight className="size-4" aria-hidden />}
                    </Button>
                    <span aria-live="polite" className="text-rotulo text-tinta-sussurro">
                      {pronto ? '' : `Falta: ${falta.map((f) => f.rotulo).join(', ')}.`}
                    </span>
                  </form>
                </div>
              )}

              <p className="mt-[22px] text-apoio text-tinta-sussurro">
                Não recebeu convite? A coordenação da sua unidade gera o acesso antes do primeiro plantão.{' '}
                <Link to="/login" className="text-acao hover:text-acao-pressionada">Já concluí o primeiro acesso</Link>.
              </p>
            </section>
          )}

          {etapa === 2 && (
            <section className="animate-cc-sobe">
              <p className="rotulo mb-2">Passo 2 de 2 · pode ficar para depois</p>
              <h2 ref={refTitulo2} tabIndex={-1} className="mb-1.5 text-[26px] leading-tight font-semibold tracking-[-0.026em] text-acao-pressionada outline-none">
                O que vira aviso
              </h2>
              <p className="mb-[22px] text-corpo text-tinta-apoio">
                {logado
                  ? `Vínculo concluído às ${concluidoEm}. `
                  : 'Dados conferidos. O acesso é criado quando você concluir este passo. '}
                Escolha o que te interrompe durante o plantão — dá para mudar depois em Avisos.
              </p>

              <div className="mb-[18px] flex flex-col gap-2">
                {AVISOS.map((a) => {
                  const Icone = ICONE_AVISO[a.chave]
                  const Linha = a.fixo ? 'div' : 'label'
                  return (
                    <Linha
                      key={a.chave}
                      className="grid cursor-pointer grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-3 rounded-container border border-fio bg-superficie px-[13px] py-[11px] transition-colors hover:border-fio-forte"
                    >
                      <span aria-hidden className={cn('grid size-[30px] place-items-center rounded-controle-sm text-white', a.cor)}>
                        <Icone className="size-[15px]" />
                      </span>
                      <span>
                        <b className="block text-controle font-semibold tracking-[-0.01em] text-tinta">{a.titulo}</b>
                        <span className="text-rotulo text-tinta-sussurro">{a.texto}</span>
                      </span>
                      {a.fixo ? (
                        <span className="inline-flex items-center gap-[5px] text-rotulo font-medium text-leitos">
                          <ShieldCheck className="size-[13px]" aria-hidden />
                          Sempre ligado
                        </span>
                      ) : (
                        <Chave ligado={avisos[a.chave]} rotulo={`Avisar: ${a.titulo}`} onChange={(v) => setAvisos((s) => ({ ...s, [a.chave]: v }))} />
                      )}
                    </Linha>
                  )
                })}
              </div>

              <p className="mb-2 text-apoio font-semibold text-acao-pressionada">Onde avisar</p>
              <div className="mb-5">
                <Abas rotulo="Onde avisar" valor={canal} onChange={setCanal} opcoes={[['plataforma', 'Só na plataforma'], ['aparelho', 'Também no aparelho']]} />
                {canal === 'aparelho' && (
                  <p className="mt-2 flex items-start gap-1.5 text-rotulo text-tinta-sussurro">
                    <BellRing className="mt-px size-3.5 shrink-0" aria-hidden />
                    A escolha fica guardada; o navegador ainda pede a permissão de notificação neste aparelho.
                  </p>
                )}
              </div>

              {erroAvisos && (
                <div role="alert" className="mb-3 rounded-controle border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-apoio text-[#7F1D1D]">
                  {erroAvisos}
                  {!logado && (
                    <button type="button" onClick={voltarAoPasso1} className="mt-1.5 block font-medium text-acao hover:text-acao-pressionada">
                      Voltar ao passo 1 e corrigir
                    </button>
                  )}
                </div>
              )}

              <div className="mt-1 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <Button type="button" variant="outline" size="bloco" onClick={() => (logado ? entrar() : void criarConta(false))} disabled={salvandoAvisos}>
                  Configurar depois
                </Button>
                <Button type="button" size="bloco" className="bg-acao-pressionada hover:bg-[#0B3D3A]" onClick={() => void (logado ? salvarAvisosLogado() : criarConta(true))} disabled={salvandoAvisos}>
                  {salvandoAvisos ? 'Concluindo…' : logado ? 'Entrar no plantão' : 'Concluir acesso'}
                  {!salvandoAvisos && <ArrowRight className="size-4" aria-hidden />}
                </Button>
              </div>

              <p className="mt-[22px] text-apoio text-tinta-sussurro">
                O aviso de observação acima de 6 horas não desliga: é o prazo que o produto observa por profissão.
              </p>
            </section>
          )}

          {etapa === 'confirmar-email' && (
            <section className="animate-cc-sobe">
              <span className="mb-4 grid size-11 place-items-center rounded-controle bg-marca/10 text-acao" aria-hidden>
                <MailCheck className="size-5" />
              </span>
              <h2 className="mb-1.5 text-[26px] leading-tight font-semibold tracking-[-0.026em] text-acao-pressionada">Falta confirmar o e-mail</h2>
              <p className="mb-[22px] text-corpo text-tinta-apoio">
                Mandamos um link para <b className="font-medium text-tinta">{email.trim().toLowerCase()}</b>. Depois de confirmar, entre com esse e-mail e a senha que você criou.
                {vinculo?.tipo === 'contrato' && ' O vínculo com as unidades aguarda a administração da rede.'}
              </p>
              <Link to="/login" className={cn(buttonVariants({ size: 'bloco' }), 'bg-acao-pressionada hover:bg-[#0B3D3A]')}>
                Ir para o Entrar
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </section>
          )}
        </div>
      </main>

      <TermoDialogo aberto={termoAberto} onFechar={() => setTermoAberto(false)} />
    </div>
  )
}
