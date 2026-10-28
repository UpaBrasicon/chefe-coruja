// ─────────────────────────────────────────────────────────────────────────────
// Prescrição estruturada (Fase 4.4) — internação e porta.
//
// Item ligado ao medicamento do cadastro; dose, via e frequência escritas pelo
// médico (nada é sugerido). Nada se apaga: suspender deixa o item no histórico.
// Medicamento, em qualquer idade (Portão 2, tarefa 2): data de nascimento ou
// idade estimada, e peso deste atendimento — aferido, estimado ou referido
// pelo paciente, com a marca de como foi obtido. Alergia
// registrada trava o item. O item guarda a diluição padrão vigente (publicada
// pelo farmacêutico); diluir diferente só com justificativa. Toda regra é do
// servidor; aqui só se mostra e se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, Pill, Printer, Plus } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { dataHora } from '@/lib/formato'
import { faltaNoItem, trechosAchados, type MedicamentoAchado } from '@/lib/buscaMedicamento'
import { abrirImpressao } from '@/lib/prontuario'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OpcaoLista } from '@/components/ui/botao-linha'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Chip } from '@/components/monitor/Pagina'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ResumoAlergias } from '@/components/paciente/AlergiasEventos'
import { AlterarItem } from '@/components/prescricao/AlterarItem'
import { METODOS_PESO, gravarPeso, textoDoPeso, useFaltaParaPrescrever, type MetodoPeso } from '@/components/prescricao/pesoAtendimento'
import { ativas, useAlergias } from '@/components/paciente/useAlergias'
import { frase, interacoesDoErro, semPontoFinal, type InteracaoJustificada, type InteracaoNaPrescricao } from '@/lib/interacoes'
import { resumoMudanca, type Alteracao } from '@/lib/alteracaoPrescricao'

type ItemVigente = {
  id: string; tipo: 'medicamento' | 'cuidado'; descricao: string; medicamento_id: string | null; dose: string | null; via: string | null
  posologia: string | null; se_necessario: boolean; observacao: string | null; peso_kg: number | null; diluicao_versao: number | null
  diluicao_texto: string | null; diluicao_divergente: boolean; justificativa_divergencia: string | null; vasoativo: boolean
  autor: string | null; criado_em: string; validacao: string | null; validacao_motivo: string | null
}
type Medicamento = { id: string; principio_ativo: string; apresentacao: string | null; concentracao: string | null; alta_vigilancia: boolean }
type Diluicao = { id: string; versao: number; texto: string; fonte: string; revisor_crf: string | null }

export type PacientePrescricao = { nome: string; dataAtual?: string; leito?: string; diagnostico?: string }
export type PesoAtual = { valor_num: number; aferido_em: string; metodo: string | null }

const VIAS = ['VO', 'EV', 'IM', 'SC', 'SL', 'INAL', 'TÓPICA', 'RETAL', 'SNE', 'OCULAR']
const VIAS_COM_DILUICAO = ['EV', 'IM', 'SC']
// Cuidados sem dose (o catálogo antigo, sem as doses — decisão de 27/09/2026)
const CUIDADOS = ['Dieta', 'Cabeceira elevada', 'Precaução padrão', 'Vigilância de sintomas álgicos', 'Sinais vitais',
  'Comunicar intercorrências', 'Cuidados gerais de enfermagem', 'Medicações de uso contínuo', 'Mudança de decúbito']

const hora = (iso: string) => dataHora(iso)

