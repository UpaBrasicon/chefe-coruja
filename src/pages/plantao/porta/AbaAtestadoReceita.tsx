// Aba "Atestado e receita" (protótipo): atestado de afastamento ou de
// comparecimento (CID só a pedido do paciente) e a receita de alta. A receita
// padrão usa as PREFERÊNCIAS DE PRESCRIÇÃO do médico (tela Preferências de
// prescrição): aplicar um conjunto e "salvar como padrão". Emitir grava o
// documento no episódio com número próprio (mesma folha das telas avulsas).
// Dose e posologia são escritas pelo médico: nada é sugerido.
// Receita padrão e favoritos têm dose de adulto: só para adulto PELA IDADE.
// Criança e paciente sem data de nascimento (decisão do RT, 02/10/2026) não
// os recebem — mesma regra do Receituário médico (TEXTO_PEDIATRICO).
import { useQuery } from '@tanstack/react-query'
import { ClipboardList, FileText, Pill, Printer, X } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { normalizarMedicamento } from '@/lib/search'
import { abrirImpressao } from '@/lib/prontuario'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ativas, useAlergias } from '@/components/paciente/useAlergias'
import { Aviso } from '@/components/documentos/ui'
import { ofereceConteudoAdulto, type FaixaEtaria } from '@/domain/idade'
import { idadeLegivel } from '@/pages/recepcao/cadastroForm'
import { TEXTO_PEDIATRICO, TEXTO_SEM_NASCIMENTO } from '../atendimento/ReceituarioMedico'

import { hoje, hora, msg, type EstadoDocs, type ItemReceita } from './comum'


type Pref = {
  id: string; receita_padrao: string | null; dose: string | null; posologia: string; quantidade: string | null; medicamento_id: string
  medicamento: { principio_ativo: string; apresentacao: string | null } | null
}
type Med = { id: string; principio_ativo: string; apresentacao: string | null; concentracao: string | null }
type Documento = { id: string; numero: string | null; tipo_documento: string; created_at: string; emitido_em: string | null; estado: string; sem_conexao: boolean; versao: number }

const NOME_DOC: Record<string, string> = {
  atestado: 'Atestado', receita: 'Receita', encaminhamento: 'Encaminhamento', pedido_exames: 'Pedido de exames',
  boletim_emergencia: 'Boletim de emergência', laudo_aih: 'Laudo de AIH', sumario_alta: 'Sumário de alta', termo_consentimento: 'Termo de consentimento',
}
const nomeMed = (m: { principio_ativo: string; apresentacao: string | null } | null) => (m ? [m.principio_ativo, m.apresentacao].filter(Boolean).join(' ') : '')

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={ativo} onClick={onClick}
      className={cn('rounded-capsula border px-3 py-1 text-apoio transition-colors', ativo ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
      {children}
    </button>
  )
}
function Situacao({ em, rascunho }: { em: string | null; rascunho: string }) {
  return <span className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold', em ? 'bg-alerta-conforme text-conforme' : 'bg-trilha text-tinta-apoio')}>{em ? `Emitido ${hora(em)}` : rascunho}</span>
}

