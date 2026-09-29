// ─────────────────────────────────────────────────────────────────────────────
// Prescrição estruturada (Fase 4.4) — internação e porta.
//
// Item ligado ao medicamento do cadastro; dose, via e frequência escritas pelo
// médico (nada é sugerido). Nada se apaga: suspender deixa o item no histórico.
// Criança: peso aferido no atendimento antes do primeiro medicamento. Alergia
// registrada trava o item. O item guarda a diluição padrão vigente (publicada
// pelo farmacêutico); diluir diferente só com justificativa. Toda regra é do
// servidor; aqui só se mostra e se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, Pill, Printer, Plus } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { abrirImpressao } from '@/lib/prontuario'
import { gravarRegistros, novoItem } from '@/lib/offline/sincronizar'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ResumoAlergias } from '@/components/paciente/AlergiasEventos'
import { ativas, useAlergias } from '@/components/paciente/useAlergias'

type ItemVigente = {
  id: string; tipo: 'medicamento' | 'cuidado'; descricao: string; medicamento_id: string | null; dose: string | null; via: string | null
  posologia: string | null; se_necessario: boolean; observacao: string | null; peso_kg: number | null; diluicao_versao: number | null
  diluicao_texto: string | null; diluicao_divergente: boolean; justificativa_divergencia: string | null; vasoativo: boolean
  autor: string | null; criado_em: string; validacao: string | null; validacao_motivo: string | null
}
type Medicamento = { id: string; principio_ativo: string; apresentacao: string | null; concentracao: string | null; alta_vigilancia: boolean }
type Diluicao = { id: string; versao: number; texto: string; fonte: string; revisor_crf: string | null }

export type PacientePrescricao = { nome: string; dataAtual?: string; leito?: string; diagnostico?: string }

const VIAS = ['VO', 'EV', 'IM', 'SC', 'SL', 'INAL', 'TÓPICA', 'RETAL', 'SNE', 'OCULAR']
const VIAS_COM_DILUICAO = ['EV', 'IM', 'SC']
// Cuidados sem dose (o catálogo antigo, sem as doses — decisão de 27/09/2026)
const CUIDADOS = ['Dieta', 'Cabeceira elevada', 'Precaução padrão', 'Vigilância de sintomas álgicos', 'Sinais vitais',
  'Comunicar intercorrências', 'Cuidados gerais de enfermagem', 'Medicações de uso contínuo', 'Mudança de decúbito']

const hora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function PrescricaoEstruturada({ pacienteId, paciente }: { pacienteId: string; paciente: PacientePrescricao }) {
  const qc = useQueryClient()
  const { perfil } = useAuth()
  const [erro, setErro] = React.useState<string | null>(null)
  const recarregar = () => {
    for (const k of ['prescricao-vigente', 'alergias', 'peso-atual']) void qc.invalidateQueries({ queryKey: [k, pacienteId] })
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
        .from('observacao').select('valor_num, aferido_em, conceito!inner(nome)')
        .eq('paciente_id', pacienteId).eq('conceito.nome', 'peso').order('aferido_em', { ascending: false }).limit(1)
      if (error) throw error
      return (data?.[0] ?? null) as { valor_num: number; aferido_em: string } | null
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
  return (
    <div className="flex flex-col gap-4">
      {erro && <p className="rounded-lg border border-critico/30 bg-critico/[0.08] p-3 text-sm text-critico">{erro}</p>}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Pill className="size-4" /> Prescrição vigente</CardTitle>
          <CardDescription>
            Itens ativos agora. Suspender deixa o item no histórico. A diluição mostrada é a versão padrão vigente quando o item foi prescrito.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <ResumoAlergias pacienteId={pacienteId} nome={paciente.nome} />
          {lista.length === 0 && <p className="text-tinta-sussurro">Nenhum item prescrito.</p>}
          {lista.map((i) => <LinhaItem key={i.id} i={i} aoMudar={recarregar} aoErro={setErro} />)}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={() => void imprimir()} disabled={lista.length === 0}><Printer /> Imprimir prescrição</Button>
            {perfil && <span className="text-xs text-tinta-sussurro">Autor de cada item: quem prescreveu (login).</span>}
          </div>
        </CardContent>
      </Card>
      <NovoItem pacienteId={pacienteId} peso={peso.data} aoMudar={recarregar} aoErro={setErro} />
    </div>
  )
}

function LinhaItem({ i, aoMudar, aoErro }: { i: ItemVigente; aoMudar: () => void; aoErro: (m: string | null) => void }) {
  const [suspendendo, setSuspendendo] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-fio px-3 py-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium text-tinta">{i.descricao}</span>
        {i.tipo === 'medicamento' && <span>{i.dose} · {i.via} · {i.posologia}{i.se_necessario ? ' · se necessário' : ''}</span>}
        {i.vasoativo && <Badge variant="warning">vasoativo</Badge>}
        {i.peso_kg && <span className="text-xs text-tinta-sussurro">peso ref. {i.peso_kg} kg</span>}
        <span className="ml-auto text-xs text-tinta-sussurro">{i.autor} · {hora(i.criado_em)}</span>
      </div>
      {i.tipo === 'medicamento' && VIAS_COM_DILUICAO.includes(i.via ?? '') && (
        <p className={`text-xs ${i.diluicao_divergente ? 'text-atencao' : 'text-tinta-apoio'}`}>
          {i.diluicao_divergente
            ? <>Diluição fora do padrão: {i.diluicao_texto} — justificativa: {i.justificativa_divergencia}</>
            : i.diluicao_texto ? <>Diluição padrão v{i.diluicao_versao}: {i.diluicao_texto}</> : 'Sem diluição padrão publicada para esta via.'}
        </p>
      )}
      {i.observacao && <p className="text-xs text-tinta-sussurro">{i.observacao}</p>}
      {i.validacao === 'devolvido' && <p className="text-xs text-critico">Farmácia devolveu para correção: {i.validacao_motivo}</p>}
      {i.validacao === 'confere' && <p className="text-xs text-conforme">Conferido pela farmácia.</p>}
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
        <Button size="xs" variant="ghost" className="self-start" onClick={() => setSuspendendo(true)}><Ban /> Suspender</Button>
      )}
    </div>
  )
}