export function PrescricaoEstruturada({ pacienteId, paciente }: { pacienteId: string; paciente: PacientePrescricao }) {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  const [erro, setErro] = React.useState<string | null>(null)
  const recarregar = () => {
    for (const k of ['prescricao-vigente', 'alergias', 'peso-atual', 'falta-prescrever']) void qc.invalidateQueries({ queryKey: [k, pacienteId] })
    void qc.invalidateQueries({ queryKey: ['alteracoes-itens'] })
  }

  const itens = useQuery({
    queryKey: ['prescricao-vigente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ItemVigente[]
    },
  })
  // alergia em três estados (tem / nega / não registrada): o painel mora em
  // components/paciente; aqui só o resumo e a folha
  const alergias = useAlergias(pacienteId)
  const peso = useQuery({
    queryKey: ['peso-atual', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('observacao').select('valor_num, aferido_em, metodo, conceito!inner(nome)')
        .eq('paciente_id', pacienteId).eq('conceito.nome', 'peso').order('aferido_em', { ascending: false }).limit(1)
      if (error) throw error
      return (data?.[0] ?? null) as PesoAtual | null
    },
  })

  async function imprimir() {
    const lista = itens.data ?? []
    const impressao = await abrirImpressao({
      pacienteId, internacaoId: null, tipo: 'Prescrição',
      documento: {
        tipo: 'prescricao',
        conteudo: JSON.stringify({
          paciente: {
            ...paciente,
            // lista vazia não é "nega": só imprime NEGA quando há o registro explícito
            alergias: !alergias.data ? 'NÃO VERIFICADA'
              : alergias.data.estado === 'tem' ? ativas(alergias.data).map((a) => a.substancia).join(', ')
              : alergias.data.estado === 'nega' ? 'NEGA' : 'NÃO REGISTRADA',
            peso: peso.data?.valor_num ?? '',
          },
          itens: lista.map((i) => ({
            med: i.tipo === 'cuidado' ? i.descricao : `${i.descricao} — ${i.dose ?? ''}${i.diluicao_texto ? ` · ${i.diluicao_divergente ? 'DILUIÇÃO FORA DO PADRÃO: ' : ''}${i.diluicao_texto}` : ''}`,
            via: i.via ?? '—',
            pos: `${i.posologia ?? '—'}${i.se_necessario ? ' — se necessário' : ''}`,
            apr: '',
          })),
          obs: '',
        }),
      },
    })
    if (!impressao) return
    impressao.janela.focus()
    setTimeout(() => impressao.janela.print(), 300)
  }

  const lista = itens.data ?? []
  // interações justificadas pelo médico (Fase 2, tarefa 3)
  const justificadas = useQuery({
    queryKey: ['interacoes-justificadas', pacienteId, lista.map((i) => i.id).join(',')],
    enabled: lista.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('interacoes_justificadas', { p_itens: lista.map((i) => i.id) })
      if (error) throw error
      return (data ?? []) as unknown as InteracaoJustificada[]
    },
  })
  // item alterado (Fase 2, tarefa 6): versão, o que mudou e o motivo, como na Checagem
  const alteracoes = useQuery({
    queryKey: ['alteracoes-itens', lista.map((i) => i.id).join(',')],
    enabled: lista.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('alteracoes_de_itens', { p_itens: lista.map((i) => i.id) })
      if (error) throw error
      return new Map(((data ?? []) as unknown as Alteracao[]).map((e) => [e.item_id, e]))
    },
  })
  return (
    <div className="flex flex-col gap-4">
      {erro && <p className="rounded-controle border border-critico/30 bg-alerta-critico p-3 text-apoio text-critico">{erro}</p>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-corpo"><Pill className="size-4" /> Prescrição vigente</CardTitle>
          <CardDescription>
            Itens ativos agora. Suspender deixa o item no histórico. A diluição mostrada é a versão padrão vigente quando o item foi prescrito.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-apoio">
          <ResumoAlergias pacienteId={pacienteId} nome={paciente.nome} />
          {lista.length === 0 && <p className="text-tinta-sussurro">Nenhum item prescrito.</p>}
          {lista.map((i) => <LinhaItem key={i.id} i={i} justificadas={(justificadas.data ?? []).filter((j) => j.item_id === i.id)} alteracao={alteracoes.data?.get(i.id)} aoMudar={recarregar} aoErro={setErro} />)}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={() => void imprimir()} disabled={lista.length === 0}><Printer /> Imprimir prescrição</Button>
            {perfil && <span className="text-rotulo text-tinta-sussurro">Autor de cada item: quem prescreveu (login).</span>}
          </div>
        </CardContent>
      </Card>
      <NovoItem pacienteId={pacienteId} peso={peso.data} aoMudar={recarregar} aoErro={setErro} />
    </div>
  )
}