export function AbaAtestadoReceita({ episodioId, pacienteId, nome, nascimento, faixa, cid, estado, setEstado }: {
  episodioId: string; pacienteId: string; nome: string; nascimento: string | null
  /** faixa pela IDADE (JanelaAtendimento), nunca pela porta */
  faixa: FaixaEtaria
  /** CID-10 do atendimento (SOAP registrado ou em rascunho), para o atestado a pedido. */
  cid: string
  estado: EstadoDocs; setEstado: (f: (s: EstadoDocs) => EstadoDocs) => void
}) {
  const [erro, setErro] = React.useState<string | null>(null)
  const alergias = useAlergias(pacienteId)
  // mesma chave e forma de AbaPrescricao / PrescricaoEstruturada (cache comum)
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
  const docs = useQuery({
    queryKey: ['documentos-episodio', episodioId],
    queryFn: async () => {
      const { data, error } = await supabase.from('documentos_clinicos')
        .select('id, numero, tipo_documento, created_at, emitido_em, estado, sem_conexao, versao').eq('episodio_id', episodioId).order('created_at')
      if (error) throw error
      return (data ?? []) as Documento[]
    },
  })

  // folha: mesmos campos das telas avulsas (src/pages/plantao/shared/rascunho.ts)
  const pacienteFolha = () => ({
    nome, nascimento: nascimento ? nascimento.split('-').reverse().join('/') : '', dataAtual: hoje(),
    // idade (na data da folha) e peso aferido quando conhecidos (a folha acrescenta "kg"); sem dado, em branco
    idade: nascimento ? idadeLegivel(nascimento) : '',
    peso: peso.data?.valor_num != null ? String(peso.data.valor_num).replace('.', ',') : '',
    alergias: !alergias.data ? 'NÃO VERIFICADA'
      : alergias.data.estado === 'tem' ? ativas(alergias.data).map((a) => a.substancia).join(', ')
      : alergias.data.estado === 'nega' ? 'NEGA' : 'NÃO REGISTRADA',
    dieta: '', leito: '', diagnostico: '', paciente_id: pacienteId,
  })
  async function emitir(tipo: 'atestado' | 'receita', conteudo: unknown) {
    const impressao = await abrirImpressao({ pacienteId, internacaoId: null, tipo: tipo === 'atestado' ? 'Atestado' : 'Receituário', documento: { tipo, conteudo: JSON.stringify(conteudo) } })
    if (!impressao) return false
    impressao.janela.focus()
    window.setTimeout(() => impressao.janela.print(), 300)
    void docs.refetch()
    return true
  }

  async function emitirAtestado() {
    if (estado.atTipo === 'afastamento' && !(Number(estado.atDias) > 0)) return setErro('Informe os dias de afastamento.')
    if (estado.atCid && !cid.trim()) return setErro('Para incluir o CID, preencha o CID-10 na aba Atendimento.')
    setErro(null)
    const ok = await emitir('atestado', {
      paciente: pacienteFolha(),
      atestado: { tipo: estado.atTipo, dias: estado.atTipo === 'afastamento' ? estado.atDias : '', cid: estado.atCid ? cid.trim() : '', texto: '' },
    })
    if (ok) setEstado((s) => ({ ...s, atEmitidoEm: new Date().toISOString() }))
  }
  async function emitirReceita() {
    if (!estado.receita.length) return setErro('A receita não tem itens.')
    setErro(null)
    const ok = await emitir('receita', {
      paciente: pacienteFolha(),
      receita: { tipo: 'branca', obs: '', itens: estado.receita.map((i) => ({ id: i.id, medicamento: i.medicamento, dose: '', posologia: i.posologia, quantidade: i.quantidade })) },
    })
    if (ok) setEstado((s) => ({ ...s, rxEmitidaEm: new Date().toISOString() }))
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p role="alert" className="rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">{erro}</p>}

      <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-3">
          <ClipboardList className="size-4 text-acao" aria-hidden />
          <span className="text-controle font-semibold text-tinta">Atestado</span>
          <Situacao em={estado.atEmitidoEm} rascunho="Rascunho" />
        </div>
        <div className="flex flex-wrap items-end gap-3 px-4 py-3">
          <div className="flex gap-1.5">
            {(['afastamento', 'comparecimento'] as const).map((t) => (
              <Chip key={t} ativo={estado.atTipo === t} onClick={() => setEstado((s) => ({ ...s, atTipo: t, atEmitidoEm: null }))}>
                {t === 'afastamento' ? 'Afastamento' : 'Comparecimento'}
              </Chip>
            ))}
          </div>
          {estado.atTipo === 'afastamento' && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="at-dias">Dias</Label>
              <Input id="at-dias" type="number" min={1} className="h-8 w-20" value={estado.atDias}
                onChange={(e) => setEstado((s) => ({ ...s, atDias: e.target.value, atEmitidoEm: null }))} />
            </div>
          )}
          <Chip ativo={estado.atCid} onClick={() => setEstado((s) => ({ ...s, atCid: !s.atCid, atEmitidoEm: null }))}>
            {estado.atCid ? `CID incluído a pedido do paciente${cid ? ` (${cid})` : ''}` : 'Incluir CID (só a pedido)'}
          </Chip>
          <Button size="sm" className="ml-auto" onClick={() => void emitirAtestado()}><Printer /> {estado.atEmitidoEm ? 'Emitir de novo' : 'Emitir atestado'}</Button>
        </div>
      </section>

      <ReceitaAlta faixa={faixa} estado={estado} setEstado={setEstado} onEmitir={() => void emitirReceita()} />

      <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-3">
          <FileText className="size-4 text-acao" aria-hidden />
          <span className="text-controle font-semibold text-tinta">Documentos do episódio</span>
          <span className="text-apoio text-tinta-sussurro">Cada emissão é gravada no episódio com número próprio. Sem conexão, sai a folha provisória.</span>
        </div>
        {(docs.data ?? []).length === 0 && <p className="px-4 py-3 text-apoio text-tinta-sussurro">Nenhum documento emitido neste episódio.</p>}
        {(docs.data ?? []).map((d) => (
          <div key={d.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-trilha px-4 py-2 text-apoio last:border-0">
            <span className="text-tinta">
              {NOME_DOC[d.tipo_documento] ?? d.tipo_documento.replace(/_/g, ' ')}
              {d.versao > 1 && ` (versão ${d.versao})`}
              {d.estado === 'retificado' && <span className="text-tinta-sussurro"> · retificado</span>}
              {d.estado === 'rascunho' && <span className="text-atencao"> · rascunho</span>}
              {d.sem_conexao && <Badge variant="outline" className="ml-2">sem conexão</Badge>}
            </span>
            <span className="text-rotulo tabular-nums text-tinta-sussurro">nº {d.numero ?? '—'} · {hora(d.emitido_em ?? d.created_at)}</span>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 border-t border-trilha px-4 py-3">
          <Button size="sm" variant="outline" render={<Link to={`/plantao/atendimento-porta/encaminhamento?paciente=${pacienteId}`} />}>Encaminhamento (folha)</Button>
          <Button size="sm" variant="outline" render={<Link to={`/plantao/atendimento-porta/receituario-medico?paciente=${pacienteId}`} />}>Receituário completo</Button>
          <Button size="sm" variant="outline" render={<Link to={`/plantao/atendimento-porta/atestado-medico?paciente=${pacienteId}`} />}>Atestado completo</Button>
        </div>
      </section>
    </div>
  )
}

function ReceitaAlta({ faixa, estado, setEstado, onEmitir }: { faixa: FaixaEtaria; estado: EstadoDocs; setEstado: (f: (s: EstadoDocs) => EstadoDocs) => void; onEmitir: () => void }) {
  const adulto = ofereceConteudoAdulto(faixa)
  const [busca, setBusca] = React.useState('')
  const [med, setMed] = React.useState<Med | null>(null)
  const [pos, setPos] = React.useState('')
  const [qtd, setQtd] = React.useState('')
  const [nomePadrao, setNomePadrao] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)

  const prefs = useQuery({
    queryKey: ['preferencias-prescricao'],
    enabled: adulto,
    queryFn: async () => {
      const { data, error } = await supabase.from('preferencias_prescricao')
        .select('id, receita_padrao, dose, posologia, quantidade, medicamento_id, medicamento:medicamento(principio_ativo, apresentacao)')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as Pref[]
    },
  })
  const resultados = useQuery({
    queryKey: ['busca-medicamento-receita', busca],
    enabled: busca.trim().length >= 3 && !med,
    queryFn: async () => {
      const { data, error } = await supabase.from('medicamento').select('id, principio_ativo, apresentacao, concentracao')
        .eq('ativo', true).ilike('principio_ativo_norm', `%${normalizarMedicamento(busca.trim())}%`).order('principio_ativo').limit(8)
      if (error) throw error
      return (data ?? []) as Med[]
    },
  })

  const conjuntos = new Map<string, Pref[]>()
  const avulsos: Pref[] = []
  for (const p of adulto ? prefs.data ?? [] : []) {
    if (p.receita_padrao) conjuntos.set(p.receita_padrao, [...(conjuntos.get(p.receita_padrao) ?? []), p])
    else avulsos.push(p)
  }
  const deItem = (p: Pref): ItemReceita => ({
    id: crypto.randomUUID(), medicamento_id: p.medicamento_id,
    medicamento: [nomeMed(p.medicamento), p.dose].filter(Boolean).join(' · '), posologia: p.posologia, quantidade: p.quantidade ?? '',
  })
  const aplicar = (lista: Pref[]) => setEstado((s) => ({
    ...s, rxEmitidaEm: null,
    receita: [...s.receita, ...lista.filter((p) => !s.receita.some((r) => r.medicamento_id === p.medicamento_id && r.posologia === p.posologia)).map(deItem)],
  }))

  function adicionar() {
    const nomeItem = med ? nomeMed(med) : busca.trim()
    if (!nomeItem || !pos.trim()) return setErro('Informe o medicamento e como tomar.')
    setErro(null)
    setEstado((s) => ({ ...s, rxEmitidaEm: null, receita: [...s.receita, { id: crypto.randomUUID(), medicamento_id: med?.id ?? null, medicamento: nomeItem, posologia: pos.trim(), quantidade: qtd.trim() }] }))
    setMed(null); setBusca(''); setPos(''); setQtd('')
  }

  async function salvarPadrao() {
    const n = nomePadrao.trim()
    const doCadastro = estado.receita.filter((r) => r.medicamento_id && r.posologia.trim().length >= 3)
    if (n.length < 2 || !doCadastro.length) return
    setErro(null); setAviso(null)
    try {
      // o conjunto com o mesmo nome é substituído (protótipo)
      const antigos = (prefs.data ?? []).filter((p) => p.receita_padrao?.toLowerCase() === n.toLowerCase()).map((p) => p.id)
      if (antigos.length) {
        const { error } = await supabase.from('preferencias_prescricao').delete().in('id', antigos)
        if (error) throw error
      }
      const vistos = new Set<string>()
      const linhas = doCadastro.filter((r) => {
        const k = `${r.medicamento_id}|${r.posologia.trim().toLowerCase()}`
        if (vistos.has(k)) return false
        vistos.add(k); return true
      }).map((r) => ({ medicamento_id: r.medicamento_id!, posologia: r.posologia.trim(), quantidade: r.quantidade.trim() || null, receita_padrao: n }))
      const { error } = await supabase.from('preferencias_prescricao').insert(linhas)
      if (error) throw error
      const fora = estado.receita.length - doCadastro.length
      setAviso(`Receita padrão "${n}" salva com ${linhas.length} ${linhas.length === 1 ? 'item' : 'itens'}.${fora ? ` ${fora} item(ns) digitado(s) fora do cadastro de medicamentos não entra(m) no padrão.` : ''}`)
      setNomePadrao('')
      void prefs.refetch()
    } catch (e) {
      setErro(msg(e))
    }
  }

  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-3">
        <Pill className="size-4 text-acao" aria-hidden />
        <span className="text-controle font-semibold text-tinta">Receita de alta</span>
        <Situacao em={estado.rxEmitidaEm} rascunho={estado.receita.length ? 'Rascunho' : 'Sem itens'} />
      </div>
      {!adulto && (
        <div className="border-b border-trilha px-4 py-3">
          <Aviso>{faixa === 'pediatrico' ? TEXTO_PEDIATRICO : TEXTO_SEM_NASCIMENTO}</Aviso>
          {estado.rxEmitidaEm && <Button size="sm" variant="ghost" className="mt-2" onClick={() => setEstado((s) => ({ ...s, rxEmitidaEm: null }))}>Reabrir</Button>}
        </div>
      )}
      {adulto && <div className="flex flex-wrap items-center gap-1.5 border-b border-trilha px-4 py-3">
        <span className="text-apoio text-tinta-sussurro">Receita padrão:</span>
        {[...conjuntos.entries()].map(([n, lista]) => (
          <Chip key={n} ativo={false} onClick={() => aplicar(lista)}>{n} ({lista.length})</Chip>
        ))}
        {avulsos.map((p) => (
          <Chip key={p.id} ativo={false} onClick={() => aplicar([p])}>{p.medicamento?.principio_ativo ?? 'Favorito'} · {p.posologia}</Chip>
        ))}
        {!prefs.isLoading && (prefs.data ?? []).length === 0 && (
          <span className="text-apoio text-tinta-sussurro">nenhuma ainda. <Link to="/preferencias-prescricao" className="text-acao underline-offset-2 hover:underline">Preferências de prescrição</Link></span>
        )}
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          <Input className="h-8 w-52" aria-label="Nome da receita padrão" placeholder="Nome para salvar como padrão" value={nomePadrao} onChange={(e) => setNomePadrao(e.target.value)} />
          <Button size="sm" variant="outline" disabled={nomePadrao.trim().length < 2 || !estado.receita.some((r) => r.medicamento_id)} onClick={() => void salvarPadrao()}>
            Salvar como padrão
          </Button>
          {estado.rxEmitidaEm && <Button size="sm" variant="ghost" onClick={() => setEstado((s) => ({ ...s, rxEmitidaEm: null }))}>Reabrir</Button>}
        </span>
      </div>}
      {estado.receita.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3 border-b border-trilha px-4 py-2.5">
          <span className="w-5 text-apoio tabular-nums text-tinta-sussurro">{i + 1}.</span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-controle font-medium text-tinta">{r.medicamento}{r.quantidade && <span className="font-normal text-tinta-sussurro"> · {r.quantidade}</span>}</span>
            <span className="text-apoio text-tinta-sussurro">{r.posologia}</span>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label="Remover item"
            onClick={() => setEstado((s) => ({ ...s, rxEmitidaEm: null, receita: s.receita.filter((x) => x.id !== r.id) }))}><X /></Button>
        </div>
      ))}
      <div className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_110px_auto_auto] sm:items-end">
        <div className="relative flex flex-col gap-1">
          <Label htmlFor="rx-med">Medicamento</Label>
          {med ? (
            <div className="flex h-8 items-center gap-2 rounded-controle border border-fio px-2 text-apoio">
              <span className="truncate">{nomeMed(med)}</span>
              <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setMed(null)}>Trocar</Button>
            </div>
          ) : (
            <Input id="rx-med" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Do cadastro (3 letras) ou livre" autoComplete="off" />
          )}
          {!med && (resultados.data ?? []).length > 0 && (
            <div role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-controle border border-fio bg-superficie shadow-popover">
              {(resultados.data ?? []).map((m) => (
                <button key={m.id} type="button" role="option" aria-selected={false} onClick={() => setMed(m)}
                  className="flex w-full gap-2 border-b border-trilha px-3 py-2 text-left text-apoio last:border-0 hover:bg-trilha">
                  <span className="font-medium text-tinta">{m.principio_ativo}</span>
                  <span className="text-tinta-sussurro">{[m.apresentacao, m.concentracao].filter(Boolean).join(' · ')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rx-pos">Como tomar</Label>
          <Input id="rx-pos" value={pos} onChange={(e) => setPos(e.target.value)} placeholder="escrito pelo médico" />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="rx-qtd">Quantidade</Label>
          <Input id="rx-qtd" value={qtd} onChange={(e) => setQtd(e.target.value)} />
        </div>
        <Button variant="outline" onClick={adicionar}>Adicionar</Button>
        <Button onClick={onEmitir} disabled={!estado.receita.length}><Printer /> {estado.rxEmitidaEm ? 'Emitir de novo' : 'Emitir receita'}</Button>
      </div>
      {(erro || aviso) && <p className={cn('border-t border-trilha px-4 py-2 text-apoio', erro ? 'text-critico' : 'text-conforme')}>{erro ?? aviso}</p>}
    </section>
  )
}