function NovoItem({ pacienteId, peso, aoMudar, aoErro }: {
  pacienteId: string; peso?: { valor_num: number; aferido_em: string } | null; aoMudar: () => void; aoErro: (m: string | null) => void
}) {
  const { perfil } = useAuth()
  const [tipo, setTipo] = React.useState<'medicamento' | 'cuidado'>('medicamento')
  const [busca, setBusca] = React.useState('')
  const [med, setMed] = React.useState<Medicamento | null>(null)
  const [f, setF] = React.useState({ dose: '', via: '', posologia: '', observacao: '', se_necessario: false, descricao: '' })
  const [divergir, setDivergir] = React.useState(false)
  const [dilTexto, setDilTexto] = React.useState('')
  const [justificativa, setJustificativa] = React.useState('')
  const [novoPeso, setNovoPeso] = React.useState('')
  const [pedePeso, setPedePeso] = React.useState(false)
  const [faltaAvisada, setFaltaAvisada] = React.useState(false)
  const { unidadeAtiva } = useUnidade()

  const resultados = useQuery({
    queryKey: ['busca-medicamento', busca],
    enabled: busca.trim().length >= 3 && !med,
    queryFn: async () => {
      const { data, error } = await supabase.from('medicamento')
        .select('id, principio_ativo, apresentacao, concentracao, alta_vigilancia')
        .eq('ativo', true).ilike('principio_ativo', `%${busca.trim()}%`).order('principio_ativo').limit(15)
      if (error) throw error
      return (data ?? []) as Medicamento[]
    },
  })
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
      if (/registre o peso/.test(error.message)) setPedePeso(true)
      return aoErro(error.message)
    }
    aoErro(null); limpar(); aoMudar()
  }
  async function registrarPeso() {
    const n = Number(novoPeso.replace(',', '.'))
    if (!perfil || !(n > 0)) return
    const { data: c } = await supabase.from('conceito').select('id').eq('nome', 'peso').is('unidade_id', null).single()
    if (!c) return aoErro('Conceito de peso não encontrado.')
    const r = await gravarRegistros(perfil.id, [novoItem('observacao', { paciente_id: pacienteId, conceito_id: c.id, valor_num: n, origem: 'manual' })])
    if (r.recusados.length) return aoErro(r.recusados[0])
    setPedePeso(false); setNovoPeso(''); aoErro(null); aoMudar()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4" /> Novo item</CardTitle>
        <CardDescription>Dose, via e frequência são escritas por você: o sistema não sugere dose.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex gap-2">
          {(['medicamento', 'cuidado'] as const).map((t) => (
            <Button key={t} size="sm" variant={tipo === t ? 'default' : 'outline'} onClick={() => setTipo(t)}>
              {t === 'medicamento' ? 'Medicamento' : 'Cuidado'}
            </Button>
          ))}
          {peso && <span className="ml-auto self-center text-xs text-tinta-sussurro">Último peso: {peso.valor_num} kg ({hora(peso.aferido_em)})</span>}
        </div>

        {pedePeso && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-atencao/30 bg-atencao/[0.06] p-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="peso-novo">Peso aferido agora (kg)</Label>
              <Input id="peso-novo" className="h-8 w-28" inputMode="decimal" value={novoPeso} onChange={(e) => setNovoPeso(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => void registrarPeso()}>Registrar peso</Button>
          </div>
        )}

        {tipo === 'cuidado' ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {CUIDADOS.map((c) => (
                <button key={c} type="button" onClick={() => setF({ ...f, descricao: c })}
                  className="rounded-md border border-fio px-2 py-0.5 text-xs hover:bg-trilha">{c}</button>
              ))}
            </div>
            <Input placeholder="Descreva o cuidado" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
            <Button size="sm" className="self-start" disabled={f.descricao.trim().length < 3}
              onClick={() => void prescrever({ tipo: 'cuidado', descricao: f.descricao })}>Prescrever cuidado</Button>
          </>
        ) : (
          <>
            {med ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fio px-3 py-2">
                <span className="font-medium">{med.principio_ativo}</span>
                <span className="text-tinta-apoio">{[med.apresentacao, med.concentracao].filter(Boolean).join(' · ')}</span>
                {med.alta_vigilancia && <Badge variant="warning">alta vigilância</Badge>}
                <Button size="xs" variant="ghost" className="ml-auto" onClick={async () => {
                  if (!unidadeAtiva) return
                  const { error } = await supabase.rpc('sinalizar_falta', { p_unidade: unidadeAtiva.unidade_id, p_medicamento: med.id })
                  aoErro(error ? error.message : null)
                  if (!error) setFaltaAvisada(true)
                }}>{faltaAvisada ? 'Falta sinalizada' : 'Sinalizar falta'}</Button>
                <Button size="xs" variant="ghost" onClick={() => { setMed(null); setFaltaAvisada(false) }}>Trocar</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <Input placeholder="Buscar medicamento do cadastro (3 letras ou mais)" value={busca} onChange={(e) => setBusca(e.target.value)} />
                <div className="max-h-48 overflow-y-auto">
                  {(resultados.data ?? []).map((m) => (
                    <button key={m.id} type="button" onClick={() => setMed(m)}
                      className="flex w-full gap-2 border-b border-fio px-2 py-1 text-left text-xs last:border-0 hover:bg-trilha">
                      <span className="font-medium">{m.principio_ativo}</span>
                      <span className="text-tinta-apoio">{[m.apresentacao, m.concentracao].filter(Boolean).join(' · ')}</span>
                    </button>
                  ))}
                  {resultados.data?.length === 0 && <p className="px-2 py-1 text-xs text-tinta-sussurro">Nada no cadastro com esse nome.</p>}
                </div>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-dose">Dose *</Label>
                <Input id="item-dose" value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} placeholder="escrita pelo médico" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-via">Via *</Label>
                <select id="item-via" className="h-8 rounded-controle border border-fio bg-campo px-2 text-sm" value={f.via}
                  onChange={(e) => setF({ ...f, via: e.target.value })}>
                  <option value="">Escolha…</option>
                  {VIAS.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-freq">Frequência *</Label>
                <Input id="item-freq" value={f.posologia} onChange={(e) => setF({ ...f, posologia: e.target.value })} placeholder="ex.: 8/8h" />
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.se_necessario} onChange={(e) => setF({ ...f, se_necessario: e.target.checked })} /> Se necessário
            </label>
            {med && VIAS_COM_DILUICAO.includes(f.via) && (
              <div className="flex flex-col gap-1.5 rounded-lg border border-fio p-2">
                {diluicao.data ? (
                  <p className="text-tinta-apoio">
                    Diluição padrão v{diluicao.data.versao}: {diluicao.data.texto}
                    <span className="block text-xs text-tinta-sussurro">Fonte: {diluicao.data.fonte} · revisão {diluicao.data.revisor_crf}</span>
                  </p>
                ) : (
                  <p className="flex items-center gap-1.5 text-atencao"><AlertTriangle className="size-3.5" /> Sem diluição padrão publicada para {med.principio_ativo} {f.via}.</p>
                )}
                <label className="flex items-center gap-2 text-xs">
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
            <Button size="sm" className="self-start" disabled={!med || !f.dose.trim() || !f.via || !f.posologia.trim()}
              onClick={() => void prescrever({
                tipo: 'medicamento', medicamento_id: med!.id, dose: f.dose, via: f.via, posologia: f.posologia,
                se_necessario: f.se_necessario, observacao: f.observacao,
                ...(divergir ? { diluicao_divergente: dilTexto, justificativa_divergencia: justificativa } : {}),
              })}>
              Prescrever
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