function LinhaItem({ i, justificadas, alteracao, aoMudar, aoErro }: {
  i: ItemVigente; justificadas: InteracaoJustificada[]; alteracao: Alteracao | undefined; aoMudar: () => void; aoErro: (m: string | null) => void
}) {
  const [suspendendo, setSuspendendo] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  return (
    <div className="flex flex-col gap-1 rounded-controle border border-fio px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-tinta">{i.descricao}</span>
        {i.tipo === 'medicamento' && <span>{i.dose} · {i.via} · {i.posologia}{i.se_necessario ? ' · se necessário' : ''}</span>}
        {i.vasoativo && <Badge variant="warning">vasoativo</Badge>}
        {i.peso_kg && <span className="text-rotulo text-tinta-sussurro">peso ref. {i.peso_kg} kg</span>}
        <span className="ml-auto text-rotulo text-tinta-sussurro">{i.autor} · {hora(i.criado_em)}</span>
      </div>
      {i.tipo === 'medicamento' && VIAS_COM_DILUICAO.includes(i.via ?? '') && (
        <p className={`text-rotulo ${i.diluicao_divergente ? 'text-atencao' : 'text-tinta-apoio'}`}>
          {i.diluicao_divergente
            ? <>Diluição fora do padrão: {i.diluicao_texto} — justificativa: {i.justificativa_divergencia}</>
            : i.diluicao_texto ? <>Diluição padrão v{i.diluicao_versao}: {i.diluicao_texto}</> : 'Sem diluição padrão publicada para esta via.'}
        </p>
      )}
      {alteracao && (
        <p className="text-rotulo text-atencao">
          Versão {alteracao.versao}, alterada por {alteracao.alterado_por ?? '—'}, {hora(alteracao.alterado_em)}:{' '}
          {resumoMudanca(alteracao.anterior, { dose: i.dose, via: i.via, posologia: i.posologia, se_necessario: i.se_necessario }) || 'observação'}
          {alteracao.motivo ? ` — “${alteracao.motivo}”` : ''}
        </p>
      )}
      {i.observacao && <p className="text-rotulo text-tinta-sussurro">{i.observacao}</p>}
      {justificadas.map((j) => (
        <p key={j.outro + j.em} className="text-rotulo text-critico">
          Interação {j.gravidade} com {j.outro} ({semPontoFinal(j.efeito)}) — justificada por {j.por ?? '—'}: “{j.justificativa}”
        </p>
      ))}
      {i.validacao === 'devolvido' && <p className="text-rotulo text-critico">Farmácia devolveu para correção: {i.validacao_motivo}</p>}
      {i.validacao === 'confere' && <p className="text-rotulo text-conforme">Conferido pela farmácia.</p>}
      {suspendendo ? (
        <div className="flex gap-2">
          <Input className="h-8" placeholder="Por que suspende" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="sm" variant="outline" disabled={motivo.trim().length < 5} onClick={async () => {
            const { error } = await supabase.rpc('suspender_item', { p_item: i.id, p_motivo: motivo })
            if (error) return aoErro(error.message)
            aoErro(null); setSuspendendo(false); aoMudar()
          }}>Suspender</Button>
          <Button size="sm" variant="ghost" onClick={() => setSuspendendo(false)}>Voltar</Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-start gap-1">
          <Button size="xs" variant="ghost" onClick={() => setSuspendendo(true)}><Ban /> Suspender</Button>
          {/* Fase 2, tarefa 6: alteração versionada (só medicamento) */}
          {i.tipo === 'medicamento' && <AlterarItem itemId={i.id} atual={i} aoMudar={aoMudar} />}
        </div>
      )}
    </div>
  )
}

// Porta (protótipo, "Prescrição do Pronto Socorro"): via e "quando" em chips —
// Agora ou Se necessário — no lugar da frequência; na criança, o campo do
// peso aferido aparece antes do primeiro medicamento.
const VIAS_PORTA: { v: string; rotulo: string }[] = [
  { v: 'EV', rotulo: 'EV' }, { v: 'IM', rotulo: 'IM' }, { v: 'VO', rotulo: 'VO' }, { v: 'SC', rotulo: 'SC' },
  { v: 'INAL', rotulo: 'Inalatória' }, { v: 'SL', rotulo: 'Sublingual' },
]
const QUANDO_PORTA = ['Agora', 'Se necessário'] as const

function ChipPorta({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Chip ativo={ativo} onClick={onClick}>{children}</Chip>
}

/** Texto do resultado com as letras achadas em destaque. */
function Achado({ texto, termo }: { texto: string; termo: string }) {
  return <>{trechosAchados(texto, termo).map((p, i) => (p.achou ? <b key={i} className="font-semibold text-tinta">{p.t}</b> : p.t))}</>
}

/**
 * Campo do peso deste atendimento, com o modo de obtenção. Usado no "Novo
 * item" e no topo da aba Prescrição do leito (ponto 11: o campo de lá era só
 * rascunho do navegador e não gravava).
 */
export function CampoPeso({ pacienteId, motivo, aoGravar, aoErro, id = 'peso-novo' }: {
  pacienteId: string; motivo?: string; aoGravar: () => void; aoErro: (m: string | null) => void; id?: string
}) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [valor, setValor] = React.useState('')
  const [metodo, setMetodo] = React.useState<MetodoPeso>('aferido')
  const [gravando, setGravando] = React.useState(false)
  async function registrar() {
    setGravando(true)
    const erro = await gravarPeso(perfil?.id, pacienteId, valor, metodo)
    setGravando(false)
    if (erro) return aoErro(erro)
    setValor(''); setMetodo('aferido'); aoErro(null)
    for (const k of ['falta-prescrever', 'peso-atual']) void qc.invalidateQueries({ queryKey: [k, pacienteId] })
    aoGravar()
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      {motivo && <span className="w-full text-rotulo text-atencao">{motivo}</span>}
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>Peso deste atendimento (kg)</Label>
        <Input id={id} className="h-8 w-28" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void registrar() } }} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Como o peso foi obtido">
        {METODOS_PESO.map((m) => <ChipPorta key={m.v} ativo={metodo === m.v} onClick={() => setMetodo(m.v)}>{m.rotulo}</ChipPorta>)}
      </div>
      <Button size="sm" disabled={gravando || !valor.trim()} onClick={() => void registrar()}>Registrar peso</Button>
    </div>
  )
}

export function NovoItem({ pacienteId, peso, aoMudar, aoErro, porta = false, pediatrico = false }: {
  pacienteId: string; peso?: PesoAtual | null; aoMudar: () => void; aoErro: (m: string | null) => void
  /** Modo do Pronto-Socorro: chips de via e de "quando" (Agora / Se necessário). */
  porta?: boolean
  /** Criança: mostra o campo do peso desde o início. */
  pediatrico?: boolean
}) {
  const qc = useQueryClient()
  const [tipo, setTipo] = React.useState<'medicamento' | 'cuidado'>('medicamento')
  const [busca, setBusca] = React.useState('')
  const [med, setMed] = React.useState<Medicamento | null>(null)
  const [f, setF] = React.useState({ dose: '', via: '', posologia: '', observacao: '', se_necessario: false, descricao: '' })
  const [divergir, setDivergir] = React.useState(false)
  const [dilTexto, setDilTexto] = React.useState('')
  const [justificativa, setJustificativa] = React.useState('')
  const [pedePeso, setPedePeso] = React.useState(false)
  const [pedeIdade, setPedeIdade] = React.useState(false)
  const [anos, setAnos] = React.useState('')
  const [faltaAvisada, setFaltaAvisada] = React.useState(false)
  // Fase 2, tarefa 3: interação crítica trava o item até o médico justificar
  const [interacao, setInteracao] = React.useState<{ item: Record<string, unknown>; lista: InteracaoNaPrescricao[] } | null>(null)
  const [justInteracao, setJustInteracao] = React.useState('')
  // erro do servidor dentro do cartão, junto do botão (ponto 11): no topo da
  // página ele ficava longe de quem apertou "Prescrever"
  const [erroItem, setErroItem] = React.useState<string | null>(null)
  const avisar = (m: string | null) => { setErroItem(m); aoErro(null) }
  const [opcaoAtiva, setOpcaoAtiva] = React.useState(0)
  const doseRef = React.useRef<HTMLInputElement>(null)
  const { unidadeAtiva } = useUnidade()

  // ponto 11: busca do servidor — sinônimo (AAS, SF 0,9%), várias palavras em
  // qualquer ordem, apresentação; o filtro da unidade fica dentro da RPC
  const termo = busca.trim()
  const resultados = useQuery({
    queryKey: ['busca-medicamento', termo, unidadeAtiva?.unidade_id],
    enabled: termo.length >= 2 && !med,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_medicamento', { p_unidade: unidadeAtiva?.unidade_id ?? null, p_termo: termo })
      if (error) throw error
      return (data ?? []) as unknown as MedicamentoAchado[]
    },
  })
  const achados = resultados.data ?? []
  // peso e idade que o servidor vai exigir, perguntados antes do item
  const faltaServidor = useFaltaParaPrescrever(pacienteId)
  const faltaPaciente = faltaServidor.data?.falta ?? []
  const faltaItem = faltaNoItem({ med: !!med, dose: f.dose, via: f.via, posologia: f.posologia, porta }, faltaPaciente)
  const textoPeso = faltaServidor.data ? textoDoPeso(faltaServidor.data)
    : peso ? `Último peso: ${peso.valor_num} kg (${hora(peso.aferido_em)})` : null
  function escolher(m: MedicamentoAchado) {
    setMed(m); setOpcaoAtiva(0)
    requestAnimationFrame(() => doseRef.current?.focus())
  }
  function teclaNaBusca(e: React.KeyboardEvent<HTMLInputElement>) {
    if (achados.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpcaoAtiva((i) => (i + 1) % achados.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpcaoAtiva((i) => (i - 1 + achados.length) % achados.length) }
    else if (e.key === 'Enter') { e.preventDefault(); escolher(achados[Math.min(opcaoAtiva, achados.length - 1)]) }
  }
  // Fase 2, tarefa 9: medicamento em falta na farmácia e o retorno dela
  const falta = useQuery({
    queryKey: ['falta-medicamento', unidadeAtiva?.unidade_id, med?.id],
    enabled: !!med && !!unidadeAtiva?.unidade_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('falta_do_medicamento', { p_unidade: unidadeAtiva!.unidade_id, p_medicamento: med!.id })
      if (error) throw error
      return data as unknown as { situacao: string; sinalizada_em: string; retorno: { texto: string; por: string | null; em: string } | null } | null
    },
  })
  // sem data de nascimento, o campo da idade estimada aparece antes do medicamento
  const idade = useQuery({
    queryKey: ['idade-paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('data_nascimento, data_nascimento_estimada').eq('id', pacienteId).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const semIdade = !!idade.data && !idade.data.data_nascimento
  const diluicao = useQuery({
    queryKey: ['diluicao-vigente', med?.id, f.via],
    enabled: !!med && VIAS_COM_DILUICAO.includes(f.via),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('diluicao_vigente', { p_medicamento: med!.id, p_via: f.via })
      if (error) throw error
      return ((data ?? [])[0] ?? null) as Diluicao | null
    },
  })

  const limpar = () => {
    setMed(null); setBusca(''); setDivergir(false); setDilTexto(''); setJustificativa('')
    setF({ dose: '', via: '', posologia: '', observacao: '', se_necessario: false, descricao: '' })
  }
  async function prescrever(item: Record<string, unknown>) {
    const { error } = await supabase.rpc('prescrever', { p_paciente: pacienteId, p_item: item as never })
    if (error) {
      // "Falta para prescrever: …" (servidor) diz o que falta; abre os campos correspondentes
      if (/peso deste atendimento/.test(error.message)) setPedePeso(true)
      if (/data de nascimento ou idade estimada/.test(error.message)) setPedeIdade(true)
      const lista = interacoesDoErro(error)
      if (lista) { setInteracao({ item, lista }); return avisar(null) }
      return avisar(error.message)
    }
    avisar(null); limpar(); setInteracao(null); setJustInteracao(''); aoMudar()
  }
  async function registrarIdade() {
    const n = Number(anos.replace(',', '.'))
    if (anos.trim() === '' || !(n >= 0)) return
    const { error } = await supabase.rpc('registrar_idade_estimada', { p_paciente: pacienteId, p_anos: n })
    if (error) return avisar(error.message)
    setPedeIdade(false); setAnos(''); avisar(null); aoMudar()
    for (const k of ['idade-paciente', 'cabecalho-paciente', 'falta-prescrever']) void qc.invalidateQueries({ queryKey: [k, pacienteId] })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-corpo"><Plus className="size-4" /> Novo item</CardTitle>
        <CardDescription>Dose, via e frequência são escritas por você: o sistema não sugere dose.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">
        <div className="flex gap-2">
          {(['medicamento', 'cuidado'] as const).map((t) => (
            <Button key={t} size="sm" variant={tipo === t ? 'default' : 'outline'} onClick={() => setTipo(t)}>
              {t === 'medicamento' ? 'Medicamento' : 'Cuidado'}
            </Button>
          ))}
          {/* ponto 11: o peso que o servidor aceita (deste atendimento); o "último peso" de qualquer época confundia */}
          {textoPeso && <span className="ml-auto self-center text-rotulo text-tinta-sussurro">{textoPeso}</span>}
        </div>

        {tipo === 'medicamento' && (pedeIdade || semIdade || faltaPaciente.includes('idade')) && (
          <div className="flex flex-wrap items-end gap-2 rounded-controle border border-atencao/30 bg-alerta-atencao p-2">
            <span className="w-full text-rotulo text-atencao">Para prescrever medicamento, registre a idade.</span>
            <div className="flex flex-col gap-1">
              <Label htmlFor="idade-estimada">Sem data de nascimento: idade estimada (anos)</Label>
              <Input id="idade-estimada" className="h-8 w-28" inputMode="decimal" value={anos} onChange={(e) => setAnos(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => void registrarIdade()}>Registrar idade estimada</Button>
            <span className="w-full text-rotulo text-tinta-sussurro">Fica no cadastro com a marca “estimada”. A data real, quando chegar, substitui.</span>
          </div>
        )}

        {tipo === 'medicamento' && (pedePeso || pediatrico || faltaPaciente.includes('peso')) && (
          <div className="rounded-controle border border-atencao/30 bg-alerta-atencao p-2">
            <CampoPeso pacienteId={pacienteId} aoErro={avisar}
              motivo={faltaPaciente.includes('peso') ? 'Para prescrever medicamento, registre o peso deste atendimento.' : undefined}
              aoGravar={() => { setPedePeso(false); aoMudar() }} />
          </div>
        )}

        {tipo === 'cuidado' ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {CUIDADOS.map((c) => (
                <Button key={c} size="xs" variant="outline" onClick={() => setF({ ...f, descricao: c })}>{c}</Button>
              ))}
            </div>
            <Input placeholder="Descreva o cuidado" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
            <Button size="sm" className="self-start" disabled={f.descricao.trim().length < 3}
              onClick={() => void prescrever({ tipo: 'cuidado', descricao: f.descricao })}>Prescrever cuidado</Button>
          </>
        ) : (
          <>
            {med ? (
              <div className="flex flex-wrap items-center gap-2 rounded-controle border border-fio px-3 py-2">
                <span className="font-medium">{med.principio_ativo}</span>
                <span className="text-tinta-apoio">{[med.apresentacao, med.concentracao].filter(Boolean).join(' · ')}</span>
                {med.alta_vigilancia && <Badge variant="warning">alta vigilância</Badge>}
                <Button size="xs" variant="ghost" className="ml-auto" onClick={async () => {
                  if (!unidadeAtiva) return
                  const { error } = await supabase.rpc('sinalizar_falta', { p_unidade: unidadeAtiva.unidade_id, p_medicamento: med.id })
                  avisar(error ? error.message : null)
                  if (!error) setFaltaAvisada(true)
                }}>{faltaAvisada ? 'Falta sinalizada' : 'Sinalizar falta'}</Button>
                <Button size="xs" variant="ghost" onClick={() => { setMed(null); setFaltaAvisada(false) }}>Trocar</Button>
                {falta.data && (
                  <span role="note" className="w-full text-rotulo text-atencao">
                    Em falta na farmácia ({falta.data.situacao === 'em_cotacao' ? 'em cotação' : 'sinalizada'}).
                    {falta.data.retorno ? ` Retorno da farmácia: “${falta.data.retorno.texto}”.` : ' Sem retorno da farmácia ainda.'}
                  </span>
                )}
              </div>
            ) : (
              // ponto 11 (opção A do RT): lista logo abaixo do campo, com teclado
              // (↑ ↓ Enter), o texto achado destacado e o sinônimo que achou o item
              <div className="flex flex-col gap-1">
                <Input placeholder="Buscar medicamento: nome, sigla ou apresentação (ex.: AAS, SF 0,9%, dipirona gotas)"
                  aria-label="Buscar medicamento" role="combobox" aria-expanded={achados.length > 0} aria-controls="lista-medicamentos"
                  value={busca} onChange={(e) => { setBusca(e.target.value); setOpcaoAtiva(0) }} onKeyDown={teclaNaBusca} />
                {termo.length >= 2 && (
                  <div id="lista-medicamentos" role="listbox" aria-label="Medicamentos do cadastro"
                    className="max-h-56 overflow-y-auto rounded-controle border border-fio bg-superficie">
                    {resultados.isFetching && achados.length === 0 && <p className="px-3 py-2 text-rotulo text-tinta-sussurro">Buscando…</p>}
                    {resultados.isError && (
                      <p className="px-3 py-2 text-rotulo text-critico">Não foi possível buscar. Tente de novo.</p>
                    )}
                    {achados.map((m, i) => (
                      <OpcaoLista key={m.id} aria-selected={i === opcaoAtiva} onClick={() => escolher(m)} onMouseEnter={() => setOpcaoAtiva(i)}
                        className={`flex-col items-start gap-0.5 ${i === opcaoAtiva ? 'bg-trilha' : ''}`}>
                        <span className="text-tinta">
                          {m.casou_por && <span className="text-tinta-apoio">{m.casou_por} = </span>}
                          <Achado texto={m.principio_ativo} termo={termo} />
                          {m.alta_vigilancia && <Badge variant="warning" className="ml-2">alta vigilância</Badge>}
                        </span>
                        <span className="text-rotulo text-tinta-apoio">
                          <Achado texto={[m.apresentacao, m.concentracao].filter(Boolean).join(' · ')} termo={termo} />
                        </span>
                      </OpcaoLista>
                    ))}
                    {resultados.isSuccess && achados.length === 0 && (
                      <p className="px-3 py-2 text-rotulo text-tinta-sussurro">Nada no cadastro com esse nome. Peça o cadastro ao farmacêutico.</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {porta ? (
              <>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="item-dose">Dose e diluição *</Label>
                  <Input id="item-dose" ref={doseRef} value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} placeholder="escrita pelo médico" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-apoio font-medium text-tinta-apoio">Via e quando *</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {VIAS_PORTA.map((v) => <ChipPorta key={v.v} ativo={f.via === v.v} onClick={() => setF({ ...f, via: v.v })}>{v.rotulo}</ChipPorta>)}
                    <span className="mx-1 h-5 w-px bg-fio" aria-hidden />
                    {QUANDO_PORTA.map((q) => (
                      <ChipPorta key={q} ativo={(f.posologia || 'Agora') === q}
                        onClick={() => setF({ ...f, posologia: q, se_necessario: q === 'Se necessário' })}>{q}</ChipPorta>
                    ))}
                  </div>
                </div>
              </>
            ) : (
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-dose">Dose *</Label>
                <Input id="item-dose" ref={doseRef} value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} placeholder="escrita pelo médico" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-via">Via *</Label>
                <CampoSelecao id="item-via" tamanho="compacto" value={f.via}
                  onChange={(e) => setF({ ...f, via: e.target.value })}>
                  <option value="">Escolha…</option>
                  {VIAS.map((v) => <option key={v} value={v}>{v}</option>)}
                </CampoSelecao>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-freq">Frequência *</Label>
                <Input id="item-freq" value={f.posologia} onChange={(e) => setF({ ...f, posologia: e.target.value })} placeholder="ex.: 8/8h" />
              </div>
            </div>
            )}
            {!porta && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={f.se_necessario} onChange={(e) => setF({ ...f, se_necessario: e.target.checked })} /> Se necessário
              </label>
            )}
            {med && VIAS_COM_DILUICAO.includes(f.via) && (
              <div className="flex flex-col gap-1.5 rounded-controle border border-fio p-2">
                {diluicao.data ? (
                  <p className="text-tinta-apoio">
                    Diluição padrão v{diluicao.data.versao}: {diluicao.data.texto}
                    <span className="block text-rotulo text-tinta-sussurro">Fonte: {diluicao.data.fonte} · revisão {diluicao.data.revisor_crf}</span>
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-atencao"><AlertTriangle className="size-3.5" /> Sem diluição padrão publicada para {med.principio_ativo} {f.via}.</p>
                )}
                <label className="flex items-center gap-2 text-rotulo">
                  <input type="checkbox" checked={divergir} onChange={(e) => setDivergir(e.target.checked)} /> Diluir diferente do padrão
                </label>
                {divergir && (
                  <>
                    <Input placeholder="Como diluir" value={dilTexto} onChange={(e) => setDilTexto(e.target.value)} />
                    <Textarea placeholder="Justificativa (mínimo de 10 letras)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                  </>
                )}
              </div>
            )}
            <Input placeholder="Observação (opcional)" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
            <Button size="sm" className="self-start" disabled={!med || !f.dose.trim() || !f.via || (!porta && !f.posologia.trim())}
              onClick={() => void prescrever({
                tipo: 'medicamento', medicamento_id: med!.id, dose: f.dose, via: f.via, posologia: f.posologia.trim() || (porta ? 'Agora' : ''),
                se_necessario: f.se_necessario, observacao: f.observacao,
                ...(divergir ? { diluicao_divergente: dilTexto, justificativa_divergencia: justificativa } : {}),
              })}>
              Prescrever
            </Button>
            {/* ponto 11: o botão diz o que falta, e o erro do servidor aparece aqui, não no topo da página */}
            {faltaItem.length > 0 && <p className="text-rotulo text-tinta-apoio">Falta: {faltaItem.join(', ')}.</p>}
            {erroItem && <p role="alert" className="rounded-controle border border-critico/30 bg-alerta-critico p-2 text-apoio text-critico">{erroItem}</p>}
            {interacao && (
              <div role="alert" className="flex flex-col gap-2 rounded-controle border border-critico/40 bg-alerta-critico p-3 text-apoio">
                <strong className="text-critico">Interação crítica com a prescrição vigente</strong>
                {interacao.lista.map((x) => (
                  <div key={x.interacao_id + x.outro_item_id} className="flex flex-col gap-0.5">
                    <span className="text-tinta"><b>{x.outro}</b> · {x.gravidade} · {x.grupos}</span>
                    <span className="text-tinta-apoio">{frase(x.efeito)}{x.conduta ? ` Conduta: ${frase(x.conduta)}` : ''}</span>
                    <span className="text-rotulo text-tinta-sussurro">Fonte: {x.fonte}</span>
                  </div>
                ))}
                <Textarea placeholder="Por que prescrever mesmo assim (mínimo de 10 letras; fica no prontuário e na auditoria)" value={justInteracao}
                  onChange={(e) => setJustInteracao(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={justInteracao.trim().length < 10}
                    onClick={() => void prescrever({ ...interacao.item, justificativa_interacao: justInteracao.trim() })}>Prescrever com justificativa</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setInteracao(null); setJustInteracao('') }}>Não prescrever</Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
